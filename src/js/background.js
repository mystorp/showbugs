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
	// setVariables();
});

main();

function main(){
	loginBugfree().then(function(){
		loop();
		function loop(){
			getBugs().then(function(bugs){
				bugs = buglist = bugs.filter(function(bug){
					return bug["处理状态"] !== "Local Fix";
				});
				bugerror = null;
				var text = bugs.length === 0 ? "" : bugs.length + "";
				chrome.browserAction.setBadgeText({text: text})
				if(bugs.length === 0) {
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
				bugerror = e.toString();
				// 报错后继续运行
				setTimeout(loop, 1000 * 60 * 3);
			});
		}
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
				rowObj[cell.innerText] = cells[i].getAttribute("title") || cells[i].innerText;
			});
			bugs.push(rowObj);
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
			var url = e.target.responseURL;
			if(url.indexOf("bugfree/index.php/bug/list/1") > -1) {
				resolve();
			} else {
				reject(new Error("unknow error"));
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
