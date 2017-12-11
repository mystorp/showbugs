var storageKeys = [
	"server",
	"type",
	"username",
	"password"
];
var app = angular.module("BugApp", []);

app.controller("SetupController", SetupController);

app.controller("BugController", BugController);

app.run(onModuleRun);

app.factory("storage", function(){
	var cache;
	return {
		get: getStorage,
		set: setStorage,
		clear: clearStorage
	};

	function getStorage(keys){
		if(cache) {
			return Promise.resolve(cache);
		}
		return new Promise(function(resolve, reject){
			chrome.storage.local.get(keys || storageKeys, function(data){
				cache = data;
				data ? resolve(data) : reject();
			});
		});
	}

	function setStorage(data){
		return new Promise(function(resolve, reject){
			cache = null;
			chrome.storage.local.set(data, function(e){
				e ? reject(e) : resolve();
			});
		});
	}

	function clearStorage(){
		return new Promise(function(resolve, reject){
			chrome.storage.local.clear(function(err){
				err ? reject(err) : resolve();
			});
		});
	}
});

app.factory("isSetuped", function(){
	return function(data){
		var valid = true;
		angular.forEach(storageKeys, function(key){
			if(!data.hasOwnProperty(key)) {
				valid = false;
			}
		});
		return valid;
	};
});

function SetupController($scope, storage, $rootScope){
	var defaults = {
		server: "172.16.203.11:8011",
		type: "bugfree"
	};

	// 异步操作，完成后刷新 scope
	storage.get().then(function(data){
		if(data) {
			angular.extend($scope, defaults, data);
		}
		$scope.$apply();
	}, function(e){
		$scope.error = e.message;
		$scope.$apply();
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
			chrome.runtime.sendMessage({cmd: "test-ready"}, function(){
				$scope.loading = false;
				$rootScope.$apply(function(scope){
					scope.page = "buglist";
				});
			});
		}).catch(function(e){
			$scope.$apply(function(scope){
				scope.error = e.message;
			});
		});
		$scope.loading = true;
	};

	$scope.onKeydown = function(e){
		if(e.keyCode === 13 && $scope.setupForm.$valid) {
			this.saveSetup();
		}
	};

	$scope.$on("error", function(e_, e){
		$scope.error = e.message
	});
}

SetupController.$inject = ["$scope", "storage", "$rootScope"];

function BugController($scope, $timeout, storage){
	$scope.ignoreLocalFix = false;
	$scope.bugs = [];
	$scope.columns = [
		"ID", "Bug标题", "修改日期", "模块路径", "严重程度", "优先级",
		"创建者", "指派者", "解决者", "解决方案", "处理状态", "附件", "复现步骤"
	];

	

	$scope.openBug = function(id){
		chrome.runtime.sendMessage({cmd: "open-bug", id: id});
	};

	$scope.openBugfree = function(){
		chrome.runtime.sendMessage({cmd: "open-bugfree"});
	};

	$scope.reloadExtension = function(){
		chrome.runtime.sendMessage({cmd: "reload"});
	};
	
	$scope.setBugIndex = function(index){
		var bug;
		$scope.bugIndex = index;
		$scope.bugs.forEach(function(b){
			if(b.ID === index) {
				bug = b;
			}
		});
		// 已经获取过详细信息了
		if(bug.hasOwnProperty("模块路径")) {
			return; 
		}
		chrome.runtime.sendMessage({
			cmd: "bug-detail",
			id: index
		}, function(data){
			if(!data || data instanceof Error) {
				return; 
			}
			angular.extend(bug, data);
			$scope.$apply();
		});
	};

	$scope.isSpectialColumn = function(name){
		return ["ID", "附件", "复现步骤"].indexOf(name) > -1;
	};

	$scope.toggleLocalFix = function(v){
		var bugs = $scope.originalBugs || $scope.bugs;
		var filteredBugs = bugs.filter(function(bug){
			var isfix = bug["处理状态"] === "Local Fix";
			return isfix !== v;
		});
		$scope.originalBugs = bugs;
		$scope.bugs = filteredBugs;
		if($scope.originalBugs.length === $scope.bugs.length) {
			delete $scope.originalBugs;
		}
	};

	$scope.isLocalFix = function(bug) {
		return bug["处理状态"] === "Local Fix";
	};

	$scope.resetStorage = function(){
		storage.clear().then(function(){
			chrome.runtime.sendMessage({cmd: "reload"});
		});
	};

	loop();

	function loop() {
		getBugList();
		getBugError();
		$timeout(loop, 2000);
	}

	function getBugList(){
		chrome.runtime.sendMessage({cmd: "get-bug-list"}, function(bugs){
			var bugMap = {};
			var newBugs = [];
			angular.forEach($scope.bugs, function(bug){
				// 标记 bug 为不存在，合并新 bug 数据后删除此标记
				bug.exsits = false;
				bugMap[bug.ID] = bug;
			});
			angular.forEach(bugs, function(bug){
				if(bugMap.hasOwnProperty(bug.ID)) {
					bug.exsits = true;
					angular.extend(bugMap[bug.ID], bug);
				} else {
					newBugs.push(bug);
				}
			});
			$scope.bugs = $scope.bugs.filter(function(bug){
				var exsits = bug.exsits;
				delete bug.exsits;
				return exsits;
			}).concat(newBugs);
			// 自动显示第一个 bug
			if(!$scope.hasOwnProperty("bugIndex") && $scope.bugs.length > 0) {
				$scope.setBugIndex($scope.bugs[0].ID);
			}
			$scope.$apply();
		});
	}
	function getBugError(){
		chrome.runtime.sendMessage({cmd: "get-bug-error"}, function(err){
			$scope.bugError = err;
			$scope.$apply();
		});
	}
}

BugController.$inject = ["$scope", "$timeout", "storage"];

function onModuleRun($rootScope, storage, isSetuped){
	// 根据是否有存储的数据来判断显示哪个界面
	storage.get().then(function(data){
		$rootScope.$apply(function(scope){
			scope.page = isSetuped(data) ? "buglist" : "setup";
		});
	}).catch(function(err){
		console.error("unexpected error", err);
	});
	// 汇报页面报错信息
	window.addEventListener("error", function(e){
		$rootScope.$broadcast("error", e);
	});
}

onModuleRun.$inject = ["$rootScope", "storage", "isSetuped"];