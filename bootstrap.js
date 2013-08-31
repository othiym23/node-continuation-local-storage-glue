'use strict';
if (process.addAsyncListener) {
  throw new Error("Don't require polyfill unless needed");
}
process.addAsyncListener = addAsyncListener;
var listeners = [];

var shimmer  = require('shimmer')
  , wrap     = shimmer.wrap
  , massWrap = shimmer.massWrap
  ;

var net = require('net');
wrap(net.Server.prototype, "_listen2", function (original) {
  return function () {
    this.on("connection", function (socket) {
      socket._handle.onread = wrapCallback(socket._handle.onread);
    });
    var result = original.apply(this, arguments);
    this._handle.onconnection = wrapCallback(this._handle.onconnection);
    return result;
  };
});

wrap(net.Socket.prototype, "connect", function (original) {
  return function () {
    var args = net._normalizeConnectArgs(arguments);
    if (args[1]) args[1] = wrapCallback(args[1]);
    var result = original.apply(this, args);
    this._handle.onread = wrapCallback(this._handle.onread);
    return result;
  };
});


var processors = ['nextTick'];
if (process._nextDomainTick) processors.push('_nextDomainTick');
if (process._tickDomainCallback) processors.push('_tickDomainCallback');

massWrap(
  process,
  processors,
  activator
);

var asynchronizers = [
  'setTimeout',
  'setInterval'
];
if (global.setImmediate) asynchronizers.push('setImmediate');

massWrap(
  [global, require('timers')],
  asynchronizers,
  activatorFirst
);

var dns = require('dns');
massWrap(
  dns,
  [
    'lookup',
    'resolve',
    'resolve4',
    'resolve6',
    'resolveCname',
    'resolveMx',
    'resolveNs',
    'resolveTxt',
    'resolveSrv',
    'reverse'
  ],
  activator
);

if (dns.resolveNaptr) wrap(dns, 'resolveNaptr', activator);

var fs = require('fs');
massWrap(
  fs,
  [
    'watch',
    'rename',
    'truncate',
    'chown',
    'fchown',
    'chmod',
    'fchmod',
    'stat',
    'lstat',
    'fstat',
    'link',
    'symlink',
    'readlink',
    'realpath',
    'unlink',
    'rmdir',
    'mkdir',
    'readdir',
    'close',
    'open',
    'utimes',
    'futimes',
    'fsync',
    'write',
    'read',
    'readFile',
    'writeFile',
    'appendFile',
    'watchFile',
    'unwatchFile',
    "exists",
  ],
  activator
);

// only wrap lchown and lchmod on systems that have them.
if (fs.lchown) wrap(fs, 'lchown', activator);
if (fs.lchmod) wrap(fs, 'lchmod', activator);

// only wrap ftruncate in versions of node that have it
if (fs.ftruncate) wrap(fs, 'ftruncate', activator);

////////////////////////////////////////////////////////////////////////////////

// Polyfilled version of process.addAsyncListener
function addAsyncListener(onAsync, callbackObject) {
  listeners.push({
    onAsync: onAsync,
    callbackObject: callbackObject
  });
}

// Shim activator for functions that have callback last
function activator(fn) {
  return function () {
    var index = arguments.length - 1;
    if (typeof arguments[index] === "function") {
      arguments[index] = wrapCallback(arguments[index]);
    }
    return fn.apply(this, arguments);
  }
}

// Shim activator for functions that have callback first
function activatorFirst(fn) {
  return function () {
    if (typeof arguments[0] === "function") {
      arguments[0] = wrapCallback(arguments[0]);
    }
    return fn.apply(this, arguments);
  };
}

function wrapCallback(original) {
  var list = Array.prototype.slice.call(listeners);
  var length = list.length;
  var hasAny = false, hasErr = false;
  for (var i = 0; i < length; ++i) {
    var obj = list[i].callbackObject;
    if (obj) {
      hasAny = true;
      if (obj.error) hasErr = true;
    }
  }
  return hasAny ? hasErr ? catchyWrap(original, list, length)
                         : normalWrap(original, list, length)
                : noWrap(original, list, length);
}

function runSetup(list, length) {
  var data = new Array(length);
  for (var i = 0; i < length; ++i) {
    var listener = list[i];
    data[i] = listener.onAsync();
  }
  return data;
}

function runBefore(data, list, length) {
  for (var i = 0; i < length; ++i) {
    var obj = list[i].callbackObject;
    if (obj && obj.before) obj.before(data[i]);
  }
}

function runError(data, list, length) {
  for (i = 0; i < length; ++i) {
    obj = list[i].callbackObject;
    if (obj && obj.after) obj.after(data[i]);
  }
}

function runAfter(data, list, length) {
  var i, obj;
  for (i = 0; i < length; ++i) {
    obj = list[i].callbackObject;
    if (obj && obj.after) obj.after(data[i]);
  }
  for (i = 0; i < length; ++i) {
    obj = list[i].callbackObject;
    if (obj && obj.done) obj.done(data[i]);
  }
}

function catchyWrap(original, list, length) {
  var data = runSetup(list, length);
  return function () {
    runBefore(data, list, length);
    try {
      return original.apply(this, arguments);
    }
    catch (err) {
      runError(data, list, length);
    }
    finally {
      runAfter(data, list, length);
    }
  }
}

function normalWrap(original, list, length) {
  var data = runSetup(list, length);
  return function () {
    runBefore(data, list, length);
    try {
      return original.apply(this, arguments);
    }
    finally {
      runAfter(data, list, length);
    }
  }
}

function noWrap(original, list, length) {
  for (var i = 0; i < length; ++i) {
    list[i].onAsync();
  }
  return original;
}

