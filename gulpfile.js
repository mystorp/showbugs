var gulp = require('gulp'),
	concat = require('gulp-concat'),
	minify = require("gulp-uglify"),
	livereload = require('gulp-livereload'),
	fs = require('fs-extra'),
	path = require("path"),
	del = require("del");

gulp.task('copy-static', function() {
	gulp.src("src/logo128.png").pipe(gulp.dest("dist"));
	gulp.src("src/imgs/*").pipe(gulp.dest("dist/imgs"));
	gulp.src("src/css/*").pipe(gulp.dest("dist/css"));
});

gulp.task("build", ["copy-static"], function(){
	var manifest = fs.readJsonSync("src/manifest.json");
	var arr = [];
	var distBgJs = "js/bg.js";
	arr.push(buildBackground(manifest.background.scripts, distBgJs));
	manifest.background.scripts = [distBgJs];
	manifest.content_scripts.forEach(function(conf, i){
		var bundle = "js/cs" + i + ".js";
		arr.push(buildContentScript(conf.js, bundle));
		conf.js = [bundle];
	});
	fs.writeJsonSync("dist/manifest.json", manifest);
	return Promise.all(arr);
});

gulp.task("reload", function(){
	gulp.src("src/manifest.json").pipe(livereload());
});

gulp.task('watch', function() {
	livereload.listen();
	gulp.watch(['src/js/*.js', 'src/css/*.css', 'src/manifest.json'], ['reload']);
});

gulp.task("clean", function(){
	del.sync("dist/**/*");
});

gulp.task("default", ["watch"]);

function buildScripts(files, tofile){
	var obj = path.parse("dist/" + tofile);
	files = files.map(function(f){
		return "src/" + f;
	});
	return new Promise(function(resolve, reject){
		var stream = gulp.src(files).pipe(concat(obj.base)).pipe(minify({
			toplevel: true,
			output: {
				wrap_iife: true
			}
		})).pipe(gulp.dest(obj.dir));
		stream.on("finish", resolve);
		stream.on("error", reject);
	});
}

function buildBackground(files, tofile) {
	// remove livereload.js
	files.pop();
	return buildScripts(files, tofile);
}

function buildContentScript(files, tofile) {
	return buildScripts(files, tofile);
}