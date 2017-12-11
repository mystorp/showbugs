var bugServerOrigin;
var bugServerType; // eslint-disable-line no-unused-vars
var bugServerUsername;
var bugServerPassword;

var pluginReady = false;
var pluginReadyCallbacks = [];

var restartInterval = 5 * 60 * 1000;    // 发生错误导致重启整个流程间隔
var refreshBugInterval = 3 * 60 * 1000; // bug 列表刷新间隔

var storageKeys = [
	"server",
	"type",
	"username",
	"password"
];

var buglist = [];
var bugerror;
var loopTimer;
var bugDetailCache = {}; // 缓存 bug 详细信息

// 接收来自 popup 的消息
chrome.runtime.onMessage.addListener(function(msg, sender, callback){
	if(!pluginReady) {
		return callback(new Error("plugin not ready now"));
	}
	switch(msg.cmd) {
		case "get-bug-list":
			callback(buglist ? buglist : []);
			break;
		case "get-bug-error":
			callback(bugerror || "");
			break;
		case "open-bug":
			chrome.tabs.create({
				url: bugServerOrigin + "/bugfree/index.php/bug/" + msg.id
			});
			break;
		case "open-bugfree":
			chrome.tabs.create({
				// eslint-disable-next-line max-len
				url: bugServerOrigin + "/bugfree/index.php/bug/list/1?query_id=-2"
			});
			break;
		case "bug-detail":
			getBugDetail(msg.id, callback);
			return true;
		case "test-ready":
			if(pluginReady) {
				callback(true);
			} else {
				pluginReadyCallbacks.push(callback);
				return true;
			}
			break;
		case "reload":
			chrome.runtime.reload();
			break;
		case "error":
			console.error("error from popup:");
			console.error(msg.error);
			break;
	}
});

// 监听 storage
chrome.storage.onChanged.addListener(function(changes, area){
	if(area !== "local") {
		return; 
	}
	clearTimeout(loopTimer);
	main();
});

// 监听通知点击
chrome.notifications.onClicked.addListener(function(id){
	// clear first
	chrome.notifications.clear(id);
	var bugId = id.split("-").pop();
	var bug = buglist.filter(function(bug){
		return bug.ID === bugId;
	})[0];
	if(!bug) {
		return; 
	}
	chrome.tabs.create({
		url: bugServerOrigin + "/bugfree/index.php/bug/" + bug.ID
	});
});

main();


function main(){
	getVariables().then(function(obj){
		if(obj.server && obj.username && obj.password) {
			return obj;
		} else {
			throw "no user registered!";
		}
	}).then(function(obj){
		bugServerOrigin = obj.server;
		bugServerType = obj.type;
		bugServerUsername = obj.username;
		bugServerPassword = obj.password;
		return loginBugfree();
	}).then(function(){
		var errorCount = 0; // 错误
		pluginReady = true;
		bugerror = "";
		triggerReadyCallbacks();
		loop();
		function loop(){
			getBugs().then(function(bugs){
				bugs = updateBugCache(bugs);
				updateBadgeText(bugs);
				loopTimer = setTimeout(loop, refreshBugInterval);
			}).catch(function(e){
				bugerror = e.message;
				updateBadgeText(e);
				errorCount++;
				// 连续两次无法获取bug信息，清空 bug 列表，并从头开始运行
				if(errorCount >= 2) {
					pluginReady = false;
					updateBugCache([]);
					loopTimer = setTimeout(main, restartInterval);
				} else {
					loopTimer = setTimeout(loop, refreshBugInterval);
				}
			});
		}
	}).catch(function(err){
		if(err instanceof Error) {
			bugerror = err.message;
			console.error(err.message);
		}
		// 任何报错后，5分钟后重试
		loopTimer = setTimeout(main, restartInterval);
	});
}

function getBugDetail(id, callback){
	var url = bugServerOrigin + "/bugfree/index.php/bug/" + id;
	if(bugDetailCache.hasOwnProperty(url)) {
		return Promise.resolve(bugDetailCache[url]);
	}
	return (new Promise(function(resolve, reject){
		ajax("GET", url, function(err, data){
			if(err) {
				reject(err);
			} else {
				resolve(data);
			}
		})(function(xhr){
			xhr.responseType = "document";
		});
	})).then(function(doc){
		var detail = {
			"Bug标题": doc.querySelector("#BugInfoView_title").value,
			"模块路径": doc.querySelector("#BugInfoView_module_name").value,
			// eslint-disable-next-line max-len
			"复现步骤": doc.querySelector("#fieldset_step .row").innerText.trim().replace(/\n{2,}/g, "\n")
		};
		var imgs = doc.querySelectorAll("#uploaded_file a");
		imgs = [].map.call(imgs, function(a){
			return {
				url: bugServerOrigin + a.getAttribute("href"),
				text: a.innerText,
				visible: false
			};
		});
		detail["附件"] = imgs;
		bugDetailCache[url] = detail;
		callback(detail);
		return detail;
	});
}

