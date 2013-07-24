'use strict';

require('../bootstrap.js');

var fs              = require('fs')
  , exec            = require('child_process').exec
  , tap             = require('tap')
  , test            = tap.test
  , createNamespace = require('continuation-local-storage').createNamespace
  ;

// CONSTANTS
var FILENAME = '__testfile'
  , LINKNAME = '__testlink'
  ;

function createFile(assert) {
  var contents = new Buffer("UHOH")
    , file     = fs.openSync(FILENAME, 'w')
    , written  = fs.writeSync(file, contents, 0, contents.length, 0)
    ;

  assert.equals(written, contents.length, "whole buffer was written");

  var rc = fs.closeSync(file);
  // need this here to avoid dealing with umask complications
  fs.chmod(FILENAME, '0666');
  return rc;
}

function deleteFile() { return fs.unlinkSync(FILENAME); }


function createLink(assert) {
  createFile(assert);

  fs.symlinkSync(FILENAME, LINKNAME);
  fs.lchmodSync(LINKNAME, '0777');
}

function deleteLink() {
  fs.unlinkSync(LINKNAME);

  return deleteFile();
}


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
  t.plan(12);

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

        fs.chown(FILENAME, uid, gid, function (error) {
          t.ok(error, "changing ownership will error for non-root users");

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
        fs.fchown(file, uid, gid, function (error) {
          t.ok(error, "changing ownership will error for non-root users");

          t.equal(namespace.get('test'), 'fchown',
                  "mutated state has persisted to fs.fchown's callback");

          fs.closeSync(file);
          deleteFile();
          t.end();
        });
      });
    });
  });

  t.test("fs.lchown", function (t) {
    createLink(t);

    mapIds('daemon', 'daemon', function (error, uid, gid) {
      t.notOk(error, "looking up uid & gid shouldn't error");
      t.ok(uid, "uid for daemon was found");
      t.ok(gid, "gid for daemon was found");

      var context = namespace.createContext();
      context.run(function () {
        namespace.set('test', 'lchown');
        t.equal(namespace.get('test'), 'lchown', "state has been mutated");

        fs.lchown(LINKNAME, uid, gid, function (error) {
          t.ok(error, "changing ownership will error for non-root users");

          t.equal(namespace.get('test'), 'lchown',
                  "mutated state has persisted to fs.lchown's callback");

          deleteLink();
          t.end();
        });
      });
    });
  });

  t.test("fs.chmod", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'chmod');
      t.equal(namespace.get('test'), 'chmod', "state has been mutated");

      fs.chmod(FILENAME, '0700', function (error) {
        t.notOk(error, "changing mode shouldn't error");

        t.equal(namespace.get('test'), 'chmod',
                "mutated state has persisted to fs.chmod's callback");

        var stats = fs.statSync(FILENAME);
        t.equal(stats.mode.toString(8), '100700', "extra access bits are stripped");

        deleteFile();
        t.end();
      });
    });
  });

  t.test("fs.fchmod", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'fchmod');
      t.equal(namespace.get('test'), 'fchmod', "state has been mutated");

      var file = fs.openSync(FILENAME, 'w+');
      fs.fchmod(file, '0700', function (error) {
        t.notOk(error, "changing mode shouldn't error");

        t.equal(namespace.get('test'), 'fchmod',
                "mutated state has persisted to fs.fchmod's callback");

        fs.closeSync(file);
        var stats = fs.statSync(FILENAME);
        t.equal(stats.mode.toString(8), '100700', "extra access bits are stripped");

        deleteFile();
        t.end();
      });
    });
  });

  t.test("fs.lchmod", function (t) {
    createLink(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'lchmod');
      t.equal(namespace.get('test'), 'lchmod', "state has been mutated");

      fs.lchmod(LINKNAME, '0700', function (error) {
        t.notOk(error, "changing mode shouldn't error");

        t.equal(namespace.get('test'), 'lchmod',
                "mutated state has persisted to fs.lchmod's callback");

        var stats = fs.lstatSync(LINKNAME);
        t.equal(stats.mode.toString(8), '120700', "extra access bits are stripped");

        deleteLink();
        t.end();
      });
    });
  });

  t.test("fs.stat", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'stat');
      t.equal(namespace.get('test'), 'stat', "state has been mutated");

      fs.stat(FILENAME, function (error, stats) {
        t.notOk(error, "reading stats shouldn't error");

        t.equal(namespace.get('test'), 'stat',
                "mutated state has persisted to fs.stat's callback");

        t.equal(stats.mode.toString(8), '100666', "permissions should be as created");

        deleteFile();
        t.end();
      });
    });
  });

  t.test("fs.fstat", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'fstat');
      t.equal(namespace.get('test'), 'fstat', "state has been mutated");

      var file = fs.openSync(FILENAME, 'r');
      fs.fstat(file, function (error, stats) {
        t.notOk(error, "reading stats shouldn't error");

        t.equal(namespace.get('test'), 'fstat',
                "mutated state has persisted to fs.fstat's callback");

        t.equal(stats.mode.toString(8), '100666', "permissions should be as created");

        fs.closeSync(file);
        deleteFile();
        t.end();
      });
    });
  });

  t.test("fs.lstat", function (t) {
    createLink(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'lstat');
      t.equal(namespace.get('test'), 'lstat', "state has been mutated");

      fs.lstat(LINKNAME, function (error, stats) {
        t.notOk(error, "reading stats shouldn't error");

        t.equal(namespace.get('test'), 'lstat',
                "mutated state has persisted to fs.lstat's callback");

        t.equal(stats.mode.toString(8), '120777', "permissions should be as created");

        deleteLink();
        t.end();
      });
    });
  });

  // TODO: 'link'
  // TODO: 'unlink'
  // TODO: 'symlink'
  // TODO: 'readlink'
  // TODO: 'realpath'
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
