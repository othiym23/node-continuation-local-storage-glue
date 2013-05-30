'use strict';

var test = require('tap').test;

test("monkeypatching namespaces over domains", function (t) {
  t.plan(3);

  var domain;
  t.doesNotThrow(function () {
    require('../bootstrap.js');
    domain = require('domain');
  });

  t.ok(process.namespaces.__core_domain, "Domain namespace exists.");

  var sample = domain.create();
  t.ok(sample.__NAMESPACE, "Domain belongs to a namespace.");
});
