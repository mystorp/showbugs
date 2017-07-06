/**
 * Created by zhangyao on 2017/6/24.
 */

function connectServer(){
    var socket;
    try {
        socket = new WebSocket("ws://127.0.0.1:35729");
    } catch(e) {
        // ignore
    }
    ["open", "error", "close"].forEach(function(e){
        socket.addEventListener(e, function(){
            console.log("[event] " + e);
        });
    });
    socket.addEventListener("message", function(e){
        var data = JSON.parse(e.data);
        if(data.command === "reload") {
            reloadLater();
        }
    });

    socket.addEventListener("close", function(){
        console.log("reconnect after 1 min");
        setTimeout(connectServer, 1000 * 60);
    });
}
var reloadTimer;
function reloadLater(){
    if(reloadTimer) {
        clearTimeout(reloadTimer);
    }
    reloadTimer = setTimeout(function () {
        console.log("reload plugin");
        chrome.runtime.reload();
    }, 1000);
}

connectServer();