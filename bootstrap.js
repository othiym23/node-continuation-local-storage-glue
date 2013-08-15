'use strict';

var cls      = require('continuation-local-storage')
  , shimmer  = require('shimmer')
  , wrap     = shimmer.wrap
  , massWrap = shimmer.massWrap
  ;

var slice = [].slice;
function each(obj, callback) {
  var keys = Object.keys(obj);
  for (var i = 0, l = keys.length; i < l; ++i) {
    var key = keys[i];
    callback(key, obj[key]);
  }
}

function wrapCallback(callback) {
  // Get the currently active contexts in all the namespaces.
  var contexts = {};
  each(process.namespaces, function (name, namespace) {
    contexts[name] = namespace.active;
  });

  // Return a callback that enters all the saved namespaces when called.
  return function () {
    var namespaces = process.namespaces;
    each(contexts, function (name, context) {
      namespaces[name].enter(context);
    });
    try {
      return callback.apply(this, arguments);
    }
    finally {
      each(contexts, function (name, context) {
        namespaces[name].exit(context);
      });
    }
  };
}

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

// Shim activator for functions that have callback last
function activator(fn) {
  return function () {
    var args = slice.call(arguments);
    var callback = args[args.length - 1];

    // If there is no callback, there will be no continuation to trap.
    if (typeof callback !== "function") {
      return fn.apply(this, arguments);
    }

    // Wrap the callback so that the continuation keeps the current contexts.
    args[args.length - 1] = wrapCallback(callback);
    return fn.apply(this, args);
  };
}

// Shim activator for functions that have callback first
function activatorFirst(fn) {
  return function () {
    var args = slice.call(arguments);
    var callback = args[0];

    // If there is no callback, there will be no continuation to trap.
    if (typeof callback !== "function") {
      return fn.apply(this, arguments);
    }

    // Wrap the callback so that the continuation keeps the current contexts.
    args[0] = wrapCallback(callback);
    return fn.apply(this, args);
  };
}

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

// PUBLIC API STARTS HERE: there isn't much of one
module.exports = cls;
