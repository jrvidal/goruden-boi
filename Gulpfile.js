/* eslint-env node */

'use strict';

var gulp = require('gulp'),
    marked = require('gulp-marked'),
    Transform = require('stream').Transform,
    del = require('del'),
    docco = require('docco'),
    path = require('path'),
    renderer;

gulp.task('src.clean', del.bind(null, 'src/'));

gulp.task('src', ['src.clean'], function () {
    parseToSource(gulp.src('lit/**/*.md'));
});

gulp.task('docco.clean', del.bind(null, 'docs/'));

gulp.task('docco', ['docco.clean'], function () {
    parseToDocs(gulp.src('lit/**/*.md'));
});


gulp.task('watch', function () {

    gulp.watch('lit/**/*.md', function (e) {
        if (e.type === 'deleted') return;
        var source = gulp.src(e.path, {base: 'lit/'});

        parseToDocs(source);
        // The marked plugin messes with the file stream, so we keep it last
        parseToSource(source);
    });
});

gulp.task('default', ['src', 'docco', 'watch']);

function parseToSource(files) {
    files
        .pipe(marked({
            renderer: renderer
        }))
        .pipe(stripExt())
        .pipe(gulp.dest('src/'));
}

function parseToDocs(files) {
    files
        .pipe(doccoStream());
}

renderer = (function () {
    var noop = [
        'blockquote', 'html', 'heading', 'hr', 'list', 'listitem', 'paragraph',
        'table', 'tablerow', 'tablecell', 'strong', 'em', 'codespan', 'br',
        'del', 'link', 'image'
    ].reduce(function (acc, method) {
        acc[method] = function () {return '';};
        return acc;
    }, {});

    noop.code = function (code) {return code + '\n\n';};
    return noop;
})();

function stripExt() {
    var stream = new Transform({
        objectMode: true
    });

    stream._transform = function (file, encoding, cb) {
        file = file.clone();
        file.path = file.path.match(/^(.+)\.html$/)[1];
        cb(null, file);
    };

    return stream;
}

function doccoStream() {
    var stream = new Transform({
        objectMode: true
    });

    stream._transform = function (file, encoding, cb) {
        docco.document({
            languages: require('./langs.json'),
            args: [file.path],
            output: path.join('docs', path.dirname(file.path.match(/lit\/(.+)/)[1]))
        }, cb);
    };

    return stream;
}
