const gulp = require('gulp');
const autoprefixer = require('gulp-autoprefixer');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const plumber = require('gulp-plumber');

const sassInput = './stylesheets/*.scss';
const sassOptions = {
  includePaths: ['node_modules/foundation-sites/scss','node_modules/@fortawesome/fontawesome-free/scss'],
  errLogToConsole: true,
  outputStyle: 'expanded'
}

function styles() { 
  return gulp.src(sassInput)
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(sass(sassOptions).on('error', sass.logError))
    .pipe(autoprefixer())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./public/css'));
};
exports.styles = styles;

function fonts() {
  return gulp.src('node_modules/@fortawesome/fontawesome-free/webfonts/**.*')
    .pipe(gulp.dest('./public/webfonts'));
}
exports.fonts = fonts;

function watching() {
  gulp.watch(sassInput, sass);
}
exports.watching = watching;

exports.dev = gulp.series(gulp.parallel(styles,fonts), watching);
exports.default = gulp.parallel(styles, fonts);
