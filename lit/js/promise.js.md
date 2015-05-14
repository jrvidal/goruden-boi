
# Promise
A simple implementation of ES2015 Promises using ES2015 syntax. It's A+ compliant (as of [1.1.1](https://github.com/promises-aplus/promises-spec/blob/1.1.1/README.md)). However I've not delved into the specifics of the ES2015 Promise interface.

    "use strict";


We use several unexported symbols to "hide" the implementation details of the promise. It does not offer true encapsulation though.

    const INTERNALS = Symbol("internals"),
        STATE = {
            PENDING: Symbol("pending"),
            FULFILLED: Symbol("fulfilled"),
            REJECTED: Symbol("rejected"),
        },
        RESOLVE = Symbol("resolve"),
        REJECT = Symbol("reject"),
        IDENTITY = x => x,
        THROW = x => { throw x; };




    export default class Promise {

## constructor
The promise constructor is pretty straightforward. We use the `INTERNALS` symbol to store its state, result (value or reason) and the attached callbacks/errbacks.

        
        constructor(executor) {
            if (typeof executor !== "function") {
                throw new Error("executor should be a function");
            }

            this[INTERNALS] = {
                state: STATE.PENDING,
                result: null,

                callbacks: [],
                errbacks: [],
            };


Since `RESOLVE` and `REJECT` are (hidden) methods of the promise object, we have to bind them to the promise before passing them.

To do: handle errors thrown by `executor`.

        
        
        
        
        
            executor(this[RESOLVE].bind(this), this[REJECT].bind(this));
        }

### Then
`then` has to construct a new promise and wire the passed callback/errbacks to the settling of the original promise.

        

        then(onFulfilled, onRejected) {
            let internals = this[INTERNALS],
                promise = new Promise(IDENTITY),

The actual callback that will be enqueued and eventually invoked is not the one passed by the caller. Instead we must observe its returned value (or thrown error) and resolve (or reject) the returned promise accordingly.

                callback = value => {
                    try {
                        this[RESOLVE].call(promise, onFulfilled(value));
                    } catch (e) {
                        this[REJECT].call(promise, e);
                    }
                },

Same thing for the errback.

                errback = reason => {
                    try {
                        this[RESOLVE].call(promise, onRejected(reason));
                    } catch (e) {
                        this[REJECT].call(promise, e);
                    }
                };


Both parameters are optional, but not in the "ES2015 default parameters" sense, so we have to handle them manually.

            if (typeof onFulfilled !== "function") {
                onFulfilled = IDENTITY;
            }
            if (typeof onRejected !== "function") {
                onRejected = THROW;
            }

We short-circuit and asynchronously execute the callback if the promise is already settled. Otherwise, we add it to the promise internal queue.

            if (internals.state === STATE.FULFILLED) {
                delay(() => {
                    callback(internals.result);
                });
            } else if (internals.state === STATE.REJECTED) {
                delay(() => {
                    errback(internals.result);
                });
            } else {
                internals.callbacks.push(callback);
                internals.errbacks.push(errback);
            }

            return promise;
        }

## RESOLVE
Resolve is the trickiest part of the promise implementation since it has to be able to "follow" other promises/thenables.

        
        [RESOLVE](value) {
            let internals = this[INTERNALS];

            if (internals.state !== STATE.PENDING) return;

Promise cycles must be avoided.

            if (value === this) {
                throw new TypeError();
            }

The promise A+ spec handles "promises" and generic "thenables" in different sections, as a way to open the door for implementors to optimize the `RESOLVE` algorithm. We don't do that here and instead check always for generic thenables.

            let isThenable = value != null && (typeof value === "object" || typeof value === "function");


We _have_ to store `then` in a variable since we are allowed to retrieve it from the thenable only once.

            let then;
            try {
                then = isThenable && value.then;
                isThenable = isThenable && typeof then === "function";
            } catch (e) {

Retrieving `then` may throw. We just reject the promise in that case.

                this[REJECT](e);
                return;
            }


When a thenable is passed, we use its `then` method to wire its resolution to this promise. However, we have to shield the promise invariants from this unknown implementation. In particular, we have to make sure that only one call to any of the callbacks has effect.

A safe bet to do that is to use a closure that stores the `called` state of the callbacks.

            if (isThenable) {
                let called = false,
                    resolve = val => {
                        if (called) return;
                        called = true;
                        this[RESOLVE](val);
                    },
                    reject = reason => {
                        if (called) return;
                        called = true;
                        this[REJECT](reason);
                    };

                try {
                    then.call(value, resolve, reject);
                } catch (e) {

If `then` throws, we (try to) reject the promise.

                    reject(e);
                }

The simple non-thenable case (as in `REJECT`): update the state and value of the promise, asynchronously invoke all the callbacks.

            } else {
                internals.state = STATE.FULFILLED;
                internals.result = value;

                delay(() => {

Notice that this assumes (correctly) that the enqueued callbacks cannot throw.

                    internals.callbacks.forEach(callback => callback(value));

Minor cleanup. Since the callback array is no longer used we dispose of it and save some memory.

                    internals.callbacks = null;
                    internals.errbacks = null;
                });
            }
        }


## REJECT
`REJECT` is simpler than `RESOLVE`. It's basically equivalent to the "non-thenable" branch in the latter.

        
        
        
        [REJECT](reason) {
            let internals = this[INTERNALS];

            if (internals.state !== STATE.PENDING) return;

            internals.state = STATE.REJECTED;
            internals.result = reason;

            delay(() => {
                internals.errbacks.forEach(errback => errback(reason));
                internals.callbacks = null;
                internals.errbacks = null;
            });
        }
    }


A small `delay` implementation to ensure the asynchronicity of callbacks.

    function delay(fn) {
        setTimeout(() => fn(), 0);
    }
