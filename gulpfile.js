/* global require, Promise, Buffer */
var gulp = require("gulp"),
	minify = require("gulp-uglify"),
	htmlmin = require("gulp-html-minifier2"),
	livereload = require("gulp-livereload"),
	iife = require("gulp-iife"),
	through2 = require("through2"),
	fs = require("fs-extra"),
	del = require("del");

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
	gulp.src("src/js/popup.js")
		.pipe(iife())
		.pipe(minify())
		.pipe(gulp.dest("dist/js"));
});

// eslint-disable-next-line max-len
gulp.task("build", ["copy-static", "build-popup.js", "build-popup.html"], function(){
	var manifest = fs.readJsonSync("src/manifest.json");
	// remove livereload.js
	manifest.background.scripts.pop();
	fs.writeJsonSync("dist/manifest.json", manifest);
	return gulp.src("src/js/background.js")
		.pipe(iife())
		.pipe(minify())
		.pipe(gulp.dest("dist/js"));
});

gulp.task("reload", function(){
	gulp.src("src/manifest.json").pipe(livereload());
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
