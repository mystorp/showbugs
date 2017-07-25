var storageKeys = [
	"server",
	"type",
	"username",
	"password"
];
var app = angular.module("BugApp", []);

app.controller("SetupController", ["$scope", "storage", "$rootScope", function($scope, storage, $rootScope){
	$scope.server = "192.168.0.4:8011";

	// 异步操作，完成后手动 .$digest()
	storage.get().then(function(data){
		if(data) {
			angular.extend($scope, data);
		}
		$scope.$digest();
	}, function(e){
		$scope.error = e.message;
		$scope.$digest();
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

		// 异步操作，完成后手动 .$digest()
		storage.set(values).then(function(){
			$rootScope.$apply('page = "buglist"');
			chrome.runtime.sendMessage({cmd: "reload"});
		}, function(e){
			$scope.$apply('error = e.message');
		});
	};

	$scope.$on("error", function(e_, e){
		$scope.error = e.message
	});
}]);

app.controller("BugController", ["$scope", "$interval", "storage", function($scope, $interval, storage){
	$scope.bugs = [];
	$scope.columns = ["ID", "Bug标题", "修改日期", "模块路径", "严重程度", "优先级", "创建者", "指派者", "解决者", "解决方案", "处理状态", "附件", "复现步骤"];

	getBugList();
	getBugError();

	$scope.openBug = function(id){
		chrome.runtime.sendMessage({cmd: 'open-bug', id: id});
	};

	$scope.openBugfree = function(){
		chrome.runtime.sendMessage({cmd: "open-bugfree"});
	}
	
	$scope.setBugIndex = function(index){
		var bug;
		$scope.bugIndex = index;
		$scope.bugs.forEach(function(b){
			if(b.ID === index) {
				bug = b;
			}
		});
		if(bug.hasOwnProperty("模块路径")) { return; }
		chrome.runtime.sendMessage({cmd: "bug-detail", id: index}, function(data){
			if(!data) { return; }
			var parser = new DOMParser();
			var doc = parser.parseFromString(data, "text/html");
			angular.extend(bug, {
				"Bug标题": doc.querySelector("#BugInfoView_title").value,
				"模块路径": doc.querySelector("#BugInfoView_module_name").value,
				"复现步骤": doc.querySelector("#fieldset_step .row").innerText.trim().replace(/\n{2,}/g, "\n")
			});
			var imgs = doc.querySelectorAll("#uploaded_file a");
			imgs = [].map.call(imgs, function(a){
				return {url: a.getAttribute("href"), text: a.innerText, visible: false};
			});
			storage.get().then(function(data){
				imgs.forEach(function(o){
					o.url = data.server + o.url;
				});
				bug["附件"] = imgs;
				$scope.$digest();
			});
		});
	};

	$scope.isSpectialColumn = function(name){
		return ["ID", "附件", "复现步骤"].indexOf(name) > -1;
	};

	// var timer = $interval(function(){
	// 	getBugList();
	// 	getBugError();
	// }, 2000);

	$scope.$on("$destroy", function(){
		$interval.cancel(timer);
	});
	function getBugList(){
		chrome.runtime.sendMessage({cmd: "get-bug-list"}, function(bugs){
			$scope.bugs = bugs;
			if($scope.hasOwnProperty("bugIndex")) {
				var exsits = false;
				bugs.forEach(function(bug){
					if(bug.ID === $scope.bugIndex) {
						exsits = true;
					}
				});
				if(!exsits && bugs.length > 0) {
					$scope.setBugIndex(bugs[0].ID);
				}
			} else {
				if(bugs.length > 0) {
					$scope.setBugIndex(bugs[0].ID);
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

app.run(["$rootScope", "storage", "isSetuped", function($rootScope, storage, isSetuped){
	// 根据是否有存储的数据来判断显示哪个界面
	storage.get().then(function(data){
		if(isSetuped(data)) {
			$rootScope.$apply("page = 'buglist'");
		} else {
			$rootScope.$apply("page = 'setup'");
		}
	}, function(e){
		$scope.error = e.message;
		$rootScope.$digest();
	});
	// 汇报页面报错信息
	window.addEventListener("error", function(e){
		$rootScope.$broadcast("error", e);
	});
}]);

app.factory("storage", function(){
	var cache;
	return {
		get: getStorage,
		set: setStorage
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
