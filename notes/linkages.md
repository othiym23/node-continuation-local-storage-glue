Requiring 'domain' causes:

* the event loop to switch to using _nextDomainTick and
  _tickDomainCallback.
* EventEmitters to propagate domains as they're instantiated

`domainspace` is the convention for indicating the domain namespace, with the
`domain` property on the contexts created on that namespace being where the
domains live.
