var gulp = require('gulp');
var autoprefixer = require('gulp-autoprefixer');
var sass = require('gulp-sass');

var sassInput = './stylesheets/*.scss';
var sassOptions = {
  includePaths: ['./node_modules/foundation-sites/scss','./node_modules/@fortawesome/fontawesome-free/scss' ],
  errLogToConsole: true,
  outputStyle: 'expanded'
};
var autoprefixerOptions = {
  browsers: ['last 2 versions', 'ie >= 9', 'Android >= 2.3', 'ios >= 7']
};

gulp.task('sass', function() {
  return gulp.src(sassInput)
    .pipe(sass(sassOptions).on('error', sass.logError))
    .pipe(autoprefixer(autoprefixerOptions))
    .pipe(gulp.dest('./public/css'));
});

gulp.task('icons', function() {
  return gulp.src('./node_modules/@fortawesome/fontawesome-free/webfonts/**.*')
    .pipe(gulp.dest('./public/webfonts'));
});

gulp.task('watch', function() {
  gulp.watch(sassInput, ['sass']);
});

gulp.task('dev', ['sass', 'icons', 'watch']);
gulp.task('default', ['sass', 'icons']);
