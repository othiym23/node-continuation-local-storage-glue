## INTRODUCTION

This module has two primary goals:

1. To add the `node-local-context` namespace API to a Node process at runtime.
2. To rebuild the built-in Node domains behavior to use the namespace system.

Doing this requires some fairly invasive modification of the main Node event
loop. While the Node event loop's external behavior has remained relatively
stable over time (barring the odd addition like `setImmediate()`), the
internal implementation has been reworked considerably between major versions
of Node. In particular, while the domains module was introduced in Node 0.8,
the core team put considerable attention into making the performance impact of
domains as small as possible in 0.10.

Because this module is intended as a prototype for changes to be made to Node
core itself, and because of the differences between these implementations,
this module is only intended for use with Node 0.10.x (no earlier, no later).
It's possible that it could be made to work with 0.8, and it's also possible
that it could be made to work with even earlier versions. A lot of things are
possible. However, you're on your own.

## node.js monkeypatching notes

In Node 0.10, for sound performance-related reasons, Trevor Norris split apart
the way the event loops works for cases in which domains are or are not in
use. This split extends all the way from the JavaScript side through to the
C++ bindings for Node in V8-land. The changes mostly affect how callbacks are
set up to be evaluated in subsequent turns of the event loop when using
process.nextTick.

This process is bootstrapped in
[node.js](https://github.com/joyent/node/blob/master/src/node.js) (from now
on, assume that when I mention `node.js`, I'm referring to the file, not the
platform as a whole). node.js handles the bootstrapping process of connecting
native (C++) bits of Node functionality to the JS module system, as well as
esentially monkeypatching the Node runtime into existence – setting up the
`process` global, starting the event loop, and defining how the event loop is
run.

Fortunately for readability (and comprehensibility) the bootstrap process
is broken down into functions, and everything we care about is in
[startup.processNextTick()](https://github.com/joyent/node/blob/v0.10/src/node.js#L318-L510).

Unfortunately, there's still a lot to take in in this function, and still more
unfortunately, it creates a closure around most of the state that its enclosed
functions use, which means that modifying small aspects of the system's
behavior is difficult *(if not impossible? figuring this out is WIP)* without
completely replacing the whole shebang. Just to be explicit, this essentially
implies that `node-local-context` might end up replacing the entire JS side of
the event loop -- minimizing the footprint of the module is one of the current
major goals.

Here are the functions that are most important to understanding what's going
on:

* [_tickDomainCallback (JS)](https://github.com/joyent/node/blob/v0.10/src/node.js#L318-L510)
* [_nextDomainTick (JS)](https://github.com/joyent/node/blob/v0.10/src/node.js#L493-L510)
* [_needTickCallback (C++)](https://github.com/joyent/node/blob/v0.10/src/node.cc#L212-L216)

There is a buuuuunch of stuff to be understood about what's going on with
these functions, but until I have all the details straight for this module,
I'm going to leave it at saying there's a considerable degree of complexity
around dealing with the "infobox", a cute hack that Trevor added to make
getting at the current state of the event loop as fast as possible from both
the JS and C++ sides of Node. This state exists mostly to make dealing with
process.nextTick as simple and fast as possible, but as a consequence of its
design, the infobox makes it very difficult to selectively monkeypatch any of
the bits of Node event loop behavior. To be fair, nobody would have guessed
that anyone would be crazy enough to want to do this back when Trevor was
originally doing this work.

This gets a lot of documentation because `process.nextTick` gets used
*everywhere* and is on a *very hot path*. Breaking it breaks pretty much all
of Node. Minimizing the footprint here is important not just for this module,
but for the eventual changes to Node itself.

## timers.js notes

The other primary mechanism for propagating state across turns of the event
loop are the functions defined in `timers.js`. Each one of these deals with
domains presently, so each needs to be modified to work with namespaces
instead of domains. They're relatively straightforward (at least compared to
process.nextTick), but there are weird subtleties (i.e. it's not sufficient to
just monkeypatch one of the module functions *or* the version defined on the
global object, you have to do *both* -- considering that almost nothing uses
the timers module directly, I don't know why this is. Again, this stuff wasn't
meant to be modified at runtime). Also, there's a bunch of linked lists and
other state that's local to the timers module, so monkeypatching these
functions is again tantamount to replacing them.

## EventEmitter / stream / I/O notes

The final case in which domains need to be propagated is in the case of
EventEmitters. If an EE is created on (or added to) a domain, it has a
property containing that domain. So those prototypal methods need to be
overwritten. There's probably some post-bootstrap cleanup to be done on e.g.
stdio, but I haven't gotten around to cleaning that up yet, and I'm not sure
how many of these corner cases need to be handled for a POC.

## reading as opposed to setting / manipulating domains

There's a whole bunch of places where everything expects to see a domain
exposed:

* process.domain
* domain.active
* on EEs

Contexts (as created by `node-local-context`) look roughly like domains, but
they have different behavior in certain circumstances, and they need to be
shimmed to behave the same way -- the semantics of domains must not change as
a side effect of this module. This is all TODO once the basic APIs are working
and the best way to modularize the way e.g. nesting behavior has been
prototyped a little more extensively.
