'use strict';

require('../bootstrap.js');

var fs              = require('fs')
  , exec            = require('child_process').exec
  , tap             = require('tap')
  , test            = tap.test
  , createNamespace = require('continuation-local-storage').createNamespace
  ;

var FILENAME = '__testfile';

function createFile(assert) {
  var contents = new Buffer("UHOH")
    , file     = fs.openSync(FILENAME, 'w', '0777')
    , written  = fs.writeSync(file, contents, 0, contents.length, 0)
    ;

  assert.equals(written, contents.length, "whole buffer was written");

  return fs.closeSync(file);
}

function deleteFile() { return fs.unlinkSync(FILENAME); }

function mapIds(username, groupname, callback) {
  if (!callback) throw new Error("mapIds requires callback");
  if (!username) return callback(new Error("mapIds requires username"));
  if (!groupname) return callback(new Error("mapIds requires groupname"));

  exec('id -u ' + username, function (error, stdout, stderr) {
    if (error) return callback(error);
    if (stderr) return callback(new Error(stderr));

    var uid = +stdout;
    exec('id -g ' + groupname, function (error, stdout, stderr) {
      if (error) return callback(error);
      if (stderr) return callback(new Error(stderr));

      var gid = +stdout;
      callback(null, uid, gid);
    });
  });
}

test("continuation-local state with MakeCallback and fs module", function (t) {
  t.plan(5);

  var namespace = createNamespace('fs');
  namespace.set('test', 0xabad1dea);

  t.test("fs.rename", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'rename');
      t.equal(namespace.get('test'), 'rename', "state has been mutated");

      fs.rename(FILENAME, '__renamed', function (error) {
        t.notOk(error, "renaming shouldn't error");
        t.equal(namespace.get('test'), 'rename',
                "mutated state has persisted to fs.rename's callback");

        fs.unlinkSync('__renamed');
        t.end();
      });
    });
  });

  t.test("fs.truncate", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'truncate');
      t.equal(namespace.get('test'), 'truncate', "state has been mutated");

      fs.truncate(FILENAME, 0, function (error) {
        t.notOk(error, "truncation shouldn't error");

        var stats = fs.statSync(FILENAME);
        t.equal(stats.size, 0, "file has been truncated");

        t.equal(namespace.get('test'), 'truncate',
                "mutated state has persisted to fs.truncate's callback");

        deleteFile();
        t.end();
      });
    });
  });

  t.test("fs.ftruncate", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'ftruncate');
      t.equal(namespace.get('test'), 'ftruncate', "state has been mutated");

      var file = fs.openSync(FILENAME, 'w');
      fs.ftruncate(file, 0, function (error) {
        t.notOk(error, "truncation shouldn't error");

        fs.closeSync(file);
        var stats = fs.statSync(FILENAME);
        t.equal(stats.size, 0, "file has been truncated");

        t.equal(namespace.get('test'), 'ftruncate',
                "mutated state has persisted to fs.ftruncate's callback");

        deleteFile();
        t.end();
      });
    });
  });

  t.test("fs.chown", function (t) {
    createFile(t);

    mapIds('daemon', 'daemon', function (error, uid, gid) {
      t.notOk(error, "looking up uid & gid shouldn't error");
      t.ok(uid, "uid for daemon was found");
      t.ok(gid, "gid for daemon was found");

      var context = namespace.createContext();
      context.run(function () {
        namespace.set('test', 'chown');
        t.equal(namespace.get('test'), 'chown', "state has been mutated");

        // this will fail silently as long as node-tap is using graceful-fs,
        // because it swallows EPERMs returned by chown
        fs.chown(FILENAME, uid, gid, function (error) {
          t.notOk(error, "changing ownership shouldn't error");

          t.equal(namespace.get('test'), 'chown',
                  "mutated state has persisted to fs.chown's callback");

          deleteFile();
          t.end();
        });
      });
    });
  });

  t.test("fs.fchown", function (t) {
    createFile(t);

    mapIds('daemon', 'daemon', function (error, uid, gid) {
      t.notOk(error, "looking up uid & gid shouldn't error");
      t.ok(uid, "uid for daemon was found");
      t.ok(gid, "gid for daemon was found");

      var context = namespace.createContext();
      context.run(function () {
        namespace.set('test', 'fchown');
        t.equal(namespace.get('test'), 'fchown', "state has been mutated");

        var file = fs.openSync(FILENAME, 'w');
        // this will fail silently as long as node-tap is using graceful-fs,
        // because it swallows EPERMs returned by chown
        fs.fchown(file, uid, gid, function (error) {
          t.notOk(error, "changing ownership shouldn't error");

          t.equal(namespace.get('test'), 'fchown',
                  "mutated state has persisted to fs.fchown's callback");

          fs.closeSync(file);
          deleteFile();
          t.end();
        });
      });
    });
  });

  // TODO: 'lchown'
  // TODO: 'chmod'
  // TODO: 'fchmod'
  // TODO: 'lchmod'
  // TODO: 'stat'
  // TODO: 'lstat'
  // TODO: 'fstat'
  // TODO: 'link'
  // TODO: 'symlink'
  // TODO: 'readlink'
  // TODO: 'realpath'
  // TODO: 'unlink'
  // TODO: 'rmdir'
  // TODO: 'mkdir'
  // TODO: 'readdir'
  // TODO: 'close'
  // TODO: 'open'
  // TODO: 'utimes'
  // TODO: 'futimes'
  // TODO: 'fsync'
  // TODO: 'write'
  // TODO: 'read'
  // TODO: 'readFile'
  // TODO: 'writeFile'
  // TODO: 'appendFile'
  // TODO: 'watchFile'
  // TODO: 'watch'
  // TODO: 'unwatchFile'
});