function getBugs(){
	var bugUrl = bugServerOrigin + "/bugfree/index.php/bug/list/1?query_id=-2";
	return (new Promise(function(resolve, reject){
		ajax("GET", bugUrl, function(err, data){
			if(err) {
				reject(err);
			} else {
				resolve(data);
			}
		})(function(xhr){
			// 指定返回为 document，避免手动解析
			xhr.responseType = "document";
		});
	})).then(function(doc){
		var result = doc.querySelector("#SearchResultDiv");
		var rows = result.firstElementChild.rows;
		var bugs = [];
		var headCells = [].slice.call(rows[0].cells, 0);
		var cells, rowObj;
		for(var i = 1, len = rows.length; i < len; i++) {
			cells = rows[i].cells;
			rowObj = {};
			headCells.forEach(function(cell, i){
				if(!cells[i]) {
					return; 
				}
				if(cells[i].className === "title") {
					// eslint-disable-next-line max-len
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
	var loginUrl = bugServerOrigin + "/bugfree/index.php/site/login";
	var formdata = new FormData();
	formdata.append("LoginForm[username]", bugServerUsername);
	formdata.append("LoginForm[password]", bugServerPassword);
	formdata.append("LoginForm[language]", "zh_cn");
	return new Promise(function(resolve, reject){
		ajax("POST", loginUrl, function(err, data){
			if(err) {
				reject(err);
			} else {
				resolve(data);
			}
		})(formdata);
	});
}

function updateBadgeText(bugs) {
	var badgeText;
	var color;
	if(bugs instanceof Error) { // 插件报错了，标红
		badgeText = "err";
		color = "#e91e63";
	} else {
		var bugCount = bugs.length;
		var notFixCount = bugs.filter(function(bug){
			return bug["处理状态"] !== "Local Fix";
		}).length;
		// 所有的 bug 都修复了
		if(notFixCount === 0) {
			// 当前没有 bug，透明
			if(bugCount === 0) {
				badgeText = "";
				color = [0, 0, 0, 0];
			} else {
				// 有 bug，但是都修复了，标绿
				badgeText = bugCount + "";
				color = "#8bc34a";
			}
		} else { // 有未修复的 bug，标红
			badgeText = notFixCount + "";
			color = "#e91e63";
		}
	}
	chrome.browserAction.setBadgeText({text: badgeText});
	chrome.browserAction.setBadgeBackgroundColor({color: color});
}

function updateBugCache(bugs) {
	bugs = bugs.filter(function(bug){
		return bug["解决方案"] === "";
	});
	var oldBugsMap = {};
	var newBugs = []; // 相对于上一次来说，新增加的 bug
	buglist.forEach(function(bug){
		oldBugsMap[bug.ID] = bug;
	});
	bugs.forEach(function(bug){
		if(!oldBugsMap.hasOwnProperty(bug.ID)) {
			newBugs.push(bug);
		}
	});
	var fieldMissing = false;
	newBugs.forEach(function(bug){
		if(bug["处理状态"]) {
			if(bug["处理状态"] !== "Local Fix") {
				showBugNotification(bug);
			}
		} else {
			fieldMissing = true;
		}
	});
	if(fieldMissing) {
		showNotification(
			"showbugs-ignore",
			"无法获取 bug 的\"处理状态\"列信息",
			"请在 bugfree 中添加此列，没有此列，插件不能及时向你通知新 bug"
		);
	}
	buglist = bugs;
	return bugs;
}

function triggerReadyCallbacks(){
	var arr = pluginReadyCallbacks;
	var fn;
	while(arr.length > 0) {
		try {
			fn = arr.shift();
			fn();
		} catch(e) {
			console.log("ready callback error:", e);
		}
	}
}

function showBugNotification(bug){
	showNotification("showbugs-" + bug.ID, "亲，你有新 bug 啦！", bug["Bug标题"]);
}

function showNotification(id, title, message){
	chrome.notifications.create(id, {
		type: "basic",
		iconUrl: "../img/logo.png",
		title: title,
		message: message
	});
}

function ajax(method, url, onResponse) {
	var xhr = new XMLHttpRequest();
	xhr.open(method, url);
	if(typeof onResponse === "function") {
		xhr.addEventListener("load", function(e){
			onResponse(null, e.target.response);
		});
		xhr.addEventListener("error", onResponse);
		xhr.addEventListener("timeout", onResponse);
	}
	return function(arg){
		var data = null;
		var type = Object.prototype.toString.call(arg);
		type = type.replace("[object ", "").replace("]", "");
		/* eslint-disable max-len */
		switch(type) {
			// 这些类型的数据是可以直接发送的
			// 参考：https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/send
			case "String":
			case "FormData":
			case "Blob":
			case "ArrayBuffer":
			case "Uint8Array":
			case "Uint8ClampedArray":
			case "Int16Array":
			case "Uint16Array":
			case "Int32Array":
			case "Uint32Array":
			case "Float32Array":
			case "Float64Array":
			case "DataView":
			case "URLSearchParams":
				data = arg;
				break;
			case "Object":
			case "Array":
				data = JSON.stringify(arg);
				break;
			// 允许接收一个 function, 自定义操作
			case "Function":
				arg.call(xhr, xhr);
				break;
		}
		xhr.send(data ? data : null);
	};
}