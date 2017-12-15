/* global require, Promise, Buffer */
var gulp = require("gulp"),
	minify = require("gulp-uglify"),
	htmlmin = require("gulp-html-minifier2"),
	livereload = require("gulp-livereload"),
	iife = require("gulp-iife"),
	buffer = require("gulp-buffer"),
	sourcemaps = require("gulp-sourcemaps"),
	through2 = require("through2"),
	fs = require("fs-extra"),
	del = require("del"),
	crypto = require("crypto");

gulp.task("build-popup.html", function(){
	gulp.src("src/popup.html").pipe(htmlmin({
		removeComments: true,
		removeCommentsFromCDATA: true,
		collapseWhitespace: true
	})).pipe(through2.obj(function(file, enc, callback){
		var text = file.contents.toString();
		text = text.replace("js/angular.js", "js/angular.min.js");
		file.contents = new Buffer(text);
		callback(null, file);
	})).pipe(gulp.dest("dist"));
});

gulp.task("copy-static", function() {
	gulp.src("src/img/*").pipe(gulp.dest("dist/img"));
	gulp.src("src/css/*").pipe(gulp.dest("dist/css"));
	gulp.src("src/js/angular.min.js").pipe(gulp.dest("dist/js"));
});

gulp.task("build-popup.js", function(){
	return minifyJS(gulp.src("src/js/popup.js"), "dist/js");
});

// eslint-disable-next-line max-len
gulp.task("build", ["copy-static", "build-popup.js", "build-popup.html"], function(){
	var manifest = fs.readJsonSync("src/manifest.json");
	// remove livereload.js
	manifest.background.scripts.pop();
	fs.writeJsonSync("dist/manifest.json", manifest);
	return minifyJS(gulp.src("src/js/background.js"), "dist/js");
});

gulp.task("reload", function(){
	return gulp.src("src/manifest.json").pipe(livereload());
});

gulp.task("watch", function() {
	livereload.listen();
	gulp.watch([
		"src/js/*.js",
		"src/css/*.css",
		"src/*.html",
		"src/manifest.json"
	], ["reload"]);
});

gulp.task("clean", function(){
	del.sync("dist/**/*");
});

gulp.task("default", ["watch"]);


function minifyJS(sourceStream, outputDir) {
	var hash;
	var today = (new Date).toISOString().substr(0, 10);
	return sourceStream.pipe(buffer())
	.pipe(through2.obj(function(file, enc, callback){
		// get hash for later use
		var md5 = crypto.createHash("md5");
		md5.update(file.contents);
		hash = md5.digest("hex").substr(0, 6);
		// 原样返回
		callback(null, file);
	}))
	.pipe(iife())
	.pipe(sourcemaps.init())
	.pipe(minify())
	.pipe(sourcemaps.write("../../sourcemaps/" + today, {
		sourceMappingURL: function(file){
			// 这是我的开发机，生成的 sourcemap 将保存在这个地方
			// 启动 sourcemap 静态文件服务器的时候直接在项目根目录执行 hs
			// TODO: 导出 host, port 为配置 ？
			var baseurl = "http://172.16.133.110:8080";
			var dir = "sourcemaps/" + today;
			var filename = file.relative;
			filename = filename.replace(/\.js$/i, "." + hash + ".js.map");
			return [baseurl, dir, filename].join("/");
		}
	})).pipe(through2.obj(function(file, enc, callback){
		// sourcemaps.write 之后，gulp stream 中除了 xx.js 还会有 xx.js.map
		// 如果是 sourcemap，重定向路径到项目的 sourcemaps 目录下备份
		if(!/\.js$/i.test(file.relative)) {
			var suffix = "." + hash + ".js.map";
			file.path = file.path.replace(/\.js\.map$/i, suffix);
		}
		callback(null, file);
	}))
	.pipe(gulp.dest(outputDir));
}