/**
 * Module dependencies.
 */

var Counter = require('passthrough-counter');
var humanize = require('humanize-number');
var bytes = require('bytes');

/**
 * TTY check for dev format.
 */

var isatty = process.stdout.isTTY;

/**
 * Expose logger.
 */

module.exports = dev;

/**
 * Development logger.
 */

function dev(opts) {
  return function *logger(next) {

    var theBody
    if (this.request.body) {
      theBody = this.request.body
    }

    // request
    var start = new Date;
    console.log('  ' + '<--'
      + ' ' + '%s'
      + ' ' + '%s',
        this.method,
        this.originalUrl);

    try {
      yield next;
    } catch (err) {
      // log uncaught downstream errors
      log(this, start, null, err, null, theBody);
      throw err;
    }

    // calculate the length of a streaming response
    // by intercepting the stream with a counter.
    // only necessary if a content-length header is currently not set.
    var length = this.response.length;
    var body = this.body;
    var counter;
    if (null == length && body && body.readable) {
      this.body = body
        .pipe(counter = Counter())
        .on('error', this.onerror);
    }

    // log when the response is finished or closed,
    // whichever happens first.
    var ctx = this;
    var res = this.res;

    var onfinish = done.bind(null, 'finish');
    var onclose = done.bind(null, 'close');

    res.once('finish', onfinish);
    res.once('close', onclose);

    function done(event){
      res.removeListener('finish', onfinish);
      res.removeListener('close', onclose);
      log(ctx, start, counter ? counter.length : length, null, event, theBody);
    }
  }
}

/**
 * Log helper.
 */

function log(ctx, start, len, err, event, theBody) {
  // get the status code of the response
  var status = err
    ? (err.status || 500)
    : (ctx.status || 404);

  // get the human readable response length
  var length;
  if (~[204, 205, 304].indexOf(status)) {
    length = '';
  } else if (null == len) {
    length = '-';
  } else {
    length = bytes(len);
  }

  var upstream = err ? 'xxx'
    : event === 'close' ? '-x-'
    : '-->'

  var msg = '  ' + upstream
  + ' ' + ctx.method
  + ' ' + ctx.originalUrl
  + ' ' + status
  + ' ' + time(start)
  + ' ' + length

  msg = status == 500
    ? msg + ' ' + JSON.stringify({request: ctx.request, body: theBody})
    : msg

  console.log(msg)
}

/**
 * Show the response time in a human readable format.
 * In milliseconds if less than 10 seconds,
 * in seconds otherwise.
 */

function time(start) {
  var delta = new Date - start;
  delta = delta < 10000
    ? delta + 'ms'
    : Math.round(delta / 1000) + 's';
  return humanize(delta);
}
