'use strict';

var context = require('local-context')
  , domain  = require('domain')
  , shimmer = require('shimmer')
  , wrap    = shimmer.wrap
  , unwrap  = shimmer.unwrap
  ;

var domainspace = context.createNamespace('__core_domain');

function namespacer(domainConstructor) {
  return function () {
    var returned = domainConstructor.apply(this, arguments);
    returned.__NAMESPACE = domainspace;

    return returned;
  };
}

wrap(domain, 'create', namespacer);
wrap(domain, 'createDomain', namespacer);

module.exports = {
  stop : function () {
    unwrap(domain, 'create');
    unwrap(domain, 'createDomain');
  }
};
