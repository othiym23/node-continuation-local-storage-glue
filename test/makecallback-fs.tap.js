'use strict';

require('../bootstrap.js');

var fs              = require('fs')
  , path            = require('path')
  , exec            = require('child_process').exec
  , tap             = require('tap')
  , test            = tap.test
  , createNamespace = require('continuation-local-storage').createNamespace
  ;

// CONSTANTS
var FILENAME     = '__testfile'
  , DIRNAME      = '__TESTDIR'
  , LINKNAME     = '__testlink'
  , HARDLINKNAME = '__testhardlink'
  ;

function createFile(assert) {
  var contents = new Buffer("UHOH")
    , file     = fs.openSync(FILENAME, 'w')
    , written  = fs.writeSync(file, contents, 0, contents.length, 0)
    ;
  assert.equals(written, contents.length, "whole buffer was written");
  var rc = fs.closeSync(file);
  // need this here to avoid dealing with umask complications
  fs.chmodSync(FILENAME, '0666');
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


function createDirectory(assert) {
  fs.mkdirSync(DIRNAME);
  assert.ok(fs.existsSync(DIRNAME), "directory was created");
}

function deleteDirectory() { return fs.rmdirSync(DIRNAME); }


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
  t.plan(20);

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

  t.test("fs.link", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'link');
      t.equal(namespace.get('test'), 'link', "state has been mutated");

      fs.link(FILENAME, HARDLINKNAME, function (error) {
        t.notOk(error, "creating a link shouldn't error");

        t.equal(namespace.get('test'), 'link',
                "mutated state has persisted to fs.link's callback");

        var orig   = fs.statSync(FILENAME)
          , linked = fs.statSync(HARDLINKNAME)
          ;
        t.equal(orig.ino, linked.ino, "entries should point to same file");

        t.notOk(fs.unlinkSync(HARDLINKNAME), "link has been removed");
        deleteFile();
        t.end();
      });
    });
  });

  t.test("fs.symlink", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'symlink');
      t.equal(namespace.get('test'), 'symlink', "state has been mutated");

      fs.symlink(FILENAME, LINKNAME, function (error) {
        t.notOk(error, "creating a symlink shouldn't error");

        t.equal(namespace.get('test'), 'symlink',
                "mutated state has persisted to fs.symlink's callback");

        var pointed = fs.readlinkSync(LINKNAME);
        t.equal(pointed, FILENAME, "symlink points back to original file");

        t.notOk(fs.unlinkSync(LINKNAME), "symlink has been removed");
        deleteFile();
        t.end();
      });
    });
  });

  t.test("fs.readlink", function (t) {
    createLink(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'readlink');
      t.equal(namespace.get('test'), 'readlink', "state has been mutated");

      fs.readlink(LINKNAME, function (error, pointed) {
        t.notOk(error, "reading symlink shouldn't error");

        t.equal(namespace.get('test'), 'readlink',
                "mutated state has persisted to fs.readlink's callback");

        t.equal(pointed, FILENAME, "symlink points back to original file");

        deleteLink();
        t.end();
      });
    });
  });

  t.test("fs.unlink", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'unlink');
      t.equal(namespace.get('test'), 'unlink', "state has been mutated");

      fs.unlink(FILENAME, function (error) {
        t.notOk(error, "deleting file shouldn't error");

        t.equal(namespace.get('test'), 'unlink',
                "mutated state has persisted to fs.unlink's callback");

        t.notOk(path.exists(FILENAME), "file should be gone");
        t.end();
      });
    });
  });

  t.test("fs.realpath", function (t) {
    createFile(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'realpath');
      t.equal(namespace.get('test'), 'realpath', "state has been mutated");

      fs.realpath(FILENAME, function (error, real) {
        t.notOk(error, "deleting file shouldn't error");

        t.equal(namespace.get('test'), 'realpath',
                "mutated state has persisted to fs.realpath's callback");

        t.equal(real, path.resolve(FILENAME), "no funny business with the real path");

        deleteFile();
        t.end();
      });
    });
  });

  t.test("fs.mkdir", function (t) {
    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'mkdir');
      t.equal(namespace.get('test'), 'mkdir', "state has been mutated");

      fs.mkdir(DIRNAME, function (error) {
        t.notOk(error, "creating directory shouldn't error");

        t.equal(namespace.get('test'), 'mkdir',
                "mutated state has persisted to fs.mkdir's callback");

        t.ok(fs.existsSync(DIRNAME), "directory was created");

        fs.rmdirSync(DIRNAME);
        t.end();
      });
    });
  });

  t.test("fs.rmdir", function (t) {
    createDirectory(t);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'rmdir');
      t.equal(namespace.get('test'), 'rmdir', "state has been mutated");

      fs.rmdir(DIRNAME, function (error) {
        t.notOk(error, "deleting directory shouldn't error");

        t.equal(namespace.get('test'), 'rmdir',
                "mutated state has persisted to fs.rmdir's callback");

        t.notOk(fs.existsSync(DIRNAME), "directory was removed");

        t.end();
      });
    });
  });

  t.test("fs.readdir", function (t) {
    createDirectory(t);

    var file1 = fs.openSync(path.join(DIRNAME, 'file1'), 'w');
    fs.writeSync(file1, 'one');
    fs.closeSync(file1);

    var file2 = fs.openSync(path.join(DIRNAME, 'file2'), 'w');
    fs.writeSync(file2, 'two');
    fs.closeSync(file2);

    var file3 = fs.openSync(path.join(DIRNAME, 'file3'), 'w');
    fs.writeSync(file3, 'three');
    fs.closeSync(file3);

    var context = namespace.createContext();
    context.run(function () {
      namespace.set('test', 'readdir');
      t.equal(namespace.get('test'), 'readdir', "state has been mutated");

      fs.readdir(DIRNAME, function (error, contents) {
        t.notOk(error, "reading directory shouldn't error");

        t.equal(namespace.get('test'), 'readdir',
                "mutated state has persisted to fs.readdir's callback");

        t.equal(contents.length, 3, "3 files were found");

        fs.unlinkSync(path.join(DIRNAME, 'file1'));
        fs.unlinkSync(path.join(DIRNAME, 'file2'));
        fs.unlinkSync(path.join(DIRNAME, 'file3'));
        deleteDirectory();
        t.end();
      });
    });
  });

  // TODO: 'watch'
  // TODO: 'watchFile'
  // TODO: 'unwatchFile'
  // TODO: 'utimes'
  // TODO: 'futimes'
  // TODO: 'fsync'
  // TODO: 'open'
  // TODO: 'close'
  // TODO: 'read'
  // TODO: 'write'
  // TODO: 'readFile'
  // TODO: 'writeFile'
  // TODO: 'appendFile'
});
