var bugServerUrl;
var bugServerType;

var storageKeys = [
	"bug-server-url",
	"bug-server-type",
	"username",
	"password"
];

// 每 3 分钟更新一下 bug 列表
var buglist;

chrome.runtime.onMessage.addListener(function(msg, sender, callback){
	switch(msg.cmd) {
		case "get-bug-list":
			callback(buglist ? buglist : []);
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
				buglist = bugs;
				var text = bugs.length === 0 ? "" : bugs.length + "";
				chrome.browserAction.setBadgeText({text: text})
				if(bugs.length === 0) {
					chrome.browserAction.setBadgeBackgroundColor({color: [255,0,0,255]});
				} else {
					chrome.browserAction.setBadgeBackgroundColor({color: [255,0,0,0]});
				}
				setTimeout(loop, 1000 * 60 * 3);
			}).catch(function(e){
				chrome.browserAction.setBadgeText({text: "e"});
				chrome.browserAction.setBadgeBackgroundColor({color: [255,255,0,255]});
				buglist = [];
				console.log(e);
			});
		}
	});
}

function getBugs(){
	var bugServer;
	var bugUrl = "/bugfree/index.php/bug/list/1?query_id=-2";
	return getVariables().then(function(data){
		return new Promise(function(resolve, reject){
			bugServer = data["bug-server-url"];
			ajax({
				url: data["bug-server-url"] + bugUrl,
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
				rowObj[cell.innerText] = cells[i].innerText;
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
		return submitForm(data["bug-server-url"] + loginUrl, formdata);
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
