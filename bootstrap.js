'use strict';

var context = require('local-context')
  , domain  = require('domain')
  , timers  = require('timers') // always a sign there's fun ahead
  , shimmer = require('shimmer')
  , wrap    = shimmer.wrap
  , unwrap  = shimmer.unwrap
  ;

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


/**
 * Make sure that active contexts are captured during turnings of the event loop.
 *
 * FIXME: may not be necessary (WIP)
 * FIXME: clearly not doing the right thing for things containing Timers
 */
function activator(propagator) {
  return function () {
    copyContexts(process.namespaces, this);
    return propagator.apply(this, arguments);
  };
}

wrap(process, 'nextTick', activator);
wrap(process, '_nextDomainTick', activator);
wrap(process, '_tickDomainCallback', activator);

wrap(global, 'setTimeout', activator);
wrap(global, 'setInterval', activator);
wrap(global, 'setImmediate', activator);

wrap(timers, 'setTimeout', activator);
wrap(timers, 'setInterval', activator);
wrap(timers, 'setImmediate', activator);


// PUBLIC API STARTS HERE: there isn't much of one
module.exports = {
  /* If you call this, you have greater faith in my code than I do.
   * Mostly here for testing.
   */
  stop : function () {
    unwrap(domain, 'create');
    unwrap(domain, 'createDomain');
    unwrap(process, 'nextTick');
    unwrap(process, '_nextDomainTick');
    unwrap(process, '_tickDomainCallback');
    unwrap(global, 'setTimeout');
    unwrap(global, 'setInterval');
    unwrap(global, 'setImmediate');
    unwrap(timers, 'setTimeout');
    unwrap(timers, 'setInterval');
    unwrap(timers, 'setImmediate');
  }
};
