'use strict';

var test = require('tap').test;

test("patching the guts of domain", function (t) {
  t.plan(5);

  t.doesNotThrow(function () {
    require('../bootstrap.js');
  }, "should be able to bring up core without errors");

  t.doesNotThrow(function () {
    // debugger;
    require('../lib/domain.js');
  }, "should be able to patch domains without barfing");

  // FIXME: need some way to test that patch isn't loaded unless domains are
  // requested first
  var domain = require('domain');
  var d;
  t.doesNotThrow(function () {
    // debugger;
    d = domain.create();
  }, "should still be able to create a domain");

  t.ok(d.enter.__wrapped, "enter should have been patched on the prototype");
  t.ok(d.exit.__wrapped, "exit should have been patched on the prototype");
});
