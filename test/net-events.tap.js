'use strict';

require('../bootstrap.js');

var net             = require('net')
  , tap             = require('tap')
  , test            = tap.test
  , createNamespace = require('continuation-local-storage').createNamespace
  ;

test("continuation-local state with net connection", function (t) {
  t.plan(1);

  var namespace = createNamespace('net');
  namespace.set('test', 0xabad1dea);

  var server;
  namespace.run(function () {
    namespace.set('test', 0x1337);

    server = net.createServer(function (socket) {
      t.equal(namespace.get('test'), 0x1337, "state has been mutated");
      t.end();
      server.close();
      socket.end()
    });
    server.listen(function () {
      var address = server.address();
      var client = net.connect(address.port, function () {
        client.end();
      });
    });
  });
});
