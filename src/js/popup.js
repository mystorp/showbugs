var storageKeys = [
	"server",
	"type",
	"username",
	"password"
];
var app = angular.module("BugApp", []);

app.controller("SetupController", ["$scope", "storage", "$rootScope", function($scope, storage, $rootScope){
	$scope.server = "192.168.0.4:8011";

	storage.get().then(function(data){
		if(data) {
			angular.extend($scope, data);
		}
		if(checkData(data)) {
			$rootScope.ready = true;
		}
		$rootScope.$digest();
	}, function(e){
		$scope.error = e.message;
		$rootScope.$digest();
	});


	$scope.saveSetup = function(){
		var form = $scope.setupForm;
		var values = {};
		if(form.$invalid) {
			angular.forEach(form.$error, function(ctrl){
				ctrl.$setViewValue("");
			});
			return;
		}
		angular.forEach(storageKeys, function(key){
			values[key] = $scope[key];
		});
		values.server = "http://" + values.server;

		storage.set(values).then(function(){
			$rootScope.ready = true;
		}, function(e){
			$scope.error = e.message;
		});
	};

	$scope.$on("error", function(e_, e){
		$scope.error = e.message
	});

	function checkData(data){
		var valid = true;
		angular.forEach(storageKeys, function(key){
			if(!data.hasOwnProperty(key)) {
				valid = false;
			}
		});
		return valid;
	}
}]);

app.controller("BugController", ["$scope", "$interval", "storage", function($scope, $interval, storage){
	$scope.bugs = [];
	$scope.columns = ["ID", "Bug标题", "修改日期", "严重程度", "优先级", "创建者", "指派者", "解决者", "解决方案", "处理状态"];

	getBugList();
	getBugError();

	$scope.openBugfree = function(){
		console.log("xxx")
		chrome.runtime.sendMessage({cmd: "open-bugfree"});
	}
	
	$scope.setBugIndex = function(index){
		$scope.bugIndex = index;
	};

	var timer = $interval(function(){
		getBugList();
		getBugError();
	}, 2000);

	$scope.$on("$destroy", function(){
		$interval.cancel(timer);
	});
	function getBugList(){
		chrome.runtime.sendMessage({cmd: "get-bug-list"}, function(bugs){
			$scope.bugs = bugs;
			if($scope.hasOwnProperty("bugIndex")) {
				var exsits = false;
				bugs.forEach(function(bug){
					if(bug.ID === bugIndex) {
						exsits = true;
					}
				});
				if(!exsits && bugs.length > 0) {
					$scope.bugIndex = bugs[0].ID;
				}
			} else {
				if(bugs.length > 0) {
					$scope.bugIndex = bugs[0].ID;
				}
			}
			$scope.$digest();
		});
	}
	function getBugError(){
		chrome.runtime.sendMessage({cmd: "get-bug-error"}, function(err){
			$scope.bugError = err;
			$scope.$digest();
		});
	}
}]);

app.run(["$rootScope", function($rootScope){
	// 汇报页面报错信息
	window.addEventListener("error", function(e){
		$rootScope.$broadcast("error", e);
	});
}]);

app.factory("storage", function(){
	return {
		get: getStorage,
		set: setStorage
	};

	function getStorage(keys){
		return new Promise(function(resolve, reject){
			chrome.storage.local.get(keys || storageKeys, function(data){
				data ? resolve(data) : reject();
			});
		});
	}

	function setStorage(data){
		return new Promise(function(resolve, reject){
			chrome.storage.local.set(data, function(e){
				e ? reject(e) : resolve();
			});
		});
	}
});