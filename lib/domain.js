'use strict';

var domain      = require('domain')
  , Domain      = domain.Domain
  , wrap        = require('shimmer').wrap
  , domainspace = process.namespaces.__core_domain
  ;

wrap(Domain.prototype, 'enter', function () {
  return function () {
    // debugger;
    if (this._disposed) return; // TODO: remove because deprecated?
    this.__context.enter();
    domain.active = process.domain = this;
    // FIXME: what do we do with the domain stack?
  };
});

wrap(Domain.prototype, 'exit', function () {
  return function () {
    // debugger;
    if (this._disposed) return; // TODO: deprecated

    // FIXME: exit all domains until this one.
    this.__context.exit();
    // FIXME: what do we do with the domain stack?
    process.domain = domain.active = domainspace.get;
  };
});
