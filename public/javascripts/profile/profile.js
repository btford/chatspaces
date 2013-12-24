angular.module('chatspaces.profile', []).

controller('ProfileCtrl', function ($scope, $rootScope, $http, $location) {
  $scope.currentUsername = $rootScope.username;
  $scope.cacheInfo = false;

  $scope.resetCache = function () {
    localForage.clear();
    $rootScope.latestMessage = false;
    $scope.cacheInfo = 'Local cache reset.';
  };

  $scope.updateProfile = function () {
    $http({
      url: '/api/profile',
      data: {
        username: $scope.username
      },
      method: 'PUT'
    }).success(function (data) {
      $scope.errors = false;
      $scope.info = data.message;
      $rootScope.username = $scope.username = $scope.currentUsername = data.username;
    }).error(function (data) {
      $scope.info = false;
      $scope.errors = data.message;
    });
  };
});
