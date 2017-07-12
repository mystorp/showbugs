# showbugs

这是一个浏览器插件，用于显示 bugfree 上面 bug 数量（也有打算提供更多有用的功能），提醒开发者不要忘记 bugfree 上 bug 未修改。

插件和用户的交互主要在浏览器右上角插件图标上，点击图标会弹出交互界面。在交互界面中可以完成设置 bugfree 账户信息，查看 bug 信息等功能。

## 技术相关

本项目使用 angular1.6 + bootstrap3 实现。

开发时在项目根目录运行 `gulp watch` 将启动 livereload 服务器，每当修改代码并保存后，浏览器的插件会收到此消息并重新加载插件。

部署代码可以使用 `gulp build` 命令。

插件的逻辑主要体现在 `popup.html` 和 `background.js`.

`popup.html` 除了使用了 chrome 插件相关的 API 外，基本和普通的 html 页面无区别。当需要和插件后台交互时，使用 `chrome.runtime.sendMessage(msg, messageCallback)` 即可。

`background.js` 是插件的后台，它负责数据存储、命令交互和 bugfree 服务器交互等逻辑。