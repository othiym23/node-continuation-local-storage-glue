'use strict';

var context  = require('continuation-local-storage')
  , domain   = require('domain')
  , shimmer  = require('shimmer')
  , wrap     = shimmer.wrap
  , massWrap = shimmer.massWrap
  ;

var slice = [].slice;

/**
 * Save the active domains for later lookup in a subsequent turn of the
 * event loop.
 *
 * WARNING:
 *
 * It's not safe to do I/O in this function because it's happening inside
 * the bits of the event loop that manage the event loop. You can try,
 * you'll just get a guaranteed RangeError in 0.10.x
 */
function copyContexts(current, target) {
  if (!target) return;

  // good luck adding logging to this function
  var actives = Object.create(null);
  Object.keys(current).forEach(function (namespace) {
    actives[namespace] = namespace.active;
  });
  target.__actives = actives;

  return actives;
}

function getContexts(target) {
  if (!target) return;
  if (!target.__actives) throw new Error("No active namespaces to restore.");

  return target.__actives;
}

function enterContexts(contexts) {
  if (!(contexts && Array.isArray(contexts))) return;

  contexts.forEach(function (context) {
    context.enter();
  });
}

function exitContexts(contexts) {
  if (!(contexts && Array.isArray(contexts))) return;

  contexts.forEach(function (context) {
    context.exit();
  });
}

/**
 * Make sure that active contexts are captured during turnings of the event loop.
 *
 * FIXME: may not be necessary (WIP)
 * FIXME: clearly not doing the right thing for things containing Timers
 */
function activator(propagator) {
  return function () {
    copyContexts(process.namespaces, this);

    // FIXME: this is in major need of refactoring out
    var args = slice.call(arguments);
    var callback = args[args.length - 1];
    if (typeof callback === 'function') {
      args[args.length - 1] = function () {
        var contexts = getContexts(this);
        enterContexts(contexts);
        callback.apply(this, arguments);
        exitContexts(contexts);
      }.bind(this);
    }

    return propagator.apply(this, args);
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
  activator
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
    'lchown',
    'chmod',
    'fchmod',
    'lchmod',
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

/**
 * Set up a new substrate for domains (eventually will replace / be aliased to domains)
 */
var domainspace = context.createNamespace('__core_domain');
function namespacer(domainConstructor) {
  return function () {
    var returned = domainConstructor.apply(this, arguments);
    returned.__NAMESPACE = domainspace;
    this.__context = domainspace.createContext("domain");

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
