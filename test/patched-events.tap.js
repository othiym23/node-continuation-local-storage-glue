'use strict';

var test = require('tap').test;

test("patching the guts of EventEmitters", function (t) {
  t.plan(6);

  t.doesNotThrow(function () {
    // debugger;
    require('../bootstrap.js');
  }, "should be able to bring up core without errors");

  t.doesNotThrow(function () {
    // debugger;
    require('../lib/domain.js');
  }, "should be able to patch domains without barfing");

  t.doesNotThrow(function () {
    require('../lib/events.js');
  }, "should be able to patch EventEmitters without barfing");

  var domainspace = process.namespaces.__core_domain;
  t.ok(domainspace, "domains namespace should be present");

  var EventEmitter;
  t.doesNotThrow(function () {
    EventEmitter = require("events").EventEmitter;
  }, "can still load EventEmitters");

  var ee = new EventEmitter();
  ee.domain = "patchtest";
  t.equal(domainspace.get("domain"), "patchtest",
         "domain should be set on the namespace now");
});
