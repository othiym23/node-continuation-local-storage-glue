* how much of the already-bootstrapped environment does the module need to
  replace? E.g. if I update the EE and Domain prototypes, will stdio be fine?
* at instantiation, each Domain creates an accompanying Context and stores
  itself as a "domain" on the Context -- what's the easiest way to flip that
  inside out and get rid of the containing relationship there?
* how do I get the domains nesting behavior (i.e. exit nested when containing
  is exited) into namespaces / contexts?
* Namespace -> Context -> (key,value) adds at least one layer of indirection
  to how domains work presently. Is there a cleaner way of handling this?
* I don't need to deal with any of the Timer clearing methods or unref, do I?
* need to do a sweep to make sure all the things that deal with domains are
  working properly with namespaces
* What's the simplest way to tie the knot between EEs, timers, domains, and
  the event loop?
* none of this is benchmarked yet; need to grab some of the pummel tests and
  adapt them to run this stuff
