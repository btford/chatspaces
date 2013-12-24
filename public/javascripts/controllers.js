'use strict';

angular.module('chatspaces.controllers', [
  'chatspaces.dashboard',
  'chatspaces.friend',
  'chatspaces.profile'
]).

controller('AppCtrl',
  function ($scope, authenticate, $rootScope, $http, $location, $routeParams, user, localCache) {

  user.call();
  $rootScope.friendPredicate = '-username';
  $rootScope.recipients = {};
  $rootScope.latestThreadMessage;
  $rootScope.dashboardList = [];

  socket.on('friend', function (data) {
    $rootScope.$apply(function () {
      $rootScope.friends[data.friend.userHash] = {
        username: data.friend.username,
        avatar: data.friend.avatar,
        userHash: data.friend.userHash,
        senderUserHash: data.friend.senderUserHash
      };
    });
  });

  socket.on('notification', function (data) {
    $rootScope.$apply(function () {
      if (data && $rootScope.notifications.indexOf(data) === -1 &&
         (!$routeParams.senderKey || $routeParams.senderKey !== data)) {
        $rootScope.notifications.push(data);
        $rootScope.latestMessage = data;
      }
    });
  });

  socket.on('message', function (data) {
    $rootScope.$apply(function () {
      var senderKey = data.value.reply || data.value.senderKey;

      if ($location.path() === '/dashboard' || $routeParams.senderKey === senderKey) {
        var key = data.value.reply || data.key;

        // also save message to local cache
        data.updated = data.value.created;

        $rootScope.messages[data.key] = data;

        localForage.setItem($rootScope.userHash + ':message[' + data.key + ']', data);
        localForage.setItem($rootScope.userHash + ':latestMessageKey', key); // last one at the top is the latest dashboard key
        localCache.setItem(key, data);

        if ($routeParams.senderKey === senderKey) {
          $rootScope.latestThreadMessage = data.key; // last one at the top is the latest thread key
          data.value.recipients.forEach(function (userHash) {
            if (userHash !== $rootScope.userHash) {
              $rootScope.recipients[userHash] = userHash;
            }
          });

          $rootScope.reply = senderKey;
        } else {
          $rootScope.latestMessage = key;
        }
      }
    });
  });

  socket.on('blocked', function (data) {
    $rootScope.$apply(function () {
      $rootScope.blocked[data.user.userHash] = {
        username: data.user.username,
        avatar: data.user.avatar,
        userHash: data.user.userHash
      };
    });
  });

  $rootScope.loadDashboard = function () {
    var since = '';

    if ($rootScope.latestMessage) {
      since = '?since=' + $rootScope.latestMessage;
    }

    $http({
      url: '/api/feed?since=' + since,
      method: 'GET'
    }).success(function (data) {
      $location.path('/dashboard');
    });
  };

  $rootScope.getDate = function (timestamp) {
    return moment.unix(Math.round(timestamp / 1000)).fromNow();
  };

  $rootScope.toggleSettings = function () {
    if ($rootScope.settings) {
      $rootScope.settings = false;
    } else {
      $rootScope.settings = true;
    }
  };

  $rootScope.newMessage = function () {
      $rootScope.settings = false;
  };

  var email = localStorage.getItem('personaEmail');

  if (email) {
    $rootScope.isAuthenticated = true;
  }

  $rootScope.logout = function () {
    authenticate.logout();
  }
}).
controller('HomeCtrl', function ($scope, $rootScope, $location, authenticate) {
  $scope.login = function () {
    authenticate.login();
    $rootScope.toggleSettings();
  };
}).
controller('MessageCtrl', function ($scope, $rootScope, $http, $routeParams, $location, cameraHelper, api) {
  api.call();

  var since = '';

  $rootScope.messages = {};
  $scope.formDate = {};
  $scope.showCamera = false;

  var resetForm = function () {
    if (!$routeParams.senderKey) {
      $rootScope.recipients = {};
      $scope.reply = false;
    }

    $scope.recipientArr = [];
    $scope.errors = false;
    $scope.message = '';
    $scope.preview = '';
    $scope.posting = false;
    $scope.showCamera = false;
    $scope.showFollowing = false;
    $('#video-preview').empty();
    cameraHelper.resetStream();
  };

  var escapeHtml = function (text) {
    if (text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  };

  var getThread = function () {
    $http({
      url: '/api/thread/' + $routeParams.senderKey + since,
      method: 'GET'
    }).success(function (data) {
      $scope.isLoading = false;
      $scope.errors = false;
    }).error(function (data) {
      $scope.info = false;
      $scope.errors = data.message;
    });
  };

  resetForm();

  if ($rootScope.hasNewNotifications < 0) {
    $rootScope.hasNewNotifications = 0;
  }

  if ($routeParams.senderKey) {
    $rootScope.notifications.splice($rootScope.notifications.indexOf($routeParams.senderKey), 1);

    $rootScope.recipients = {};
    $rootScope.reply = $routeParams.senderKey;
    $rootScope.threadList = [];

    localForage.getItem($rootScope.userHash + ':threadList[' + $routeParams.senderKey + ']', function (data) {
      if (data) {
        $rootScope.threadList = data;
        $rootScope.latestThreadMessage = data[0];

        since = '?since=' + $rootScope.latestThreadMessage;
      }

      $rootScope.threadList.forEach(function (d) {
        localForage.getItem($rootScope.userHash + ':message[' + d + ']', function (message) {
          $rootScope.messages[d] = message;

          message.value.recipients.forEach(function (userHash) {
            if (userHash !== $rootScope.userHash) {
              $rootScope.recipients[userHash] = userHash;
            }
          });
        });
      });

      getThread();
      $scope.isLoading = false;
    });
  }

  $scope.promptCamera = function () {
    if ($rootScope.isAuthenticated && navigator.getMedia) {
      $scope.showCamera = true;
      cameraHelper.startStream();
    } else {
      $scope.back();
    }
  };

  $scope.cancelCamera = function () {
    $scope.showCamera = false;
    $scope.showFollowing = false;
    $('#video-preview').empty();
    cameraHelper.resetStream();
  };

  $scope.back = function () {
    $scope.showCamera = false;
    $scope.showFollowing = false;
    $('#video-preview').empty();
    cameraHelper.resetStream();
  };

  $scope.recordCamera = function () {
    cameraHelper.startScreenshot(function (pictureData) {
      $scope.$apply(function () {
        $rootScope.picture = pictureData;
      });
    });
  };

  $scope.showRecipients = function () {
    $scope.back();
    $scope.showFollowing = true;
  };

  $scope.toggleRecipient = function (userHash) {
    if ($rootScope.recipients[userHash]) {
      delete $rootScope.recipients[userHash];
    } else {
      $rootScope.recipients[userHash] = userHash;
    }
  };

  $scope.sendMessage = function () {
    // if a picture hasn't been selected, jump to the camera overlay
    if (!$rootScope.picture) {
      $scope.back();
      $scope.promptCamera();
      return;
    }

    if (!$scope.posting) {
      $scope.posting = true;

      for (var r in $rootScope.recipients) {
        $scope.recipientArr.push(r);
      }

      // Also add yourself to the message so you can get replies.
      if ($scope.recipientArr.indexOf($rootScope.userHash) === -1) {
        $scope.recipientArr.push($rootScope.userHash);
      }

      var formData = {
        message: escapeHtml($scope.message),
        picture: escapeHtml($rootScope.picture),
        recipients: $scope.recipientArr
      };

      if ($routeParams.senderKey && $rootScope.reply) {
        formData.reply = $rootScope.reply;
      }

      $http({
        url: '/api/message',
        data: formData,
        method: 'POST'
      }).success(function (data) {
        localForage.setItem($rootScope.userHash + ':lastPic', $rootScope.picture);
        resetForm();

        if (!$routeParams.senderKey) {
          $location.path('/thread/' + data.key);
        }
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
        $scope.posting = false;
      });
    }
  };
}).
controller('DraftsCtrl', function ($scope, $rootScope, $location) {

}).

controller('BlockedCtrl', function ($scope, $rootScope, $http, $location, api) {
  api.call();

  $scope.unblockUser = function (userHash, idx) {
    $http({
      url: '/api/block/' + userHash,
      method: 'DELETE'
    }).success(function (data) {
      delete $rootScope.blocked[userHash];
    }).error(function (data) {
      $scope.errors = data.message;
    });
  };
});
