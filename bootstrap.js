'use strict';

var cls  = require('continuation-local-storage')
  , domain   = require('domain')
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
    var result = callback.apply(this, arguments);
    each(contexts, function (name, context) {
      namespaces[name].exit(context);
    });
    return result;
  };
}

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

massWrap(
  process,
  [
    'nextTick',
    '_nextDomainTick',
    '_tickDomainCallback'
  ],
  activator
);

massWrap(
  [global, require('timers')],
  [
    'setTimeout',
    'setInterval',
    'setImmediate'
  ],
  activatorFirst
);

massWrap(
  require('dns'),
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
    'resolveNaptr',
    'reverse'
  ],
  activator
);

massWrap(
  require('fs'),
  [
    'watch',
    'rename',
    'ftruncate',
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
  ],
  activator
);

// Only wrap lchown and lchmod on systems that have them.
if (require('fs').lchown) {
  massWrap(
    require('fs'),
    [
      'lchown',
      'lchmod',
    ],
    activator
  );
}

/**
 * Set up a new substrate for domains (eventually will replace / be aliased to domains)
 */
var domainspace = cls.createNamespace('__core_domain');
function namespacer(domainConstructor) {
  return function () {
    var returned = domainConstructor.apply(this, arguments);
    returned.__NAMESPACE = domainspace;
    this.__context = domainspace.active;

    return returned;
  };
}

wrap(domain, 'create', namespacer);
wrap(domain, 'createDomain', namespacer);


// PUBLIC API STARTS HERE: there isn't much of one
module.exports = {
  /* If you call this, you have greater faith in my code than I do.
   * Mostly here for testing.
   */
  // on second thought, this is a bad idea
  // FIXME: re-add this when we have all the pieces in place
  // stop : function () {
  //   unwrap(domain, 'create');
  //   unwrap(domain, 'createDomain');
  //   unwrap(process, 'nextTick');
  //   unwrap(process, '_nextDomainTick');
  //   unwrap(process, '_tickDomainCallback');
  //   unwrap(global, 'setTimeout');
  //   unwrap(global, 'setInterval');
  //   unwrap(global, 'setImmediate');
  //   unwrap(timers, 'setTimeout');
  //   unwrap(timers, 'setInterval');
  //   unwrap(timers, 'setImmediate');
  // }
};
