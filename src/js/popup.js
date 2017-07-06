var storageKeys = [
	"bug-server-url",
	"bug-server-type",
	"username",
	"password"
];

window.addEventListener("error", function(e){
	chrome.runtime.sendMessage({cmd: "error", error: e});
});

Promise.all([getStorage(storageKeys), onLoadPromise()]).then(function(x){
	var data = x[0];
	if(data && data.hasOwnProperty(storageKeys[0])) {
		initBugTable();
	} else {
		initSetup();
		setFormValues(data);
	}
});

function onLoadPromise(){
	return new Promise(function(resolve, reject){
		window.addEventListener("load", function(){
			resolve();
		});
	});
}


function initSetup(){
	document.querySelector("#config-form").classList.remove("hide");
	document.querySelector("#saveConfig").addEventListener("click", function(){
		setStorage(getFormValues()).then(function(){
			showMessage("save success!");
		}, function(){
			showMessage("save failed!");
		});
	});
}

function initBugTable(){
	document.querySelector("#bug-table").classList.remove("hide");
	chrome.runtime.sendMessage({cmd: "get-bug-list"}, function(bugs){
		loadBugs(bugs);
	});
}

function loadBugs(bugs) {
	var htmls = [];
	var headers;
	bugs.forEach(function(row){
		if(!headers) {
			headers = Object.keys(row);
		}
		htmls.push('<tr>' + headers.map(function(x){
			if(x === "ID" || x === "Bug标题" && row.ID) {
				return '<td><a href="http://192.168.0.4:8011/bugfree/index.php/bug/' + row.ID + '">' + row[x] + '</a></td>';
			}
			return '<td>' + row[x] + '</td>';
		}).join("") + '</tr>');
	});
	headers && htmls.unshift('<thead><tr>' + headers.map(function(x){
			return '<th>' + x + '</th>';
		}).join("") + '</tr></thead>');
	if(htmls.length === 0) {
		htmls.push('<tr><td>没有 bug，你很棒棒的哦！</td></tr>');
	}
	document.querySelector("#bug-table").innerHTML = htmls.join("");
}

function getFormValues(){
	var form = document.querySelector("#config-form");
	var elements = [].slice.call(form.elements, 0);
	var config = {};
	elements.forEach(function(el){
		if(el.name) {
			config[el.name] = el.value.trim();
		}
	});
	return config;
}

function setFormValues(data){
	var form = document.querySelector("#config-form");
	var elements = [].slice.call(form.elements, 0);
	elements.forEach(function(el){
		var name = el.name;
		if(name && data.hasOwnProperty(name)) {
			el.value = data[name];
		}
	});
}

function getStorage(keys){
	return new Promise(function(resolve, reject){
		chrome.storage.local.get(keys, function(data){
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


function showMessage(msg){
	document.querySelector("#form-message").innerText = msg;
}