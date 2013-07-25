'use strict';

// This module must be loaded *after* monkeypatching of core, so the domain
// namespace is created.
var events              = require('events')
  , OrigEE              = events.EventEmitter
  , _eePrototype        = OrigEE.prototype
  , domainspace         = process.namespaces.__core_domain
  , defaultMaxListeners = 10
  , domain
  ;

// largely copypasta from Node source, shimmed to use namespace
function EventEmitter () {
  if (events.usingDomains) {
    Object.defineProperty(this, 'domain', {
      get : function () {
        // debugger;
        return domainspace.get('domain');
      },
      set : function (domain) {
        // debugger;
        domainspace.set('domain', domain);
      }
    });

    domain = domain || require('domain');
    if (domain.active && !(this instanceof domain.Domain)) {
      this.domain = domain.active;
    }
  }
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || defaultMaxListeners;
}
EventEmitter.prototype = _eePrototype;

// FIXME: want a reliable way to unwrap everything
// EventEmitter.unwrap = function () {
//   events.EventEmitter = OrigEE;
// };

events.EventEmitter = EventEmitter;
