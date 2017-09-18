(function(){
var bugServerUrl;
var bugServerType;

var storageKeys = [
	"server",
	"type",
	"username",
	"password"
];

// 每 3 分钟更新一下 bug 列表
var buglist;
var bugerror;

chrome.runtime.onMessage.addListener(function(msg, sender, callback){
	switch(msg.cmd) {
		case "get-bug-list":
			callback(buglist ? buglist : []);
			break;
		case "get-bug-error":
			callback(bugerror || "");
			break;
		case "open-bug":
			getVariables().then(function(data){
				chrome.tabs.create({url: data.server + "/bugfree/index.php/bug/" + msg.id});
			});
			break;
		case "open-bugfree":
			getVariables().then(function(data){
				chrome.tabs.create({url: data.server + "/bugfree/index.php/bug/list/1?query_id=-2"});
			});
			break;
		case "bug-detail":
			getBugDetail(msg.id, callback);
			return true;
		case "reload":
			chrome.runtime.reload();
			break;
		case "error":
			console.error("error from popup:");
			console.error(msg.error);
		break;
	}
});

chrome.storage.onChanged.addListener(function(changes, area){
	if(area !== "local") { return; }
	console.log("storage changed:", changes);
});

main();

function main(){
	loginBugfree().then(function(){
		loop();
		function loop(){
			getBugs().then(function(bugs){
				// bugs = buglist = bugs.filter(function(bug){
				// 	return bug["处理状态"] !== "Local Fix";
				// });
				buglist = bugs;
				bugerror = null;
				var bugLength = bugs.filter(function(bug){
					return bug["处理状态"] !== "Local Fix";
				}).length;
				var text = bugLength === 0 ? "" : bugLength + "";
				chrome.browserAction.setBadgeText({text: text})
				if(bugLength === 0) {
					// 没有 bug
					chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 0]});
				} else {
					// 有 bug，标红
					chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 255]});
				}
				setTimeout(loop, 1000 * 60 * 3);
			}).catch(function(e){
				chrome.browserAction.setBadgeText({text: "err"});
				chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 255]});
				buglist = [];
				if(e instanceof XMLHttpRequest) {
					bugerror = "请求失败";
				} else {
					bugerror = e.toString();
				}
				// 报错从头开始运行
				setTimeout(main, 1000 * 60 * 5);
			});
		}
	}).catch(function(){
		setTimeout(main, 1000 * 60 * 5);
	});
}

var bugDataCache = {};
function getBugDetail(id, callback){
	getVariables().then(function(data){
		var url = data.server + "/bugfree/index.php/bug/" + id;
		if(bugDataCache.hasOwnProperty(url)) {
			return Promise.resolve(bugDataCache[url]);
		}
		get(url).then(function(data){
			bugDataCache[url] = data;
			callback(data);
		}).catch(callback);
	});
}

function getBugs(){
	var bugServer;
	var bugUrl = "/bugfree/index.php/bug/list/1?query_id=-2";
	return getVariables().then(function(data){
		return new Promise(function(resolve, reject){
			bugServer = data.server;
			ajax({
				url: data.server + bugUrl,
				dataType: 'text',
				success: resolve,
				error: reject
			});
		});
	}).then(function(html){
		var parser = new DOMParser();
		var doc = parser.parseFromString(html, "text/html");
		var result = doc.querySelector("#SearchResultDiv");
		var rows = result.firstElementChild.rows;
		var bugs = [];
		var headCells = [].slice.call(rows[0].cells, 0);
		var cells, rowObj;
		for(var i = 1, len = rows.length; i < len; i++) {
			cells = rows[i].cells;
			rowObj = {};
			headCells.forEach(function(cell, i){
				if(!cells[i]) { return; }
				if(cells[i].className === "title") {
					rowObj[cell.innerText] = cells[i].querySelector("a").getAttribute("title");
				} else {
					rowObj[cell.innerText] = cells[i].innerText;
				}
			});
			if(rowObj.hasOwnProperty("ID")) {
				bugs.push(rowObj);
			}
		}
		return bugs;
	});
}

function getVariables() {
	return new Promise(function(resolve, reject){
		chrome.storage.local.get(storageKeys, function(obj){
			obj ? resolve(obj) : reject();
		});
	});
}


function loginBugfree(){
	var loginUrl = "/bugfree/index.php/site/login";
	var paramMap = {
		"LoginForm[username]": "username",
		"LoginForm[password]": "password"
	};
	return getVariables().then(function(data){
		var formdata = new FormData();
		for(var key in paramMap) {
			formdata.append(key, data[paramMap[key]]);
		}
		formdata.append("LoginForm[language]", "zh_cn");
		return submitForm(data.server + loginUrl, formdata);
	});
}


function submitForm(url, formdata){
	return new Promise(function(resolve, reject){
		var xhr = new XMLHttpRequest();
		xhr.open("POST", url);
		xhr.send(formdata);
		xhr.addEventListener("load", function(e){
			var status = e.target.status;
			var statusText = e.target.statusText;
			if(status === 200) {
				resolve();
			} else {
				reject(new Error(statusText));
			}
		});
		xhr.addEventListener("error", reject);
		xhr.addEventListener("timeout", reject);
	});
}

function get(url) {
	return new Promise(function(resolve, reject){
		ajax({
			url: url,
			success: resolve,
			error: reject
		});
	});
}

function post(url, data) {
	return new Promise(function(resolve, reject){
		ajax({
			url: url,
			type: "POST",
			data: data,
			success: resolve,
			error: reject
		});
	});
}
})();
