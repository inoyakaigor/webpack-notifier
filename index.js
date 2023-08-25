var stripANSI = require('strip-ansi');
var path = require('path');
var os = require('os');
var notifier = require('node-notifier');

var DEFAULT_LOGO = path.join(__dirname, 'logo.png');

var WebpackNotifierPlugin = module.exports = function (options) {
    this.options = options || {};
    this.lastBuildSucceeded = false;
    this.isFirstBuild = true;
};

function findFirstDFS(compilation, key) {
    var match = compilation[key][0];
    if (match) {
        return match;
    }

    var children = compilation.children;
    for (var i = 0; i < children.length; ++i) {
        match = findFirstDFS(children[i], key);
        if (match) {
            return match;
        }
    }
}

WebpackNotifierPlugin.prototype.compileEndOptions = function (stats) {
    if (this.isFirstBuild) {
        this.isFirstBuild = false;

        if (this.options.skipFirstNotification) {
            return;
        }
    }

    var imageFromOptions = ('contentImage' in this.options)
        ? this.options.contentImage
        : DEFAULT_LOGO;

    var successImage = path.resolve(__dirname + '/img/ok.ico');
    var warningsImage = path.resolve(__dirname + '/img/warn.ico');
    var errorsImage = path.resolve(__dirname + '/img/error.ico');
    if (typeof imageFromOptions == 'object') {
        successImage = imageFromOptions['success']
        warningsImage = imageFromOptions['warning']
        errorsImage = imageFromOptions['error']
    }

    var error;
    var contentImage;
    var status;
    if (stats.hasErrors()) {
        error = findFirstDFS(stats.compilation, 'errors');
        contentImage = errorsImage;
        status = 'error'

    } else if (stats.hasWarnings() && !this.options.excludeWarnings && !this.options.onlyOnError) {
        error = findFirstDFS(stats.compilation, 'warnings');
        contentImage = warningsImage;
        status = 'warning'

    } else if ((!this.lastBuildSucceeded || this.options.alwaysNotify) && !this.options.onlyOnError) {
        this.lastBuildSucceeded = true;
        return {
            message: (hasEmoji ? '✅ ' : '') + 'Build is successful',
            contentImage: successImage,
            status: 'success'
        };

    } else {
        return {}
    }

    this.lastBuildSucceeded = false;

    var message = '';
    if (error.module && error.module.rawRequest)
        message = error.module.rawRequest + '\n';

    var hasEmoji = this.options.emoji;
    if (error.error)
        message = (hasEmoji ? '❌ ' : '') + 'Error: ' + message + error.error.toString();
    else if (error.warning)
        message = (hasEmoji ? '⚠️ ' : '') + 'Warning: ' + message + error.warning.toString();
    else if (error.message) {
        message = (hasEmoji ? '⚠️ ' : '') + 'Warning: ' + message + error.message.toString();
    }

    return {
        message: stripANSI(message),
        contentImage: contentImage,
        status: status
    }
};

WebpackNotifierPlugin.prototype.compilationDone = function (stats) {
    var {message, contentImage, status} = this.compileEndOptions(stats);
    if (message) {
        var title = this.options.title ? this.options.title : 'Webpack'

        if (typeof title === 'function') {
            title = title({message: message, status: status})
        }

        var icon = (os.platform() === 'win32' || os.platform() === 'linux')
            ? contentImage
            : undefined

        var timeout = this.options.timeout ? this.options.timeout : 10
        notifier.notify({
            ...this.options,
            title,
            message,
            contentImage,
            icon,
            timeout
        });
    }
};

WebpackNotifierPlugin.prototype.apply = function (compiler) {
    if (compiler.hooks) {
        var plugin = {name: 'Notifier'};

        compiler.hooks.done.tap(plugin, this.compilationDone.bind(this));
    } else {
        compiler.plugin('done', this.compilationDone.bind(this));
    }
};
