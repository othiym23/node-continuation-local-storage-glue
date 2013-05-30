'use strict';

require('../bootstrap.js');

var tap             = require('tap')
  , test            = tap.test
  , createNamespace = require('local-context').createNamespace
  ;

test("asynchronously propagating state with local-context-domains", function (t) {
  t.plan(8);

  var namespace = createNamespace('namespace');

  t.ok(process.namespaces.namespace, "namespace has been created");

  namespace.set('test', 1337);
  t.equal(namespace.get('test'), 1337, "namespace is working");

  var context = namespace.createContext();
  context.run(function () {
    namespace.set('test', 31337);
    t.equal(namespace.get('test'), 31337, "nested context should take value");

    process.nextTick(function () {
      t.equal(namespace.get('test'), 31337, "process.nextTick should push state");
    });
  });

  context = namespace.createContext();
  context.run(function () {
    namespace.set('test', 999);
    t.equal(namespace.get('test'), 999, "nested context should take value");

    setImmediate(function () {
      t.equal(namespace.get('test'), 999, "setImmediate should push state");
    });
  });

  context = namespace.createContext();
  context.run(function () {
    namespace.set('test', 54321);
    t.equal(namespace.get('test'), 54321, "nested context should take value");

    setTimeout(function () {
      t.equal(namespace.get('test'), 54321, "setTimeout should push state");
    });
  });
});
