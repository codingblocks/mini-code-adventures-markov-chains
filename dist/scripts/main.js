(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * scripts/main.js
 *
 * This is the starting point for your application.
 * Take a look at http://browserify.org/ for more info
 */

'use strict';

var App = require('./app.js');

var app = new App();

app.beep();

var MarkovChain = require('markovchain');

document.getElementById('generate').addEventListener('click', function() {
    var input = document.getElementById('input');
    var m = new MarkovChain(input.value);
    var output = m.process();
    document.getElementById('output').value = output;
});
},{"./app.js":2,"markovchain":5}],2:[function(require,module,exports){
/**
 * scripts/app.js
 *
 * This is a sample CommonJS module.
 * Take a look at http://browserify.org/ for more info
 */

'use strict';

function App() {
  console.log('app initialized');
}

module.exports = App;

App.prototype.beep = function () {
  console.log('boop');
};

},{}],3:[function(require,module,exports){
(function (process){
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback(null);
                    }
                }
            }));
        });
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        if (!keys.length) {
            return callback(null);
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (_keys(results).length === keys.length) {
                callback(null, results);
                callback = function () {};
            }
        });

        _each(keys, function (k) {
            var task = (tasks[k] instanceof Function) ? [tasks[k]]: tasks[k];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor !== Array) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            if (test()) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            if (!test()) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if(data.constructor !== Array) {
              data = [data];
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
                if(data.constructor !== Array) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain) cargo.drain();
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                callback.apply(null, memo[key]);
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.compose = function (/* functions... */) {
        var fns = Array.prototype.reverse.call(arguments);
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // AMD / RequireJS
    if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // Node.js
    else if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,require('_process'))
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9hc3luYy9saWIvYXN5bmMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIi8qZ2xvYmFsIHNldEltbWVkaWF0ZTogZmFsc2UsIHNldFRpbWVvdXQ6IGZhbHNlLCBjb25zb2xlOiBmYWxzZSAqL1xuKGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBhc3luYyA9IHt9O1xuXG4gICAgLy8gZ2xvYmFsIG9uIHRoZSBzZXJ2ZXIsIHdpbmRvdyBpbiB0aGUgYnJvd3NlclxuICAgIHZhciByb290LCBwcmV2aW91c19hc3luYztcblxuICAgIHJvb3QgPSB0aGlzO1xuICAgIGlmIChyb290ICE9IG51bGwpIHtcbiAgICAgIHByZXZpb3VzX2FzeW5jID0gcm9vdC5hc3luYztcbiAgICB9XG5cbiAgICBhc3luYy5ub0NvbmZsaWN0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByb290LmFzeW5jID0gcHJldmlvdXNfYXN5bmM7XG4gICAgICAgIHJldHVybiBhc3luYztcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gb25seV9vbmNlKGZuKSB7XG4gICAgICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKGNhbGxlZCkgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgd2FzIGFscmVhZHkgY2FsbGVkLlwiKTtcbiAgICAgICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICBmbi5hcHBseShyb290LCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8vLyBjcm9zcy1icm93c2VyIGNvbXBhdGlibGl0eSBmdW5jdGlvbnMgLy8vL1xuXG4gICAgdmFyIF9lYWNoID0gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IpIHtcbiAgICAgICAgaWYgKGFyci5mb3JFYWNoKSB7XG4gICAgICAgICAgICByZXR1cm4gYXJyLmZvckVhY2goaXRlcmF0b3IpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihhcnJbaV0sIGksIGFycik7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdmFyIF9tYXAgPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvcikge1xuICAgICAgICBpZiAoYXJyLm1hcCkge1xuICAgICAgICAgICAgcmV0dXJuIGFyci5tYXAoaXRlcmF0b3IpO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIF9lYWNoKGFyciwgZnVuY3Rpb24gKHgsIGksIGEpIHtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChpdGVyYXRvcih4LCBpLCBhKSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9O1xuXG4gICAgdmFyIF9yZWR1Y2UgPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgbWVtbykge1xuICAgICAgICBpZiAoYXJyLnJlZHVjZSkge1xuICAgICAgICAgICAgcmV0dXJuIGFyci5yZWR1Y2UoaXRlcmF0b3IsIG1lbW8pO1xuICAgICAgICB9XG4gICAgICAgIF9lYWNoKGFyciwgZnVuY3Rpb24gKHgsIGksIGEpIHtcbiAgICAgICAgICAgIG1lbW8gPSBpdGVyYXRvcihtZW1vLCB4LCBpLCBhKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH07XG5cbiAgICB2YXIgX2tleXMgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIGlmIChPYmplY3Qua2V5cykge1xuICAgICAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGtleXMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgayBpbiBvYmopIHtcbiAgICAgICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoaykpIHtcbiAgICAgICAgICAgICAgICBrZXlzLnB1c2goayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGtleXM7XG4gICAgfTtcblxuICAgIC8vLy8gZXhwb3J0ZWQgYXN5bmMgbW9kdWxlIGZ1bmN0aW9ucyAvLy8vXG5cbiAgICAvLy8vIG5leHRUaWNrIGltcGxlbWVudGF0aW9uIHdpdGggYnJvd3Nlci1jb21wYXRpYmxlIGZhbGxiYWNrIC8vLy9cbiAgICBpZiAodHlwZW9mIHByb2Nlc3MgPT09ICd1bmRlZmluZWQnIHx8ICEocHJvY2Vzcy5uZXh0VGljaykpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGFzeW5jLm5leHRUaWNrID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICAgICAgLy8gbm90IGEgZGlyZWN0IGFsaWFzIGZvciBJRTEwIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAgICAgICBzZXRJbW1lZGlhdGUoZm4pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGFzeW5jLnNldEltbWVkaWF0ZSA9IGFzeW5jLm5leHRUaWNrO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgYXN5bmMubmV4dFRpY2sgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUgPSBhc3luYy5uZXh0VGljaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgYXN5bmMubmV4dFRpY2sgPSBwcm9jZXNzLm5leHRUaWNrO1xuICAgICAgICBpZiAodHlwZW9mIHNldEltbWVkaWF0ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGFzeW5jLnNldEltbWVkaWF0ZSA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgICAvLyBub3QgYSBkaXJlY3QgYWxpYXMgZm9yIElFMTAgY29tcGF0aWJpbGl0eVxuICAgICAgICAgICAgICBzZXRJbW1lZGlhdGUoZm4pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGFzeW5jLnNldEltbWVkaWF0ZSA9IGFzeW5jLm5leHRUaWNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMuZWFjaCA9IGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgICAgICBfZWFjaChhcnIsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LCBvbmx5X29uY2UoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIGFzeW5jLmZvckVhY2ggPSBhc3luYy5lYWNoO1xuXG4gICAgYXN5bmMuZWFjaFNlcmllcyA9IGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgICAgICB2YXIgaXRlcmF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKGFycltjb21wbGV0ZWRdLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb21wbGV0ZWQgPj0gYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVyYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgaXRlcmF0ZSgpO1xuICAgIH07XG4gICAgYXN5bmMuZm9yRWFjaFNlcmllcyA9IGFzeW5jLmVhY2hTZXJpZXM7XG5cbiAgICBhc3luYy5lYWNoTGltaXQgPSBmdW5jdGlvbiAoYXJyLCBsaW1pdCwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBmbiA9IF9lYWNoTGltaXQobGltaXQpO1xuICAgICAgICBmbi5hcHBseShudWxsLCBbYXJyLCBpdGVyYXRvciwgY2FsbGJhY2tdKTtcbiAgICB9O1xuICAgIGFzeW5jLmZvckVhY2hMaW1pdCA9IGFzeW5jLmVhY2hMaW1pdDtcblxuICAgIHZhciBfZWFjaExpbWl0ID0gZnVuY3Rpb24gKGxpbWl0KSB7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgIGlmICghYXJyLmxlbmd0aCB8fCBsaW1pdCA8PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY29tcGxldGVkID0gMDtcbiAgICAgICAgICAgIHZhciBzdGFydGVkID0gMDtcbiAgICAgICAgICAgIHZhciBydW5uaW5nID0gMDtcblxuICAgICAgICAgICAgKGZ1bmN0aW9uIHJlcGxlbmlzaCAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHdoaWxlIChydW5uaW5nIDwgbGltaXQgJiYgc3RhcnRlZCA8IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnRlZCArPSAxO1xuICAgICAgICAgICAgICAgICAgICBydW5uaW5nICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIGl0ZXJhdG9yKGFycltzdGFydGVkIC0gMV0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZWQgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBydW5uaW5nIC09IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBsZW5pc2goKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pKCk7XG4gICAgICAgIH07XG4gICAgfTtcblxuXG4gICAgdmFyIGRvUGFyYWxsZWwgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBbYXN5bmMuZWFjaF0uY29uY2F0KGFyZ3MpKTtcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIHZhciBkb1BhcmFsbGVsTGltaXQgPSBmdW5jdGlvbihsaW1pdCwgZm4pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBbX2VhY2hMaW1pdChsaW1pdCldLmNvbmNhdChhcmdzKSk7XG4gICAgICAgIH07XG4gICAgfTtcbiAgICB2YXIgZG9TZXJpZXMgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBbYXN5bmMuZWFjaFNlcmllc10uY29uY2F0KGFyZ3MpKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG5cbiAgICB2YXIgX2FzeW5jTWFwID0gZnVuY3Rpb24gKGVhY2hmbiwgYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgYXJyID0gX21hcChhcnIsIGZ1bmN0aW9uICh4LCBpKSB7XG4gICAgICAgICAgICByZXR1cm4ge2luZGV4OiBpLCB2YWx1ZTogeH07XG4gICAgICAgIH0pO1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzW3guaW5kZXhdID0gdjtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgYXN5bmMubWFwID0gZG9QYXJhbGxlbChfYXN5bmNNYXApO1xuICAgIGFzeW5jLm1hcFNlcmllcyA9IGRvU2VyaWVzKF9hc3luY01hcCk7XG4gICAgYXN5bmMubWFwTGltaXQgPSBmdW5jdGlvbiAoYXJyLCBsaW1pdCwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHJldHVybiBfbWFwTGltaXQobGltaXQpKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKTtcbiAgICB9O1xuXG4gICAgdmFyIF9tYXBMaW1pdCA9IGZ1bmN0aW9uKGxpbWl0KSB7XG4gICAgICAgIHJldHVybiBkb1BhcmFsbGVsTGltaXQobGltaXQsIF9hc3luY01hcCk7XG4gICAgfTtcblxuICAgIC8vIHJlZHVjZSBvbmx5IGhhcyBhIHNlcmllcyB2ZXJzaW9uLCBhcyBkb2luZyByZWR1Y2UgaW4gcGFyYWxsZWwgd29uJ3RcbiAgICAvLyB3b3JrIGluIG1hbnkgc2l0dWF0aW9ucy5cbiAgICBhc3luYy5yZWR1Y2UgPSBmdW5jdGlvbiAoYXJyLCBtZW1vLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgYXN5bmMuZWFjaFNlcmllcyhhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaXRlcmF0b3IobWVtbywgeCwgZnVuY3Rpb24gKGVyciwgdikge1xuICAgICAgICAgICAgICAgIG1lbW8gPSB2O1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBtZW1vKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICAvLyBpbmplY3QgYWxpYXNcbiAgICBhc3luYy5pbmplY3QgPSBhc3luYy5yZWR1Y2U7XG4gICAgLy8gZm9sZGwgYWxpYXNcbiAgICBhc3luYy5mb2xkbCA9IGFzeW5jLnJlZHVjZTtcblxuICAgIGFzeW5jLnJlZHVjZVJpZ2h0ID0gZnVuY3Rpb24gKGFyciwgbWVtbywgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciByZXZlcnNlZCA9IF9tYXAoYXJyLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgcmV0dXJuIHg7XG4gICAgICAgIH0pLnJldmVyc2UoKTtcbiAgICAgICAgYXN5bmMucmVkdWNlKHJldmVyc2VkLCBtZW1vLCBpdGVyYXRvciwgY2FsbGJhY2spO1xuICAgIH07XG4gICAgLy8gZm9sZHIgYWxpYXNcbiAgICBhc3luYy5mb2xkciA9IGFzeW5jLnJlZHVjZVJpZ2h0O1xuXG4gICAgdmFyIF9maWx0ZXIgPSBmdW5jdGlvbiAoZWFjaGZuLCBhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBhcnIgPSBfbWFwKGFyciwgZnVuY3Rpb24gKHgsIGkpIHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGksIHZhbHVlOiB4fTtcbiAgICAgICAgfSk7XG4gICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaXRlcmF0b3IoeC52YWx1ZSwgZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goeCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soX21hcChyZXN1bHRzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYS5pbmRleCAtIGIuaW5kZXg7XG4gICAgICAgICAgICB9KSwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geC52YWx1ZTtcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBhc3luYy5maWx0ZXIgPSBkb1BhcmFsbGVsKF9maWx0ZXIpO1xuICAgIGFzeW5jLmZpbHRlclNlcmllcyA9IGRvU2VyaWVzKF9maWx0ZXIpO1xuICAgIC8vIHNlbGVjdCBhbGlhc1xuICAgIGFzeW5jLnNlbGVjdCA9IGFzeW5jLmZpbHRlcjtcbiAgICBhc3luYy5zZWxlY3RTZXJpZXMgPSBhc3luYy5maWx0ZXJTZXJpZXM7XG5cbiAgICB2YXIgX3JlamVjdCA9IGZ1bmN0aW9uIChlYWNoZm4sIGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIGFyciA9IF9tYXAoYXJyLCBmdW5jdGlvbiAoeCwgaSkge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogaSwgdmFsdWU6IHh9O1xuICAgICAgICB9KTtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICghdikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goeCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soX21hcChyZXN1bHRzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYS5pbmRleCAtIGIuaW5kZXg7XG4gICAgICAgICAgICB9KSwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geC52YWx1ZTtcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBhc3luYy5yZWplY3QgPSBkb1BhcmFsbGVsKF9yZWplY3QpO1xuICAgIGFzeW5jLnJlamVjdFNlcmllcyA9IGRvU2VyaWVzKF9yZWplY3QpO1xuXG4gICAgdmFyIF9kZXRlY3QgPSBmdW5jdGlvbiAoZWFjaGZuLCBhcnIsIGl0ZXJhdG9yLCBtYWluX2NhbGxiYWNrKSB7XG4gICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaXRlcmF0b3IoeCwgZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgbWFpbl9jYWxsYmFjayh4KTtcbiAgICAgICAgICAgICAgICAgICAgbWFpbl9jYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgbWFpbl9jYWxsYmFjaygpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIGFzeW5jLmRldGVjdCA9IGRvUGFyYWxsZWwoX2RldGVjdCk7XG4gICAgYXN5bmMuZGV0ZWN0U2VyaWVzID0gZG9TZXJpZXMoX2RldGVjdCk7XG5cbiAgICBhc3luYy5zb21lID0gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IsIG1haW5fY2FsbGJhY2spIHtcbiAgICAgICAgYXN5bmMuZWFjaChhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaXRlcmF0b3IoeCwgZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgICAgICAgICBtYWluX2NhbGxiYWNrKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBtYWluX2NhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgbWFpbl9jYWxsYmFjayhmYWxzZSk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgLy8gYW55IGFsaWFzXG4gICAgYXN5bmMuYW55ID0gYXN5bmMuc29tZTtcblxuICAgIGFzeW5jLmV2ZXJ5ID0gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IsIG1haW5fY2FsbGJhY2spIHtcbiAgICAgICAgYXN5bmMuZWFjaChhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaXRlcmF0b3IoeCwgZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXYpIHtcbiAgICAgICAgICAgICAgICAgICAgbWFpbl9jYWxsYmFjayhmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIG1haW5fY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBtYWluX2NhbGxiYWNrKHRydWUpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8vIGFsbCBhbGlhc1xuICAgIGFzeW5jLmFsbCA9IGFzeW5jLmV2ZXJ5O1xuXG4gICAgYXN5bmMuc29ydEJ5ID0gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIGFzeW5jLm1hcChhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaXRlcmF0b3IoeCwgZnVuY3Rpb24gKGVyciwgY3JpdGVyaWEpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB7dmFsdWU6IHgsIGNyaXRlcmlhOiBjcml0ZXJpYX0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgZm4gPSBmdW5jdGlvbiAobGVmdCwgcmlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGEgPSBsZWZ0LmNyaXRlcmlhLCBiID0gcmlnaHQuY3JpdGVyaWE7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhIDwgYiA/IC0xIDogYSA+IGIgPyAxIDogMDtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIF9tYXAocmVzdWx0cy5zb3J0KGZuKSwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHgudmFsdWU7XG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMuYXV0byA9IGZ1bmN0aW9uICh0YXNrcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgdmFyIGtleXMgPSBfa2V5cyh0YXNrcyk7XG4gICAgICAgIGlmICgha2V5cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByZXN1bHRzID0ge307XG5cbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IFtdO1xuICAgICAgICB2YXIgYWRkTGlzdGVuZXIgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgIGxpc3RlbmVycy51bnNoaWZ0KGZuKTtcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIHJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGlmIChsaXN0ZW5lcnNbaV0gPT09IGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGxpc3RlbmVycy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHZhciB0YXNrQ29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBfZWFjaChsaXN0ZW5lcnMuc2xpY2UoMCksIGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBhZGRMaXN0ZW5lcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoX2tleXMocmVzdWx0cykubGVuZ3RoID09PSBrZXlzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIF9lYWNoKGtleXMsIGZ1bmN0aW9uIChrKSB7XG4gICAgICAgICAgICB2YXIgdGFzayA9ICh0YXNrc1trXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSA/IFt0YXNrc1trXV06IHRhc2tzW2tdO1xuICAgICAgICAgICAgdmFyIHRhc2tDYWxsYmFjayA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNhZmVSZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgIF9lYWNoKF9rZXlzKHJlc3VsdHMpLCBmdW5jdGlvbihya2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzYWZlUmVzdWx0c1tya2V5XSA9IHJlc3VsdHNbcmtleV07XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzYWZlUmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgc2FmZVJlc3VsdHMpO1xuICAgICAgICAgICAgICAgICAgICAvLyBzdG9wIHN1YnNlcXVlbnQgZXJyb3JzIGhpdHRpbmcgY2FsbGJhY2sgbXVsdGlwbGUgdGltZXNcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUodGFza0NvbXBsZXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIHJlcXVpcmVzID0gdGFzay5zbGljZSgwLCBNYXRoLmFicyh0YXNrLmxlbmd0aCAtIDEpKSB8fCBbXTtcbiAgICAgICAgICAgIHZhciByZWFkeSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gX3JlZHVjZShyZXF1aXJlcywgZnVuY3Rpb24gKGEsIHgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChhICYmIHJlc3VsdHMuaGFzT3duUHJvcGVydHkoeCkpO1xuICAgICAgICAgICAgICAgIH0sIHRydWUpICYmICFyZXN1bHRzLmhhc093blByb3BlcnR5KGspO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChyZWFkeSgpKSB7XG4gICAgICAgICAgICAgICAgdGFza1t0YXNrLmxlbmd0aCAtIDFdKHRhc2tDYWxsYmFjaywgcmVzdWx0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWFkeSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVMaXN0ZW5lcihsaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXNrW3Rhc2subGVuZ3RoIC0gMV0odGFza0NhbGxiYWNrLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYWRkTGlzdGVuZXIobGlzdGVuZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMud2F0ZXJmYWxsID0gZnVuY3Rpb24gKHRhc2tzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAodGFza3MuY29uc3RydWN0b3IgIT09IEFycmF5KSB7XG4gICAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignRmlyc3QgYXJndW1lbnQgdG8gd2F0ZXJmYWxsIG11c3QgYmUgYW4gYXJyYXkgb2YgZnVuY3Rpb25zJyk7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0YXNrcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIHZhciB3cmFwSXRlcmF0b3IgPSBmdW5jdGlvbiAoaXRlcmF0b3IpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbmV4dCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MucHVzaCh3cmFwSXRlcmF0b3IobmV4dCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJncy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXRlcmF0b3IuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgICAgIHdyYXBJdGVyYXRvcihhc3luYy5pdGVyYXRvcih0YXNrcykpKCk7XG4gICAgfTtcblxuICAgIHZhciBfcGFyYWxsZWwgPSBmdW5jdGlvbihlYWNoZm4sIHRhc2tzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAodGFza3MuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgICAgICBlYWNoZm4ubWFwKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZuKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKG51bGwsIGVyciwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICBlYWNoZm4uZWFjaChfa2V5cyh0YXNrcyksIGZ1bmN0aW9uIChrLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIHRhc2tzW2tdKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGFzeW5jLnBhcmFsbGVsID0gZnVuY3Rpb24gKHRhc2tzLCBjYWxsYmFjaykge1xuICAgICAgICBfcGFyYWxsZWwoeyBtYXA6IGFzeW5jLm1hcCwgZWFjaDogYXN5bmMuZWFjaCB9LCB0YXNrcywgY2FsbGJhY2spO1xuICAgIH07XG5cbiAgICBhc3luYy5wYXJhbGxlbExpbWl0ID0gZnVuY3Rpb24odGFza3MsIGxpbWl0LCBjYWxsYmFjaykge1xuICAgICAgICBfcGFyYWxsZWwoeyBtYXA6IF9tYXBMaW1pdChsaW1pdCksIGVhY2g6IF9lYWNoTGltaXQobGltaXQpIH0sIHRhc2tzLCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIGFzeW5jLnNlcmllcyA9IGZ1bmN0aW9uICh0YXNrcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKHRhc2tzLmNvbnN0cnVjdG9yID09PSBBcnJheSkge1xuICAgICAgICAgICAgYXN5bmMubWFwU2VyaWVzKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZuKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKG51bGwsIGVyciwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICBhc3luYy5lYWNoU2VyaWVzKF9rZXlzKHRhc2tzKSwgZnVuY3Rpb24gKGssIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgdGFza3Nba10oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzW2tdID0gYXJncztcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgYXN5bmMuaXRlcmF0b3IgPSBmdW5jdGlvbiAodGFza3MpIHtcbiAgICAgICAgdmFyIG1ha2VDYWxsYmFjayA9IGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICAgICAgdmFyIGZuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGlmICh0YXNrcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFza3NbaW5kZXhdLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBmbi5uZXh0KCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZm4ubmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGluZGV4IDwgdGFza3MubGVuZ3RoIC0gMSkgPyBtYWtlQ2FsbGJhY2soaW5kZXggKyAxKTogbnVsbDtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gZm47XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBtYWtlQ2FsbGJhY2soMCk7XG4gICAgfTtcblxuICAgIGFzeW5jLmFwcGx5ID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBmbi5hcHBseShcbiAgICAgICAgICAgICAgICBudWxsLCBhcmdzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgdmFyIF9jb25jYXQgPSBmdW5jdGlvbiAoZWFjaGZuLCBhcnIsIGZuLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgciA9IFtdO1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2IpIHtcbiAgICAgICAgICAgIGZuKHgsIGZ1bmN0aW9uIChlcnIsIHkpIHtcbiAgICAgICAgICAgICAgICByID0gci5jb25jYXQoeSB8fCBbXSk7XG4gICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHIpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIGFzeW5jLmNvbmNhdCA9IGRvUGFyYWxsZWwoX2NvbmNhdCk7XG4gICAgYXN5bmMuY29uY2F0U2VyaWVzID0gZG9TZXJpZXMoX2NvbmNhdCk7XG5cbiAgICBhc3luYy53aGlsc3QgPSBmdW5jdGlvbiAodGVzdCwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICh0ZXN0KCkpIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBhc3luYy53aGlsc3QodGVzdCwgaXRlcmF0b3IsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYy5kb1doaWxzdCA9IGZ1bmN0aW9uIChpdGVyYXRvciwgdGVzdCwgY2FsbGJhY2spIHtcbiAgICAgICAgaXRlcmF0b3IoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRlc3QoKSkge1xuICAgICAgICAgICAgICAgIGFzeW5jLmRvV2hpbHN0KGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMudW50aWwgPSBmdW5jdGlvbiAodGVzdCwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGVzdCgpKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYXN5bmMudW50aWwodGVzdCwgaXRlcmF0b3IsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYy5kb1VudGlsID0gZnVuY3Rpb24gKGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjaykge1xuICAgICAgICBpdGVyYXRvcihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRlc3QoKSkge1xuICAgICAgICAgICAgICAgIGFzeW5jLmRvVW50aWwoaXRlcmF0b3IsIHRlc3QsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYy5xdWV1ZSA9IGZ1bmN0aW9uICh3b3JrZXIsIGNvbmN1cnJlbmN5KSB7XG4gICAgICAgIGlmIChjb25jdXJyZW5jeSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb25jdXJyZW5jeSA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gX2luc2VydChxLCBkYXRhLCBwb3MsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgaWYoZGF0YS5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpIHtcbiAgICAgICAgICAgICAgZGF0YSA9IFtkYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgX2VhY2goZGF0YSwgZnVuY3Rpb24odGFzaykge1xuICAgICAgICAgICAgICB2YXIgaXRlbSA9IHtcbiAgICAgICAgICAgICAgICAgIGRhdGE6IHRhc2ssXG4gICAgICAgICAgICAgICAgICBjYWxsYmFjazogdHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nID8gY2FsbGJhY2sgOiBudWxsXG4gICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgaWYgKHBvcykge1xuICAgICAgICAgICAgICAgIHEudGFza3MudW5zaGlmdChpdGVtKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBxLnRhc2tzLnB1c2goaXRlbSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBpZiAocS5zYXR1cmF0ZWQgJiYgcS50YXNrcy5sZW5ndGggPT09IGNvbmN1cnJlbmN5KSB7XG4gICAgICAgICAgICAgICAgICBxLnNhdHVyYXRlZCgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGFzeW5jLnNldEltbWVkaWF0ZShxLnByb2Nlc3MpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHdvcmtlcnMgPSAwO1xuICAgICAgICB2YXIgcSA9IHtcbiAgICAgICAgICAgIHRhc2tzOiBbXSxcbiAgICAgICAgICAgIGNvbmN1cnJlbmN5OiBjb25jdXJyZW5jeSxcbiAgICAgICAgICAgIHNhdHVyYXRlZDogbnVsbCxcbiAgICAgICAgICAgIGVtcHR5OiBudWxsLFxuICAgICAgICAgICAgZHJhaW46IG51bGwsXG4gICAgICAgICAgICBwdXNoOiBmdW5jdGlvbiAoZGF0YSwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgX2luc2VydChxLCBkYXRhLCBmYWxzZSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHVuc2hpZnQ6IGZ1bmN0aW9uIChkYXRhLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICBfaW5zZXJ0KHEsIGRhdGEsIHRydWUsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9jZXNzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHdvcmtlcnMgPCBxLmNvbmN1cnJlbmN5ICYmIHEudGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXNrID0gcS50YXNrcy5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocS5lbXB0eSAmJiBxLnRhc2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcS5lbXB0eSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHdvcmtlcnMgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JrZXJzIC09IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFzay5jYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhc2suY2FsbGJhY2suYXBwbHkodGFzaywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChxLmRyYWluICYmIHEudGFza3MubGVuZ3RoICsgd29ya2VycyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHEuZHJhaW4oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHEucHJvY2VzcygpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2IgPSBvbmx5X29uY2UobmV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHdvcmtlcih0YXNrLmRhdGEsIGNiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGVuZ3RoOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHEudGFza3MubGVuZ3RoO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJ1bm5pbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gd29ya2VycztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHE7XG4gICAgfTtcblxuICAgIGFzeW5jLmNhcmdvID0gZnVuY3Rpb24gKHdvcmtlciwgcGF5bG9hZCkge1xuICAgICAgICB2YXIgd29ya2luZyAgICAgPSBmYWxzZSxcbiAgICAgICAgICAgIHRhc2tzICAgICAgID0gW107XG5cbiAgICAgICAgdmFyIGNhcmdvID0ge1xuICAgICAgICAgICAgdGFza3M6IHRhc2tzLFxuICAgICAgICAgICAgcGF5bG9hZDogcGF5bG9hZCxcbiAgICAgICAgICAgIHNhdHVyYXRlZDogbnVsbCxcbiAgICAgICAgICAgIGVtcHR5OiBudWxsLFxuICAgICAgICAgICAgZHJhaW46IG51bGwsXG4gICAgICAgICAgICBwdXNoOiBmdW5jdGlvbiAoZGF0YSwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZihkYXRhLmNvbnN0cnVjdG9yICE9PSBBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICBkYXRhID0gW2RhdGFdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBfZWFjaChkYXRhLCBmdW5jdGlvbih0YXNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogdGFzayxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrOiB0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicgPyBjYWxsYmFjayA6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYXJnby5zYXR1cmF0ZWQgJiYgdGFza3MubGVuZ3RoID09PSBwYXlsb2FkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXJnby5zYXR1cmF0ZWQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGFzeW5jLnNldEltbWVkaWF0ZShjYXJnby5wcm9jZXNzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9jZXNzOiBmdW5jdGlvbiBwcm9jZXNzKCkge1xuICAgICAgICAgICAgICAgIGlmICh3b3JraW5nKSByZXR1cm47XG4gICAgICAgICAgICAgICAgaWYgKHRhc2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBpZihjYXJnby5kcmFpbikgY2FyZ28uZHJhaW4oKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciB0cyA9IHR5cGVvZiBwYXlsb2FkID09PSAnbnVtYmVyJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gdGFza3Muc3BsaWNlKDAsIHBheWxvYWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiB0YXNrcy5zcGxpY2UoMCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgZHMgPSBfbWFwKHRzLCBmdW5jdGlvbiAodGFzaykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGFzay5kYXRhO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYoY2FyZ28uZW1wdHkpIGNhcmdvLmVtcHR5KCk7XG4gICAgICAgICAgICAgICAgd29ya2luZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgd29ya2VyKGRzLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHdvcmtpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgICAgICAgICAgICAgICAgX2VhY2godHMsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5jYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEuY2FsbGJhY2suYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIHByb2Nlc3MoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsZW5ndGg6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFza3MubGVuZ3RoO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJ1bm5pbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gd29ya2luZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGNhcmdvO1xuICAgIH07XG5cbiAgICB2YXIgX2NvbnNvbGVfZm4gPSBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzLmNvbmNhdChbZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25zb2xlLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbnNvbGVbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9lYWNoKGFyZ3MsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZVtuYW1lXSh4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfV0pKTtcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIGFzeW5jLmxvZyA9IF9jb25zb2xlX2ZuKCdsb2cnKTtcbiAgICBhc3luYy5kaXIgPSBfY29uc29sZV9mbignZGlyJyk7XG4gICAgLyphc3luYy5pbmZvID0gX2NvbnNvbGVfZm4oJ2luZm8nKTtcbiAgICBhc3luYy53YXJuID0gX2NvbnNvbGVfZm4oJ3dhcm4nKTtcbiAgICBhc3luYy5lcnJvciA9IF9jb25zb2xlX2ZuKCdlcnJvcicpOyovXG5cbiAgICBhc3luYy5tZW1vaXplID0gZnVuY3Rpb24gKGZuLCBoYXNoZXIpIHtcbiAgICAgICAgdmFyIG1lbW8gPSB7fTtcbiAgICAgICAgdmFyIHF1ZXVlcyA9IHt9O1xuICAgICAgICBoYXNoZXIgPSBoYXNoZXIgfHwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4O1xuICAgICAgICB9O1xuICAgICAgICB2YXIgbWVtb2l6ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzLnBvcCgpO1xuICAgICAgICAgICAgdmFyIGtleSA9IGhhc2hlci5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgICAgIGlmIChrZXkgaW4gbWVtbykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KG51bGwsIG1lbW9ba2V5XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChrZXkgaW4gcXVldWVzKSB7XG4gICAgICAgICAgICAgICAgcXVldWVzW2tleV0ucHVzaChjYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBxdWV1ZXNba2V5XSA9IFtjYWxsYmFja107XG4gICAgICAgICAgICAgICAgZm4uYXBwbHkobnVsbCwgYXJncy5jb25jYXQoW2Z1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtb1trZXldID0gYXJndW1lbnRzO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcSA9IHF1ZXVlc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgcXVldWVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gcS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICBxW2ldLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBtZW1vaXplZC5tZW1vID0gbWVtbztcbiAgICAgICAgbWVtb2l6ZWQudW5tZW1vaXplZCA9IGZuO1xuICAgICAgICByZXR1cm4gbWVtb2l6ZWQ7XG4gICAgfTtcblxuICAgIGFzeW5jLnVubWVtb2l6ZSA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIChmbi51bm1lbW9pemVkIHx8IGZuKS5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9O1xuXG4gICAgYXN5bmMudGltZXMgPSBmdW5jdGlvbiAoY291bnQsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgY291bnRlciA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvdW50ZXIucHVzaChpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXN5bmMubWFwKGNvdW50ZXIsIGl0ZXJhdG9yLCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIGFzeW5jLnRpbWVzU2VyaWVzID0gZnVuY3Rpb24gKGNvdW50LCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGNvdW50ZXIgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb3VudGVyLnB1c2goaSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFzeW5jLm1hcFNlcmllcyhjb3VudGVyLCBpdGVyYXRvciwgY2FsbGJhY2spO1xuICAgIH07XG5cbiAgICBhc3luYy5jb21wb3NlID0gZnVuY3Rpb24gKC8qIGZ1bmN0aW9ucy4uLiAqLykge1xuICAgICAgICB2YXIgZm5zID0gQXJyYXkucHJvdG90eXBlLnJldmVyc2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICAgICAgICAgIGFzeW5jLnJlZHVjZShmbnMsIGFyZ3MsIGZ1bmN0aW9uIChuZXdhcmdzLCBmbiwgY2IpIHtcbiAgICAgICAgICAgICAgICBmbi5hcHBseSh0aGF0LCBuZXdhcmdzLmNvbmNhdChbZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbmV4dGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICBjYihlcnIsIG5leHRhcmdzKTtcbiAgICAgICAgICAgICAgICB9XSkpXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoYXQsIFtlcnJdLmNvbmNhdChyZXN1bHRzKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgdmFyIF9hcHBseUVhY2ggPSBmdW5jdGlvbiAoZWFjaGZuLCBmbnMgLyphcmdzLi4uKi8pIHtcbiAgICAgICAgdmFyIGdvID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICAgICAgICAgIHJldHVybiBlYWNoZm4oZm5zLCBmdW5jdGlvbiAoZm4sIGNiKSB7XG4gICAgICAgICAgICAgICAgZm4uYXBwbHkodGhhdCwgYXJncy5jb25jYXQoW2NiXSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNhbGxiYWNrKTtcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgICAgICByZXR1cm4gZ28uYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZ287XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGFzeW5jLmFwcGx5RWFjaCA9IGRvUGFyYWxsZWwoX2FwcGx5RWFjaCk7XG4gICAgYXN5bmMuYXBwbHlFYWNoU2VyaWVzID0gZG9TZXJpZXMoX2FwcGx5RWFjaCk7XG5cbiAgICBhc3luYy5mb3JldmVyID0gZnVuY3Rpb24gKGZuLCBjYWxsYmFjaykge1xuICAgICAgICBmdW5jdGlvbiBuZXh0KGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm4obmV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgbmV4dCgpO1xuICAgIH07XG5cbiAgICAvLyBBTUQgLyBSZXF1aXJlSlNcbiAgICBpZiAodHlwZW9mIGRlZmluZSAhPT0gJ3VuZGVmaW5lZCcgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICBkZWZpbmUoW10sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBhc3luYztcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8vIE5vZGUuanNcbiAgICBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGFzeW5jO1xuICAgIH1cbiAgICAvLyBpbmNsdWRlZCBkaXJlY3RseSB2aWEgPHNjcmlwdD4gdGFnXG4gICAgZWxzZSB7XG4gICAgICAgIHJvb3QuYXN5bmMgPSBhc3luYztcbiAgICB9XG5cbn0oKSk7XG4iXX0=
},{"_process":10}],4:[function(require,module,exports){

},{}],5:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var pickOneByWeight = require('pick-one-by-weight');

var isType = function isType(t) {
  return Object.prototype.toString.call(t).slice(8, -1).toLowerCase();
};

var MarkovChain = (function () {
  function MarkovChain(contents) {
    var normFn = arguments.length <= 1 || arguments[1] === undefined ? function (word) {
      return word.replace(/\.$/ig, '');
    } : arguments[1];

    _classCallCheck(this, MarkovChain);

    this.wordBank = Object.create(null);
    this.sentence = '';
    this._normalizeFn = normFn;
    this.parseBy = /(?:\.|\?|\n)/ig;
    this.parse(contents);
  }

  _createClass(MarkovChain, [{
    key: 'startFn',
    value: function startFn(wordList) {
      var k = Object.keys(wordList);
      var l = k.length;
      return k[~ ~(Math.random() * l)];
    }
  }, {
    key: 'endFn',
    value: function endFn() {
      return this.sentence.split(' ').length > 7;
    }
  }, {
    key: 'process',
    value: function process() {
      var curWord = this.startFn(this.wordBank);
      this.sentence = curWord;
      while (this.wordBank[curWord] && !this.endFn()) {
        curWord = pickOneByWeight(this.wordBank[curWord]);
        this.sentence += ' ' + curWord;
      }
      return this.sentence;
    }
  }, {
    key: 'parse',
    value: function parse() {
      var _this = this;

      var text = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
      var parseBy = arguments.length <= 1 || arguments[1] === undefined ? this.parseBy : arguments[1];

      text.split(parseBy).forEach(function (lines) {
        var words = lines.split(' ').filter(function (w) {
          return w.trim() !== '';
        });
        for (var i = 0; i < words.length - 1; i++) {
          var curWord = _this._normalize(words[i]);
          var nextWord = _this._normalize(words[i + 1]);

          if (!_this.wordBank[curWord]) {
            _this.wordBank[curWord] = Object.create(null);
          }
          if (!_this.wordBank[curWord][nextWord]) {
            _this.wordBank[curWord][nextWord] = 1;
          } else {
            _this.wordBank[curWord][nextWord] += 1;
          }
        }
      });
      return this;
    }
  }, {
    key: 'start',
    value: function start(fnStr) {
      var startType = isType(fnStr);
      if (startType === 'string') {
        this.startFn = function () {
          return fnStr;
        };
      } else if (startType === 'function') {
        this.startFn = function (wordList) {
          return fnStr(wordList);
        };
      } else {
        throw new Error('Must pass a function, or string into start()');
      }
      return this;
    }
  }, {
    key: 'end',
    value: function end(fnStrOrNum) {
      var _this2 = this;

      var endType = isType(fnStrOrNum);
      var self = this;

      if (endType === 'function') {
        this.endFn = function () {
          return fnStrOrNum(_this2.sentence);
        };
      } else if (endType === 'string') {
        this.endFn = function () {
          return _this2.sentence.split(' ').slice(-1)[0] === fnStrOrNum;
        };
      } else if (endType === 'number' || fnStrOrNum === undefined) {
        fnStrOrNum = fnStrOrNum || Infinity;
        this.endFn = function () {
          return self.sentence.split(' ').length > fnStrOrNum;
        };
      } else {
        throw new Error('Must pass a function, string or number into end()');
      }
      return this;
    }
  }, {
    key: '_normalize',
    value: function _normalize(word) {
      return this._normalizeFn(word);
    }
  }, {
    key: 'normalize',
    value: function normalize(fn) {
      this._normalizeFn = fn;
      return this;
    }
  }], [{
    key: 'VERSION',
    get: function get() {
      return require('../package').version;
    }
  }, {
    key: 'MarkovChain',
    get: function get() {
      // load older MarkovChain
      return require('../older/index.js').MarkovChain;
    }
  }]);

  return MarkovChain;
})();

module.exports = MarkovChain;
},{"../older/index.js":6,"../package":7,"pick-one-by-weight":9}],6:[function(require,module,exports){
(function (process){
'use strict';

var async = require('async')
  , fs = require('fs')
  , path = require('path')
  , pickOneByWeight = require('pick-one-by-weight')
  , isType
  , kindaFile
  , MarkovChain

isType = function(t) {
  return Object.prototype.toString.call(t).slice(8, -1).toLowerCase()
}

kindaFile = function(file) {
  return file.indexOf('.' + path.sep) === 0 || file.indexOf(path.sep) === 0
}

MarkovChain = function(args) {
  if (!args) { args = {} }
  this.wordBank = {}
  this.sentence = ''
  this.files = []
  if (args.files) {
    return this.use(args.files)
  }

  this.startFn = function(wordList) {
    var k = Object.keys(wordList)
    var l = k.length

    return k[~~(Math.random()*l)]
  }

  this.endFn = function() {
    return this.sentence.split(' ').length > 7
  }

  return this
}

MarkovChain.prototype.VERSION = require('../package').version

MarkovChain.prototype.use = function(files) {
  if (isType(files) === 'array') {
    this.files = files
  }
  else if (isType(files) === 'string') {
    this.files = [files]
  }
  else {
    throw new Error('Need to pass a string or array for use()')
  }
  return this
}

MarkovChain.prototype.readFile = function(file) {
  return function(callback) {
    fs.readFile(file, 'utf8', function(err, data) {
      if (err) {
        // if the file does not exist,
        // if `file` starts with ./ or /, assuming trying to be a file
        // if `file` has a '.', and the string after that has no space, assume file
        if (err.code === 'ENOENT' && !kindaFile(file)) {
          return callback(null, file);
        }
        return callback(err)
      }
      process.nextTick(function() { callback(null, data) })
    })
  }
}

MarkovChain.prototype.countTotal = function(word) {
  var total = 0
    , prop

  for (prop in this.wordBank[word]) {
    if (this.wordBank[word].hasOwnProperty(prop)) {
      total += this.wordBank[word][prop]
    }
  }
  return total
}

MarkovChain.prototype.process = function(callback) {
  var readFiles = []

  this.files.forEach(function(file) {
    readFiles.push(this.readFile(file))
  }.bind(this))

  async.parallel(readFiles, function(err, retFiles) {
    var words
      , curWord
    this.parseFile(retFiles.toString())

    curWord = this.startFn(this.wordBank)

    this.sentence = curWord

    while (this.wordBank[curWord] && !this.endFn()) {
      curWord = pickOneByWeight(this.wordBank[curWord])
      this.sentence += ' ' + curWord
    }
    callback(null, this.sentence.trim())

  }.bind(this))

  return this
}

MarkovChain.prototype.parseFile = function(file) {
  // splits sentences based on either an end line
  // or a period (followed by a space)
  file.split(/(?:\. |\n)/ig).forEach(function(lines) {
    var curWord
      , i
      , nextWord
      , words

    words = lines.split(' ').filter(function(w) { return (w.trim() !== '') })
    for (i = 0; i < words.length - 1; i++) {
      curWord = this.normalize(words[i])
      nextWord = this.normalize(words[i + 1])
      if (!this.wordBank[curWord]) {
        this.wordBank[curWord] = {}
      }
      if (!this.wordBank[curWord][nextWord]) {
        this.wordBank[curWord][nextWord] = 1
      }
      else {
        this.wordBank[curWord][nextWord] += 1
      }
    }
  }.bind(this))
}

MarkovChain.prototype.start = function(fnStr) {
  var startType = isType(fnStr)
  if (startType === 'string') {
    this.startFn = function() {
      return fnStr
    }
  }
  else if (startType === 'function') {
    this.startFn = function(wordList) {
      return fnStr(wordList)
    }
  }
  else {
    throw new Error('Must pass a function, or string into start()')
  }
  return this
}

MarkovChain.prototype.end = function(fnStrOrNum) {
  var endType = isType(fnStrOrNum)
  var self = this;

  if (endType === 'function') {
    this.endFn = function() { return fnStrOrNum(this.sentence) }
  }
  else if (endType === 'string') {
    this.endFn = function() {
      return self.sentence.split(' ').slice(-1)[0] === fnStrOrNum
    }
  }
  else if (endType === 'number' || fnStrOrNum === undefined) {
    fnStrOrNum = fnStrOrNum || Infinity
    this.endFn = function() { return self.sentence.split(' ').length > fnStrOrNum }
  }
  else {
    throw new Error('Must pass a function, string or number into end()')
  }
  return this
}

MarkovChain.prototype.normalize = function(word) {
  return word.replace(/\.$/ig, '')
}

module.exports.MarkovChain = MarkovChain

}).call(this,require('_process'))
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9tYXJrb3ZjaGFpbi9vbGRlci9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGFzeW5jID0gcmVxdWlyZSgnYXN5bmMnKVxuICAsIGZzID0gcmVxdWlyZSgnZnMnKVxuICAsIHBhdGggPSByZXF1aXJlKCdwYXRoJylcbiAgLCBwaWNrT25lQnlXZWlnaHQgPSByZXF1aXJlKCdwaWNrLW9uZS1ieS13ZWlnaHQnKVxuICAsIGlzVHlwZVxuICAsIGtpbmRhRmlsZVxuICAsIE1hcmtvdkNoYWluXG5cbmlzVHlwZSA9IGZ1bmN0aW9uKHQpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh0KS5zbGljZSg4LCAtMSkudG9Mb3dlckNhc2UoKVxufVxuXG5raW5kYUZpbGUgPSBmdW5jdGlvbihmaWxlKSB7XG4gIHJldHVybiBmaWxlLmluZGV4T2YoJy4nICsgcGF0aC5zZXApID09PSAwIHx8IGZpbGUuaW5kZXhPZihwYXRoLnNlcCkgPT09IDBcbn1cblxuTWFya292Q2hhaW4gPSBmdW5jdGlvbihhcmdzKSB7XG4gIGlmICghYXJncykgeyBhcmdzID0ge30gfVxuICB0aGlzLndvcmRCYW5rID0ge31cbiAgdGhpcy5zZW50ZW5jZSA9ICcnXG4gIHRoaXMuZmlsZXMgPSBbXVxuICBpZiAoYXJncy5maWxlcykge1xuICAgIHJldHVybiB0aGlzLnVzZShhcmdzLmZpbGVzKVxuICB9XG5cbiAgdGhpcy5zdGFydEZuID0gZnVuY3Rpb24od29yZExpc3QpIHtcbiAgICB2YXIgayA9IE9iamVjdC5rZXlzKHdvcmRMaXN0KVxuICAgIHZhciBsID0gay5sZW5ndGhcblxuICAgIHJldHVybiBrW35+KE1hdGgucmFuZG9tKCkqbCldXG4gIH1cblxuICB0aGlzLmVuZEZuID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc2VudGVuY2Uuc3BsaXQoJyAnKS5sZW5ndGggPiA3XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5NYXJrb3ZDaGFpbi5wcm90b3R5cGUuVkVSU0lPTiA9IHJlcXVpcmUoJy4uL3BhY2thZ2UnKS52ZXJzaW9uXG5cbk1hcmtvdkNoYWluLnByb3RvdHlwZS51c2UgPSBmdW5jdGlvbihmaWxlcykge1xuICBpZiAoaXNUeXBlKGZpbGVzKSA9PT0gJ2FycmF5Jykge1xuICAgIHRoaXMuZmlsZXMgPSBmaWxlc1xuICB9XG4gIGVsc2UgaWYgKGlzVHlwZShmaWxlcykgPT09ICdzdHJpbmcnKSB7XG4gICAgdGhpcy5maWxlcyA9IFtmaWxlc11cbiAgfVxuICBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05lZWQgdG8gcGFzcyBhIHN0cmluZyBvciBhcnJheSBmb3IgdXNlKCknKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbk1hcmtvdkNoYWluLnByb3RvdHlwZS5yZWFkRmlsZSA9IGZ1bmN0aW9uKGZpbGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgZnMucmVhZEZpbGUoZmlsZSwgJ3V0ZjgnLCBmdW5jdGlvbihlcnIsIGRhdGEpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgLy8gaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3QsXG4gICAgICAgIC8vIGlmIGBmaWxlYCBzdGFydHMgd2l0aCAuLyBvciAvLCBhc3N1bWluZyB0cnlpbmcgdG8gYmUgYSBmaWxlXG4gICAgICAgIC8vIGlmIGBmaWxlYCBoYXMgYSAnLicsIGFuZCB0aGUgc3RyaW5nIGFmdGVyIHRoYXQgaGFzIG5vIHNwYWNlLCBhc3N1bWUgZmlsZVxuICAgICAgICBpZiAoZXJyLmNvZGUgPT09ICdFTk9FTlQnICYmICFraW5kYUZpbGUoZmlsZSkpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgZmlsZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycilcbiAgICAgIH1cbiAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7IGNhbGxiYWNrKG51bGwsIGRhdGEpIH0pXG4gICAgfSlcbiAgfVxufVxuXG5NYXJrb3ZDaGFpbi5wcm90b3R5cGUuY291bnRUb3RhbCA9IGZ1bmN0aW9uKHdvcmQpIHtcbiAgdmFyIHRvdGFsID0gMFxuICAgICwgcHJvcFxuXG4gIGZvciAocHJvcCBpbiB0aGlzLndvcmRCYW5rW3dvcmRdKSB7XG4gICAgaWYgKHRoaXMud29yZEJhbmtbd29yZF0uaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIHRvdGFsICs9IHRoaXMud29yZEJhbmtbd29yZF1bcHJvcF1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRvdGFsXG59XG5cbk1hcmtvdkNoYWluLnByb3RvdHlwZS5wcm9jZXNzID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdmFyIHJlYWRGaWxlcyA9IFtdXG5cbiAgdGhpcy5maWxlcy5mb3JFYWNoKGZ1bmN0aW9uKGZpbGUpIHtcbiAgICByZWFkRmlsZXMucHVzaCh0aGlzLnJlYWRGaWxlKGZpbGUpKVxuICB9LmJpbmQodGhpcykpXG5cbiAgYXN5bmMucGFyYWxsZWwocmVhZEZpbGVzLCBmdW5jdGlvbihlcnIsIHJldEZpbGVzKSB7XG4gICAgdmFyIHdvcmRzXG4gICAgICAsIGN1cldvcmRcbiAgICB0aGlzLnBhcnNlRmlsZShyZXRGaWxlcy50b1N0cmluZygpKVxuXG4gICAgY3VyV29yZCA9IHRoaXMuc3RhcnRGbih0aGlzLndvcmRCYW5rKVxuXG4gICAgdGhpcy5zZW50ZW5jZSA9IGN1cldvcmRcblxuICAgIHdoaWxlICh0aGlzLndvcmRCYW5rW2N1cldvcmRdICYmICF0aGlzLmVuZEZuKCkpIHtcbiAgICAgIGN1cldvcmQgPSBwaWNrT25lQnlXZWlnaHQodGhpcy53b3JkQmFua1tjdXJXb3JkXSlcbiAgICAgIHRoaXMuc2VudGVuY2UgKz0gJyAnICsgY3VyV29yZFxuICAgIH1cbiAgICBjYWxsYmFjayhudWxsLCB0aGlzLnNlbnRlbmNlLnRyaW0oKSlcblxuICB9LmJpbmQodGhpcykpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuTWFya292Q2hhaW4ucHJvdG90eXBlLnBhcnNlRmlsZSA9IGZ1bmN0aW9uKGZpbGUpIHtcbiAgLy8gc3BsaXRzIHNlbnRlbmNlcyBiYXNlZCBvbiBlaXRoZXIgYW4gZW5kIGxpbmVcbiAgLy8gb3IgYSBwZXJpb2QgKGZvbGxvd2VkIGJ5IGEgc3BhY2UpXG4gIGZpbGUuc3BsaXQoLyg/OlxcLiB8XFxuKS9pZykuZm9yRWFjaChmdW5jdGlvbihsaW5lcykge1xuICAgIHZhciBjdXJXb3JkXG4gICAgICAsIGlcbiAgICAgICwgbmV4dFdvcmRcbiAgICAgICwgd29yZHNcblxuICAgIHdvcmRzID0gbGluZXMuc3BsaXQoJyAnKS5maWx0ZXIoZnVuY3Rpb24odykgeyByZXR1cm4gKHcudHJpbSgpICE9PSAnJykgfSlcbiAgICBmb3IgKGkgPSAwOyBpIDwgd29yZHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICBjdXJXb3JkID0gdGhpcy5ub3JtYWxpemUod29yZHNbaV0pXG4gICAgICBuZXh0V29yZCA9IHRoaXMubm9ybWFsaXplKHdvcmRzW2kgKyAxXSlcbiAgICAgIGlmICghdGhpcy53b3JkQmFua1tjdXJXb3JkXSkge1xuICAgICAgICB0aGlzLndvcmRCYW5rW2N1cldvcmRdID0ge31cbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy53b3JkQmFua1tjdXJXb3JkXVtuZXh0V29yZF0pIHtcbiAgICAgICAgdGhpcy53b3JkQmFua1tjdXJXb3JkXVtuZXh0V29yZF0gPSAxXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy53b3JkQmFua1tjdXJXb3JkXVtuZXh0V29yZF0gKz0gMVxuICAgICAgfVxuICAgIH1cbiAgfS5iaW5kKHRoaXMpKVxufVxuXG5NYXJrb3ZDaGFpbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbihmblN0cikge1xuICB2YXIgc3RhcnRUeXBlID0gaXNUeXBlKGZuU3RyKVxuICBpZiAoc3RhcnRUeXBlID09PSAnc3RyaW5nJykge1xuICAgIHRoaXMuc3RhcnRGbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGZuU3RyXG4gICAgfVxuICB9XG4gIGVsc2UgaWYgKHN0YXJ0VHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRoaXMuc3RhcnRGbiA9IGZ1bmN0aW9uKHdvcmRMaXN0KSB7XG4gICAgICByZXR1cm4gZm5TdHIod29yZExpc3QpXG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcignTXVzdCBwYXNzIGEgZnVuY3Rpb24sIG9yIHN0cmluZyBpbnRvIHN0YXJ0KCknKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbk1hcmtvdkNoYWluLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbihmblN0ck9yTnVtKSB7XG4gIHZhciBlbmRUeXBlID0gaXNUeXBlKGZuU3RyT3JOdW0pXG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoZW5kVHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRoaXMuZW5kRm4gPSBmdW5jdGlvbigpIHsgcmV0dXJuIGZuU3RyT3JOdW0odGhpcy5zZW50ZW5jZSkgfVxuICB9XG4gIGVsc2UgaWYgKGVuZFR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgdGhpcy5lbmRGbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHNlbGYuc2VudGVuY2Uuc3BsaXQoJyAnKS5zbGljZSgtMSlbMF0gPT09IGZuU3RyT3JOdW1cbiAgICB9XG4gIH1cbiAgZWxzZSBpZiAoZW5kVHlwZSA9PT0gJ251bWJlcicgfHwgZm5TdHJPck51bSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZm5TdHJPck51bSA9IGZuU3RyT3JOdW0gfHwgSW5maW5pdHlcbiAgICB0aGlzLmVuZEZuID0gZnVuY3Rpb24oKSB7IHJldHVybiBzZWxmLnNlbnRlbmNlLnNwbGl0KCcgJykubGVuZ3RoID4gZm5TdHJPck51bSB9XG4gIH1cbiAgZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNdXN0IHBhc3MgYSBmdW5jdGlvbiwgc3RyaW5nIG9yIG51bWJlciBpbnRvIGVuZCgpJylcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5NYXJrb3ZDaGFpbi5wcm90b3R5cGUubm9ybWFsaXplID0gZnVuY3Rpb24od29yZCkge1xuICByZXR1cm4gd29yZC5yZXBsYWNlKC9cXC4kL2lnLCAnJylcbn1cblxubW9kdWxlLmV4cG9ydHMuTWFya292Q2hhaW4gPSBNYXJrb3ZDaGFpblxuIl19
},{"../package":7,"_process":10,"async":3,"fs":4,"path":8,"pick-one-by-weight":9}],7:[function(require,module,exports){
module.exports={
  "_args": [
    [
      {
        "raw": "markovchain",
        "scope": null,
        "escapedName": "markovchain",
        "name": "markovchain",
        "rawSpec": "",
        "spec": "latest",
        "type": "tag"
      },
      "/Users/joe/OneDrive/Projects/mini-code-adventures/002-generate-data-with-markov-chains"
    ]
  ],
  "_from": "markovchain@latest",
  "_id": "markovchain@1.0.2",
  "_inCache": true,
  "_installable": true,
  "_location": "/markovchain",
  "_nodeVersion": "4.0.0",
  "_npmUser": {
    "name": "swang",
    "email": "shuanwang@gmail.com"
  },
  "_npmVersion": "3.5.2",
  "_phantomChildren": {},
  "_requested": {
    "raw": "markovchain",
    "scope": null,
    "escapedName": "markovchain",
    "name": "markovchain",
    "rawSpec": "",
    "spec": "latest",
    "type": "tag"
  },
  "_requiredBy": [
    "#USER",
    "/"
  ],
  "_resolved": "https://registry.npmjs.org/markovchain/-/markovchain-1.0.2.tgz",
  "_shasum": "58b38643fb6093cd5b62455b7b1e7bbfe56d7e53",
  "_shrinkwrap": null,
  "_spec": "markovchain",
  "_where": "/Users/joe/OneDrive/Projects/mini-code-adventures/002-generate-data-with-markov-chains",
  "author": {
    "name": "Shuan Wang"
  },
  "bugs": {
    "url": "https://github.com/swang/markovchain/issues"
  },
  "dependencies": {
    "pick-one-by-weight": "~1.0.0"
  },
  "description": "generates a markov chain of words based on input files",
  "devDependencies": {
    "babel": "~5.8.23",
    "chai": "~3.4.1",
    "mocha": "~2.3.4"
  },
  "directories": {
    "test": "test"
  },
  "dist": {
    "shasum": "58b38643fb6093cd5b62455b7b1e7bbfe56d7e53",
    "tarball": "https://registry.npmjs.org/markovchain/-/markovchain-1.0.2.tgz"
  },
  "engines": {
    "node": ">=0.8"
  },
  "gitHead": "fee2d2011b382e87286434e638dc0f17e8ab7547",
  "homepage": "https://github.com/swang/markovchain#readme",
  "keywords": [
    "markov chain",
    "markov"
  ],
  "license": "ISC",
  "main": "lib/index.js",
  "maintainers": [
    {
      "name": "swang",
      "email": "shuanwang@gmail.com"
    }
  ],
  "name": "markovchain",
  "optionalDependencies": {},
  "readme": "ERROR: No README data found!",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/swang/markovchain.git"
  },
  "scripts": {
    "babel-watch": "babel src --watch --out-dir lib",
    "compile": "babel src --out-dir lib",
    "postpublish": "rm -rf ./lib/*.js",
    "prepublish": "npm run compile && npm test",
    "preversion": "npm test",
    "test": "mocha test/test*.js"
  },
  "version": "1.0.2"
}

},{}],8:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9wYXRoLWJyb3dzZXJpZnkvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIHJlc29sdmVzIC4gYW5kIC4uIGVsZW1lbnRzIGluIGEgcGF0aCBhcnJheSB3aXRoIGRpcmVjdG9yeSBuYW1lcyB0aGVyZVxuLy8gbXVzdCBiZSBubyBzbGFzaGVzLCBlbXB0eSBlbGVtZW50cywgb3IgZGV2aWNlIG5hbWVzIChjOlxcKSBpbiB0aGUgYXJyYXlcbi8vIChzbyBhbHNvIG5vIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHNsYXNoZXMgLSBpdCBkb2VzIG5vdCBkaXN0aW5ndWlzaFxuLy8gcmVsYXRpdmUgYW5kIGFic29sdXRlIHBhdGhzKVxuZnVuY3Rpb24gbm9ybWFsaXplQXJyYXkocGFydHMsIGFsbG93QWJvdmVSb290KSB7XG4gIC8vIGlmIHRoZSBwYXRoIHRyaWVzIHRvIGdvIGFib3ZlIHRoZSByb290LCBgdXBgIGVuZHMgdXAgPiAwXG4gIHZhciB1cCA9IDA7XG4gIGZvciAodmFyIGkgPSBwYXJ0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIHZhciBsYXN0ID0gcGFydHNbaV07XG4gICAgaWYgKGxhc3QgPT09ICcuJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgIH0gZWxzZSBpZiAobGFzdCA9PT0gJy4uJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgdXArKztcbiAgICB9IGVsc2UgaWYgKHVwKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBwYXRoIGlzIGFsbG93ZWQgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIHJlc3RvcmUgbGVhZGluZyAuLnNcbiAgaWYgKGFsbG93QWJvdmVSb290KSB7XG4gICAgZm9yICg7IHVwLS07IHVwKSB7XG4gICAgICBwYXJ0cy51bnNoaWZ0KCcuLicpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXJ0cztcbn1cblxuLy8gU3BsaXQgYSBmaWxlbmFtZSBpbnRvIFtyb290LCBkaXIsIGJhc2VuYW1lLCBleHRdLCB1bml4IHZlcnNpb25cbi8vICdyb290JyBpcyBqdXN0IGEgc2xhc2gsIG9yIG5vdGhpbmcuXG52YXIgc3BsaXRQYXRoUmUgPVxuICAgIC9eKFxcLz98KShbXFxzXFxTXSo/KSgoPzpcXC57MSwyfXxbXlxcL10rP3wpKFxcLlteLlxcL10qfCkpKD86W1xcL10qKSQvO1xudmFyIHNwbGl0UGF0aCA9IGZ1bmN0aW9uKGZpbGVuYW1lKSB7XG4gIHJldHVybiBzcGxpdFBhdGhSZS5leGVjKGZpbGVuYW1lKS5zbGljZSgxKTtcbn07XG5cbi8vIHBhdGgucmVzb2x2ZShbZnJvbSAuLi5dLCB0bylcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMucmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcmVzb2x2ZWRQYXRoID0gJycsXG4gICAgICByZXNvbHZlZEFic29sdXRlID0gZmFsc2U7XG5cbiAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGggLSAxOyBpID49IC0xICYmICFyZXNvbHZlZEFic29sdXRlOyBpLS0pIHtcbiAgICB2YXIgcGF0aCA9IChpID49IDApID8gYXJndW1lbnRzW2ldIDogcHJvY2Vzcy5jd2QoKTtcblxuICAgIC8vIFNraXAgZW1wdHkgYW5kIGludmFsaWQgZW50cmllc1xuICAgIGlmICh0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyB0byBwYXRoLnJlc29sdmUgbXVzdCBiZSBzdHJpbmdzJyk7XG4gICAgfSBlbHNlIGlmICghcGF0aCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcmVzb2x2ZWRQYXRoID0gcGF0aCArICcvJyArIHJlc29sdmVkUGF0aDtcbiAgICByZXNvbHZlZEFic29sdXRlID0gcGF0aC5jaGFyQXQoMCkgPT09ICcvJztcbiAgfVxuXG4gIC8vIEF0IHRoaXMgcG9pbnQgdGhlIHBhdGggc2hvdWxkIGJlIHJlc29sdmVkIHRvIGEgZnVsbCBhYnNvbHV0ZSBwYXRoLCBidXRcbiAgLy8gaGFuZGxlIHJlbGF0aXZlIHBhdGhzIHRvIGJlIHNhZmUgKG1pZ2h0IGhhcHBlbiB3aGVuIHByb2Nlc3MuY3dkKCkgZmFpbHMpXG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHJlc29sdmVkUGF0aCA9IG5vcm1hbGl6ZUFycmF5KGZpbHRlcihyZXNvbHZlZFBhdGguc3BsaXQoJy8nKSwgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiAhIXA7XG4gIH0pLCAhcmVzb2x2ZWRBYnNvbHV0ZSkuam9pbignLycpO1xuXG4gIHJldHVybiAoKHJlc29sdmVkQWJzb2x1dGUgPyAnLycgOiAnJykgKyByZXNvbHZlZFBhdGgpIHx8ICcuJztcbn07XG5cbi8vIHBhdGgubm9ybWFsaXplKHBhdGgpXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgdmFyIGlzQWJzb2x1dGUgPSBleHBvcnRzLmlzQWJzb2x1dGUocGF0aCksXG4gICAgICB0cmFpbGluZ1NsYXNoID0gc3Vic3RyKHBhdGgsIC0xKSA9PT0gJy8nO1xuXG4gIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICBwYXRoID0gbm9ybWFsaXplQXJyYXkoZmlsdGVyKHBhdGguc3BsaXQoJy8nKSwgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiAhIXA7XG4gIH0pLCAhaXNBYnNvbHV0ZSkuam9pbignLycpO1xuXG4gIGlmICghcGF0aCAmJiAhaXNBYnNvbHV0ZSkge1xuICAgIHBhdGggPSAnLic7XG4gIH1cbiAgaWYgKHBhdGggJiYgdHJhaWxpbmdTbGFzaCkge1xuICAgIHBhdGggKz0gJy8nO1xuICB9XG5cbiAgcmV0dXJuIChpc0Fic29sdXRlID8gJy8nIDogJycpICsgcGF0aDtcbn07XG5cbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMuaXNBYnNvbHV0ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgcmV0dXJuIHBhdGguY2hhckF0KDApID09PSAnLyc7XG59O1xuXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLmpvaW4gPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBhdGhzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKTtcbiAgcmV0dXJuIGV4cG9ydHMubm9ybWFsaXplKGZpbHRlcihwYXRocywgZnVuY3Rpb24ocCwgaW5kZXgpIHtcbiAgICBpZiAodHlwZW9mIHAgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgdG8gcGF0aC5qb2luIG11c3QgYmUgc3RyaW5ncycpO1xuICAgIH1cbiAgICByZXR1cm4gcDtcbiAgfSkuam9pbignLycpKTtcbn07XG5cblxuLy8gcGF0aC5yZWxhdGl2ZShmcm9tLCB0bylcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMucmVsYXRpdmUgPSBmdW5jdGlvbihmcm9tLCB0bykge1xuICBmcm9tID0gZXhwb3J0cy5yZXNvbHZlKGZyb20pLnN1YnN0cigxKTtcbiAgdG8gPSBleHBvcnRzLnJlc29sdmUodG8pLnN1YnN0cigxKTtcblxuICBmdW5jdGlvbiB0cmltKGFycikge1xuICAgIHZhciBzdGFydCA9IDA7XG4gICAgZm9yICg7IHN0YXJ0IDwgYXJyLmxlbmd0aDsgc3RhcnQrKykge1xuICAgICAgaWYgKGFycltzdGFydF0gIT09ICcnKSBicmVhaztcbiAgICB9XG5cbiAgICB2YXIgZW5kID0gYXJyLmxlbmd0aCAtIDE7XG4gICAgZm9yICg7IGVuZCA+PSAwOyBlbmQtLSkge1xuICAgICAgaWYgKGFycltlbmRdICE9PSAnJykgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKHN0YXJ0ID4gZW5kKSByZXR1cm4gW107XG4gICAgcmV0dXJuIGFyci5zbGljZShzdGFydCwgZW5kIC0gc3RhcnQgKyAxKTtcbiAgfVxuXG4gIHZhciBmcm9tUGFydHMgPSB0cmltKGZyb20uc3BsaXQoJy8nKSk7XG4gIHZhciB0b1BhcnRzID0gdHJpbSh0by5zcGxpdCgnLycpKTtcblxuICB2YXIgbGVuZ3RoID0gTWF0aC5taW4oZnJvbVBhcnRzLmxlbmd0aCwgdG9QYXJ0cy5sZW5ndGgpO1xuICB2YXIgc2FtZVBhcnRzTGVuZ3RoID0gbGVuZ3RoO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGZyb21QYXJ0c1tpXSAhPT0gdG9QYXJ0c1tpXSkge1xuICAgICAgc2FtZVBhcnRzTGVuZ3RoID0gaTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHZhciBvdXRwdXRQYXJ0cyA9IFtdO1xuICBmb3IgKHZhciBpID0gc2FtZVBhcnRzTGVuZ3RoOyBpIDwgZnJvbVBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgb3V0cHV0UGFydHMucHVzaCgnLi4nKTtcbiAgfVxuXG4gIG91dHB1dFBhcnRzID0gb3V0cHV0UGFydHMuY29uY2F0KHRvUGFydHMuc2xpY2Uoc2FtZVBhcnRzTGVuZ3RoKSk7XG5cbiAgcmV0dXJuIG91dHB1dFBhcnRzLmpvaW4oJy8nKTtcbn07XG5cbmV4cG9ydHMuc2VwID0gJy8nO1xuZXhwb3J0cy5kZWxpbWl0ZXIgPSAnOic7XG5cbmV4cG9ydHMuZGlybmFtZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgdmFyIHJlc3VsdCA9IHNwbGl0UGF0aChwYXRoKSxcbiAgICAgIHJvb3QgPSByZXN1bHRbMF0sXG4gICAgICBkaXIgPSByZXN1bHRbMV07XG5cbiAgaWYgKCFyb290ICYmICFkaXIpIHtcbiAgICAvLyBObyBkaXJuYW1lIHdoYXRzb2V2ZXJcbiAgICByZXR1cm4gJy4nO1xuICB9XG5cbiAgaWYgKGRpcikge1xuICAgIC8vIEl0IGhhcyBhIGRpcm5hbWUsIHN0cmlwIHRyYWlsaW5nIHNsYXNoXG4gICAgZGlyID0gZGlyLnN1YnN0cigwLCBkaXIubGVuZ3RoIC0gMSk7XG4gIH1cblxuICByZXR1cm4gcm9vdCArIGRpcjtcbn07XG5cblxuZXhwb3J0cy5iYXNlbmFtZSA9IGZ1bmN0aW9uKHBhdGgsIGV4dCkge1xuICB2YXIgZiA9IHNwbGl0UGF0aChwYXRoKVsyXTtcbiAgLy8gVE9ETzogbWFrZSB0aGlzIGNvbXBhcmlzb24gY2FzZS1pbnNlbnNpdGl2ZSBvbiB3aW5kb3dzP1xuICBpZiAoZXh0ICYmIGYuc3Vic3RyKC0xICogZXh0Lmxlbmd0aCkgPT09IGV4dCkge1xuICAgIGYgPSBmLnN1YnN0cigwLCBmLmxlbmd0aCAtIGV4dC5sZW5ndGgpO1xuICB9XG4gIHJldHVybiBmO1xufTtcblxuXG5leHBvcnRzLmV4dG5hbWUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHJldHVybiBzcGxpdFBhdGgocGF0aClbM107XG59O1xuXG5mdW5jdGlvbiBmaWx0ZXIgKHhzLCBmKSB7XG4gICAgaWYgKHhzLmZpbHRlcikgcmV0dXJuIHhzLmZpbHRlcihmKTtcbiAgICB2YXIgcmVzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoZih4c1tpXSwgaSwgeHMpKSByZXMucHVzaCh4c1tpXSk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59XG5cbi8vIFN0cmluZy5wcm90b3R5cGUuc3Vic3RyIC0gbmVnYXRpdmUgaW5kZXggZG9uJ3Qgd29yayBpbiBJRThcbnZhciBzdWJzdHIgPSAnYWInLnN1YnN0cigtMSkgPT09ICdiJ1xuICAgID8gZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbikgeyByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKSB9XG4gICAgOiBmdW5jdGlvbiAoc3RyLCBzdGFydCwgbGVuKSB7XG4gICAgICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gc3RyLmxlbmd0aCArIHN0YXJ0O1xuICAgICAgICByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKTtcbiAgICB9XG47XG4iXX0=
},{"_process":10}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = pickOneByWeight;

function pickOneByWeight(anObj) {
  var _keys = Object.keys(anObj);
  var sum = _keys.reduce(function (p, c) {
    return p + anObj[c];
  }, 0);
  if (!Number.isFinite(sum)) {
    throw new Error("All values in object must be a numeric value");
  }
  var choose = ~ ~(Math.random() * sum);
  for (var i = 0, count = 0; i < _keys.length; i++) {
    count += anObj[_keys[i]];
    if (count > choose) {
      return _keys[i];
    }
  }
}

module.exports = exports["default"];
},{}],10:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuL2FwcC9zY3JpcHRzL21haW4uanMiLCIvVXNlcnMvam9lL09uZURyaXZlL1Byb2plY3RzL21pbmktY29kZS1hZHZlbnR1cmVzLzAwMi1nZW5lcmF0ZS1kYXRhLXdpdGgtbWFya292LWNoYWlucy9hcHAvc2NyaXB0cy9hcHAuanMiLCIvVXNlcnMvam9lL09uZURyaXZlL1Byb2plY3RzL21pbmktY29kZS1hZHZlbnR1cmVzLzAwMi1nZW5lcmF0ZS1kYXRhLXdpdGgtbWFya292LWNoYWlucy9ub2RlX21vZHVsZXMvYXN5bmMvbGliL2FzeW5jLmpzIiwiL1VzZXJzL2pvZS9PbmVEcml2ZS9Qcm9qZWN0cy9taW5pLWNvZGUtYWR2ZW50dXJlcy8wMDItZ2VuZXJhdGUtZGF0YS13aXRoLW1hcmtvdi1jaGFpbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbGliL19lbXB0eS5qcyIsIi9Vc2Vycy9qb2UvT25lRHJpdmUvUHJvamVjdHMvbWluaS1jb2RlLWFkdmVudHVyZXMvMDAyLWdlbmVyYXRlLWRhdGEtd2l0aC1tYXJrb3YtY2hhaW5zL25vZGVfbW9kdWxlcy9tYXJrb3ZjaGFpbi9saWIvaW5kZXguanMiLCIvVXNlcnMvam9lL09uZURyaXZlL1Byb2plY3RzL21pbmktY29kZS1hZHZlbnR1cmVzLzAwMi1nZW5lcmF0ZS1kYXRhLXdpdGgtbWFya292LWNoYWlucy9ub2RlX21vZHVsZXMvbWFya292Y2hhaW4vb2xkZXIvaW5kZXguanMiLCIvVXNlcnMvam9lL09uZURyaXZlL1Byb2plY3RzL21pbmktY29kZS1hZHZlbnR1cmVzLzAwMi1nZW5lcmF0ZS1kYXRhLXdpdGgtbWFya292LWNoYWlucy9ub2RlX21vZHVsZXMvbWFya292Y2hhaW4vcGFja2FnZS5qc29uIiwiL1VzZXJzL2pvZS9PbmVEcml2ZS9Qcm9qZWN0cy9taW5pLWNvZGUtYWR2ZW50dXJlcy8wMDItZ2VuZXJhdGUtZGF0YS13aXRoLW1hcmtvdi1jaGFpbnMvbm9kZV9tb2R1bGVzL3BhdGgtYnJvd3NlcmlmeS9pbmRleC5qcyIsIi9Vc2Vycy9qb2UvT25lRHJpdmUvUHJvamVjdHMvbWluaS1jb2RlLWFkdmVudHVyZXMvMDAyLWdlbmVyYXRlLWRhdGEtd2l0aC1tYXJrb3YtY2hhaW5zL25vZGVfbW9kdWxlcy9waWNrLW9uZS1ieS13ZWlnaHQvbGliL2luZGV4LmpzIiwiL1VzZXJzL2pvZS9PbmVEcml2ZS9Qcm9qZWN0cy9taW5pLWNvZGUtYWR2ZW50dXJlcy8wMDItZ2VuZXJhdGUtZGF0YS13aXRoLW1hcmtvdi1jaGFpbnMvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2o4QkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25PQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBzY3JpcHRzL21haW4uanNcbiAqXG4gKiBUaGlzIGlzIHRoZSBzdGFydGluZyBwb2ludCBmb3IgeW91ciBhcHBsaWNhdGlvbi5cbiAqIFRha2UgYSBsb29rIGF0IGh0dHA6Ly9icm93c2VyaWZ5Lm9yZy8gZm9yIG1vcmUgaW5mb1xuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIEFwcCA9IHJlcXVpcmUoJy4vYXBwLmpzJyk7XG5cbnZhciBhcHAgPSBuZXcgQXBwKCk7XG5cbmFwcC5iZWVwKCk7XG5cbnZhciBNYXJrb3ZDaGFpbiA9IHJlcXVpcmUoJ21hcmtvdmNoYWluJyk7XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZW5lcmF0ZScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgdmFyIGlucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lucHV0Jyk7XG4gICAgdmFyIG0gPSBuZXcgTWFya292Q2hhaW4oaW5wdXQudmFsdWUpO1xuICAgIHZhciBvdXRwdXQgPSBtLnByb2Nlc3MoKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3V0cHV0JykudmFsdWUgPSBvdXRwdXQ7XG59KTsiLCIvKipcbiAqIHNjcmlwdHMvYXBwLmpzXG4gKlxuICogVGhpcyBpcyBhIHNhbXBsZSBDb21tb25KUyBtb2R1bGUuXG4gKiBUYWtlIGEgbG9vayBhdCBodHRwOi8vYnJvd3NlcmlmeS5vcmcvIGZvciBtb3JlIGluZm9cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIEFwcCgpIHtcbiAgY29uc29sZS5sb2coJ2FwcCBpbml0aWFsaXplZCcpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFwcDtcblxuQXBwLnByb3RvdHlwZS5iZWVwID0gZnVuY3Rpb24gKCkge1xuICBjb25zb2xlLmxvZygnYm9vcCcpO1xufTtcbiIsIihmdW5jdGlvbiAocHJvY2Vzcyl7XG4vKmdsb2JhbCBzZXRJbW1lZGlhdGU6IGZhbHNlLCBzZXRUaW1lb3V0OiBmYWxzZSwgY29uc29sZTogZmFsc2UgKi9cbihmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgYXN5bmMgPSB7fTtcblxuICAgIC8vIGdsb2JhbCBvbiB0aGUgc2VydmVyLCB3aW5kb3cgaW4gdGhlIGJyb3dzZXJcbiAgICB2YXIgcm9vdCwgcHJldmlvdXNfYXN5bmM7XG5cbiAgICByb290ID0gdGhpcztcbiAgICBpZiAocm9vdCAhPSBudWxsKSB7XG4gICAgICBwcmV2aW91c19hc3luYyA9IHJvb3QuYXN5bmM7XG4gICAgfVxuXG4gICAgYXN5bmMubm9Db25mbGljdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcm9vdC5hc3luYyA9IHByZXZpb3VzX2FzeW5jO1xuICAgICAgICByZXR1cm4gYXN5bmM7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIG9ubHlfb25jZShmbikge1xuICAgICAgICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChjYWxsZWQpIHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIHdhcyBhbHJlYWR5IGNhbGxlZC5cIik7XG4gICAgICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgZm4uYXBwbHkocm9vdCwgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vLy8gY3Jvc3MtYnJvd3NlciBjb21wYXRpYmxpdHkgZnVuY3Rpb25zIC8vLy9cblxuICAgIHZhciBfZWFjaCA9IGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yKSB7XG4gICAgICAgIGlmIChhcnIuZm9yRWFjaCkge1xuICAgICAgICAgICAgcmV0dXJuIGFyci5mb3JFYWNoKGl0ZXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgaXRlcmF0b3IoYXJyW2ldLCBpLCBhcnIpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHZhciBfbWFwID0gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IpIHtcbiAgICAgICAgaWYgKGFyci5tYXApIHtcbiAgICAgICAgICAgIHJldHVybiBhcnIubWFwKGl0ZXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBfZWFjaChhcnIsIGZ1bmN0aW9uICh4LCBpLCBhKSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IoeCwgaSwgYSkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfTtcblxuICAgIHZhciBfcmVkdWNlID0gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IsIG1lbW8pIHtcbiAgICAgICAgaWYgKGFyci5yZWR1Y2UpIHtcbiAgICAgICAgICAgIHJldHVybiBhcnIucmVkdWNlKGl0ZXJhdG9yLCBtZW1vKTtcbiAgICAgICAgfVxuICAgICAgICBfZWFjaChhcnIsIGZ1bmN0aW9uICh4LCBpLCBhKSB7XG4gICAgICAgICAgICBtZW1vID0gaXRlcmF0b3IobWVtbywgeCwgaSwgYSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9O1xuXG4gICAgdmFyIF9rZXlzID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICB9XG4gICAgICAgIHZhciBrZXlzID0gW107XG4gICAgICAgIGZvciAodmFyIGsgaW4gb2JqKSB7XG4gICAgICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICAgICAga2V5cy5wdXNoKGspO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBrZXlzO1xuICAgIH07XG5cbiAgICAvLy8vIGV4cG9ydGVkIGFzeW5jIG1vZHVsZSBmdW5jdGlvbnMgLy8vL1xuXG4gICAgLy8vLyBuZXh0VGljayBpbXBsZW1lbnRhdGlvbiB3aXRoIGJyb3dzZXItY29tcGF0aWJsZSBmYWxsYmFjayAvLy8vXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzID09PSAndW5kZWZpbmVkJyB8fCAhKHByb2Nlc3MubmV4dFRpY2spKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBhc3luYy5uZXh0VGljayA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgICAgIC8vIG5vdCBhIGRpcmVjdCBhbGlhcyBmb3IgSUUxMCBjb21wYXRpYmlsaXR5XG4gICAgICAgICAgICAgICAgc2V0SW1tZWRpYXRlKGZuKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUgPSBhc3luYy5uZXh0VGljaztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGFzeW5jLm5leHRUaWNrID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXN5bmMuc2V0SW1tZWRpYXRlID0gYXN5bmMubmV4dFRpY2s7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGFzeW5jLm5leHRUaWNrID0gcHJvY2Vzcy5uZXh0VGljaztcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRJbW1lZGlhdGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgICAgLy8gbm90IGEgZGlyZWN0IGFsaWFzIGZvciBJRTEwIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAgICAgc2V0SW1tZWRpYXRlKGZuKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUgPSBhc3luYy5uZXh0VGljaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jLmVhY2ggPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKCFhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY29tcGxldGVkID0gMDtcbiAgICAgICAgX2VhY2goYXJyLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgaXRlcmF0b3IoeCwgb25seV9vbmNlKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZWQgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBhc3luYy5mb3JFYWNoID0gYXN5bmMuZWFjaDtcblxuICAgIGFzeW5jLmVhY2hTZXJpZXMgPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKCFhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY29tcGxldGVkID0gMDtcbiAgICAgICAgdmFyIGl0ZXJhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihhcnJbY29tcGxldGVkXSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXRlcmF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIGl0ZXJhdGUoKTtcbiAgICB9O1xuICAgIGFzeW5jLmZvckVhY2hTZXJpZXMgPSBhc3luYy5lYWNoU2VyaWVzO1xuXG4gICAgYXN5bmMuZWFjaExpbWl0ID0gZnVuY3Rpb24gKGFyciwgbGltaXQsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgZm4gPSBfZWFjaExpbWl0KGxpbWl0KTtcbiAgICAgICAgZm4uYXBwbHkobnVsbCwgW2FyciwgaXRlcmF0b3IsIGNhbGxiYWNrXSk7XG4gICAgfTtcbiAgICBhc3luYy5mb3JFYWNoTGltaXQgPSBhc3luYy5lYWNoTGltaXQ7XG5cbiAgICB2YXIgX2VhY2hMaW1pdCA9IGZ1bmN0aW9uIChsaW1pdCkge1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICBpZiAoIWFyci5sZW5ndGggfHwgbGltaXQgPD0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGNvbXBsZXRlZCA9IDA7XG4gICAgICAgICAgICB2YXIgc3RhcnRlZCA9IDA7XG4gICAgICAgICAgICB2YXIgcnVubmluZyA9IDA7XG5cbiAgICAgICAgICAgIChmdW5jdGlvbiByZXBsZW5pc2ggKCkge1xuICAgICAgICAgICAgICAgIGlmIChjb21wbGV0ZWQgPj0gYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAocnVubmluZyA8IGxpbWl0ICYmIHN0YXJ0ZWQgPCBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0ZWQgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgcnVubmluZyArPSAxO1xuICAgICAgICAgICAgICAgICAgICBpdGVyYXRvcihhcnJbc3RhcnRlZCAtIDFdLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVubmluZyAtPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb21wbGV0ZWQgPj0gYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbGVuaXNoKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSgpO1xuICAgICAgICB9O1xuICAgIH07XG5cblxuICAgIHZhciBkb1BhcmFsbGVsID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgW2FzeW5jLmVhY2hdLmNvbmNhdChhcmdzKSk7XG4gICAgICAgIH07XG4gICAgfTtcbiAgICB2YXIgZG9QYXJhbGxlbExpbWl0ID0gZnVuY3Rpb24obGltaXQsIGZuKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgW19lYWNoTGltaXQobGltaXQpXS5jb25jYXQoYXJncykpO1xuICAgICAgICB9O1xuICAgIH07XG4gICAgdmFyIGRvU2VyaWVzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgW2FzeW5jLmVhY2hTZXJpZXNdLmNvbmNhdChhcmdzKSk7XG4gICAgICAgIH07XG4gICAgfTtcblxuXG4gICAgdmFyIF9hc3luY01hcCA9IGZ1bmN0aW9uIChlYWNoZm4sIGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIGFyciA9IF9tYXAoYXJyLCBmdW5jdGlvbiAoeCwgaSkge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogaSwgdmFsdWU6IHh9O1xuICAgICAgICB9KTtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAoZXJyLCB2KSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0c1t4LmluZGV4XSA9IHY7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIGFzeW5jLm1hcCA9IGRvUGFyYWxsZWwoX2FzeW5jTWFwKTtcbiAgICBhc3luYy5tYXBTZXJpZXMgPSBkb1NlcmllcyhfYXN5bmNNYXApO1xuICAgIGFzeW5jLm1hcExpbWl0ID0gZnVuY3Rpb24gKGFyciwgbGltaXQsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICByZXR1cm4gX21hcExpbWl0KGxpbWl0KShhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIHZhciBfbWFwTGltaXQgPSBmdW5jdGlvbihsaW1pdCkge1xuICAgICAgICByZXR1cm4gZG9QYXJhbGxlbExpbWl0KGxpbWl0LCBfYXN5bmNNYXApO1xuICAgIH07XG5cbiAgICAvLyByZWR1Y2Ugb25seSBoYXMgYSBzZXJpZXMgdmVyc2lvbiwgYXMgZG9pbmcgcmVkdWNlIGluIHBhcmFsbGVsIHdvbid0XG4gICAgLy8gd29yayBpbiBtYW55IHNpdHVhdGlvbnMuXG4gICAgYXN5bmMucmVkdWNlID0gZnVuY3Rpb24gKGFyciwgbWVtbywgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIGFzeW5jLmVhY2hTZXJpZXMoYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKG1lbW8sIHgsIGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICBtZW1vID0gdjtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgbWVtbyk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgLy8gaW5qZWN0IGFsaWFzXG4gICAgYXN5bmMuaW5qZWN0ID0gYXN5bmMucmVkdWNlO1xuICAgIC8vIGZvbGRsIGFsaWFzXG4gICAgYXN5bmMuZm9sZGwgPSBhc3luYy5yZWR1Y2U7XG5cbiAgICBhc3luYy5yZWR1Y2VSaWdodCA9IGZ1bmN0aW9uIChhcnIsIG1lbW8sIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgcmV2ZXJzZWQgPSBfbWFwKGFyciwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4O1xuICAgICAgICB9KS5yZXZlcnNlKCk7XG4gICAgICAgIGFzeW5jLnJlZHVjZShyZXZlcnNlZCwgbWVtbywgaXRlcmF0b3IsIGNhbGxiYWNrKTtcbiAgICB9O1xuICAgIC8vIGZvbGRyIGFsaWFzXG4gICAgYXN5bmMuZm9sZHIgPSBhc3luYy5yZWR1Y2VSaWdodDtcblxuICAgIHZhciBfZmlsdGVyID0gZnVuY3Rpb24gKGVhY2hmbiwgYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgYXJyID0gX21hcChhcnIsIGZ1bmN0aW9uICh4LCBpKSB7XG4gICAgICAgICAgICByZXR1cm4ge2luZGV4OiBpLCB2YWx1ZTogeH07XG4gICAgICAgIH0pO1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKF9tYXAocmVzdWx0cy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEuaW5kZXggLSBiLmluZGV4O1xuICAgICAgICAgICAgfSksIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHgudmFsdWU7XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgYXN5bmMuZmlsdGVyID0gZG9QYXJhbGxlbChfZmlsdGVyKTtcbiAgICBhc3luYy5maWx0ZXJTZXJpZXMgPSBkb1NlcmllcyhfZmlsdGVyKTtcbiAgICAvLyBzZWxlY3QgYWxpYXNcbiAgICBhc3luYy5zZWxlY3QgPSBhc3luYy5maWx0ZXI7XG4gICAgYXN5bmMuc2VsZWN0U2VyaWVzID0gYXN5bmMuZmlsdGVyU2VyaWVzO1xuXG4gICAgdmFyIF9yZWplY3QgPSBmdW5jdGlvbiAoZWFjaGZuLCBhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBhcnIgPSBfbWFwKGFyciwgZnVuY3Rpb24gKHgsIGkpIHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGksIHZhbHVlOiB4fTtcbiAgICAgICAgfSk7XG4gICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaXRlcmF0b3IoeC52YWx1ZSwgZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKF9tYXAocmVzdWx0cy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEuaW5kZXggLSBiLmluZGV4O1xuICAgICAgICAgICAgfSksIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHgudmFsdWU7XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgYXN5bmMucmVqZWN0ID0gZG9QYXJhbGxlbChfcmVqZWN0KTtcbiAgICBhc3luYy5yZWplY3RTZXJpZXMgPSBkb1NlcmllcyhfcmVqZWN0KTtcblxuICAgIHZhciBfZGV0ZWN0ID0gZnVuY3Rpb24gKGVhY2hmbiwgYXJyLCBpdGVyYXRvciwgbWFpbl9jYWxsYmFjaykge1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgsIGZ1bmN0aW9uIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIG1haW5fY2FsbGJhY2soeCk7XG4gICAgICAgICAgICAgICAgICAgIG1haW5fY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIG1haW5fY2FsbGJhY2soKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBhc3luYy5kZXRlY3QgPSBkb1BhcmFsbGVsKF9kZXRlY3QpO1xuICAgIGFzeW5jLmRldGVjdFNlcmllcyA9IGRvU2VyaWVzKF9kZXRlY3QpO1xuXG4gICAgYXN5bmMuc29tZSA9IGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yLCBtYWluX2NhbGxiYWNrKSB7XG4gICAgICAgIGFzeW5jLmVhY2goYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgsIGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgbWFpbl9jYWxsYmFjayh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgbWFpbl9jYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIG1haW5fY2FsbGJhY2soZmFsc2UpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8vIGFueSBhbGlhc1xuICAgIGFzeW5jLmFueSA9IGFzeW5jLnNvbWU7XG5cbiAgICBhc3luYy5ldmVyeSA9IGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yLCBtYWluX2NhbGxiYWNrKSB7XG4gICAgICAgIGFzeW5jLmVhY2goYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgsIGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgaWYgKCF2KSB7XG4gICAgICAgICAgICAgICAgICAgIG1haW5fY2FsbGJhY2soZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICBtYWluX2NhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgbWFpbl9jYWxsYmFjayh0cnVlKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICAvLyBhbGwgYWxpYXNcbiAgICBhc3luYy5hbGwgPSBhc3luYy5ldmVyeTtcblxuICAgIGFzeW5jLnNvcnRCeSA9IGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBhc3luYy5tYXAoYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgsIGZ1bmN0aW9uIChlcnIsIGNyaXRlcmlhKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwge3ZhbHVlOiB4LCBjcml0ZXJpYTogY3JpdGVyaWF9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGZuID0gZnVuY3Rpb24gKGxlZnQsIHJpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhID0gbGVmdC5jcml0ZXJpYSwgYiA9IHJpZ2h0LmNyaXRlcmlhO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYSA8IGIgPyAtMSA6IGEgPiBiID8gMSA6IDA7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBfbWFwKHJlc3VsdHMuc29ydChmbiksIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB4LnZhbHVlO1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIGFzeW5jLmF1dG8gPSBmdW5jdGlvbiAodGFza3MsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgIHZhciBrZXlzID0gX2tleXModGFza3MpO1xuICAgICAgICBpZiAoIWtleXMubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuXG4gICAgICAgIHZhciBsaXN0ZW5lcnMgPSBbXTtcbiAgICAgICAgdmFyIGFkZExpc3RlbmVyID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnMudW5zaGlmdChmbik7XG4gICAgICAgIH07XG4gICAgICAgIHZhciByZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBpZiAobGlzdGVuZXJzW2ldID09PSBmbikge1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB2YXIgdGFza0NvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgX2VhY2gobGlzdGVuZXJzLnNsaWNlKDApLCBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgYWRkTGlzdGVuZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKF9rZXlzKHJlc3VsdHMpLmxlbmd0aCA9PT0ga2V5cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBfZWFjaChrZXlzLCBmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgdmFyIHRhc2sgPSAodGFza3Nba10gaW5zdGFuY2VvZiBGdW5jdGlvbikgPyBbdGFza3Nba11dOiB0YXNrc1trXTtcbiAgICAgICAgICAgIHZhciB0YXNrQ2FsbGJhY2sgPSBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzYWZlUmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBfZWFjaChfa2V5cyhyZXN1bHRzKSwgZnVuY3Rpb24ocmtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2FmZVJlc3VsdHNbcmtleV0gPSByZXN1bHRzW3JrZXldO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc2FmZVJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIHNhZmVSZXN1bHRzKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gc3RvcCBzdWJzZXF1ZW50IGVycm9ycyBoaXR0aW5nIGNhbGxiYWNrIG11bHRpcGxlIHRpbWVzXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzW2tdID0gYXJncztcbiAgICAgICAgICAgICAgICAgICAgYXN5bmMuc2V0SW1tZWRpYXRlKHRhc2tDb21wbGV0ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHZhciByZXF1aXJlcyA9IHRhc2suc2xpY2UoMCwgTWF0aC5hYnModGFzay5sZW5ndGggLSAxKSkgfHwgW107XG4gICAgICAgICAgICB2YXIgcmVhZHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF9yZWR1Y2UocmVxdWlyZXMsIGZ1bmN0aW9uIChhLCB4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAoYSAmJiByZXN1bHRzLmhhc093blByb3BlcnR5KHgpKTtcbiAgICAgICAgICAgICAgICB9LCB0cnVlKSAmJiAhcmVzdWx0cy5oYXNPd25Qcm9wZXJ0eShrKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAocmVhZHkoKSkge1xuICAgICAgICAgICAgICAgIHRhc2tbdGFzay5sZW5ndGggLSAxXSh0YXNrQ2FsbGJhY2ssIHJlc3VsdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVhZHkoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlTGlzdGVuZXIobGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFza1t0YXNrLmxlbmd0aCAtIDFdKHRhc2tDYWxsYmFjaywgcmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGFkZExpc3RlbmVyKGxpc3RlbmVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIGFzeW5jLndhdGVyZmFsbCA9IGZ1bmN0aW9uICh0YXNrcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKHRhc2tzLmNvbnN0cnVjdG9yICE9PSBBcnJheSkge1xuICAgICAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IHRvIHdhdGVyZmFsbCBtdXN0IGJlIGFuIGFycmF5IG9mIGZ1bmN0aW9ucycpO1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgd3JhcEl0ZXJhdG9yID0gZnVuY3Rpb24gKGl0ZXJhdG9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5leHQgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzLnB1c2god3JhcEl0ZXJhdG9yKG5leHQpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MucHVzaChjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYXN5bmMuc2V0SW1tZWRpYXRlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZXJhdG9yLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgICAgICB3cmFwSXRlcmF0b3IoYXN5bmMuaXRlcmF0b3IodGFza3MpKSgpO1xuICAgIH07XG5cbiAgICB2YXIgX3BhcmFsbGVsID0gZnVuY3Rpb24oZWFjaGZuLCB0YXNrcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKHRhc2tzLmNvbnN0cnVjdG9yID09PSBBcnJheSkge1xuICAgICAgICAgICAgZWFjaGZuLm1hcCh0YXNrcywgZnVuY3Rpb24gKGZuLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGlmIChmbikge1xuICAgICAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbChudWxsLCBlcnIsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgZWFjaGZuLmVhY2goX2tleXModGFza3MpLCBmdW5jdGlvbiAoaywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB0YXNrc1trXShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYy5wYXJhbGxlbCA9IGZ1bmN0aW9uICh0YXNrcywgY2FsbGJhY2spIHtcbiAgICAgICAgX3BhcmFsbGVsKHsgbWFwOiBhc3luYy5tYXAsIGVhY2g6IGFzeW5jLmVhY2ggfSwgdGFza3MsIGNhbGxiYWNrKTtcbiAgICB9O1xuXG4gICAgYXN5bmMucGFyYWxsZWxMaW1pdCA9IGZ1bmN0aW9uKHRhc2tzLCBsaW1pdCwgY2FsbGJhY2spIHtcbiAgICAgICAgX3BhcmFsbGVsKHsgbWFwOiBfbWFwTGltaXQobGltaXQpLCBlYWNoOiBfZWFjaExpbWl0KGxpbWl0KSB9LCB0YXNrcywgY2FsbGJhY2spO1xuICAgIH07XG5cbiAgICBhc3luYy5zZXJpZXMgPSBmdW5jdGlvbiAodGFza3MsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgIGlmICh0YXNrcy5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpIHtcbiAgICAgICAgICAgIGFzeW5jLm1hcFNlcmllcyh0YXNrcywgZnVuY3Rpb24gKGZuLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGlmIChmbikge1xuICAgICAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbChudWxsLCBlcnIsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgYXN5bmMuZWFjaFNlcmllcyhfa2V5cyh0YXNrcyksIGZ1bmN0aW9uIChrLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIHRhc2tzW2tdKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGFzeW5jLml0ZXJhdG9yID0gZnVuY3Rpb24gKHRhc2tzKSB7XG4gICAgICAgIHZhciBtYWtlQ2FsbGJhY2sgPSBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICAgICAgICAgIHZhciBmbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAodGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhc2tzW2luZGV4XS5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZm4ubmV4dCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGZuLm5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChpbmRleCA8IHRhc2tzLmxlbmd0aCAtIDEpID8gbWFrZUNhbGxiYWNrKGluZGV4ICsgMSk6IG51bGw7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIGZuO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbWFrZUNhbGxiYWNrKDApO1xuICAgIH07XG5cbiAgICBhc3luYy5hcHBseSA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkoXG4gICAgICAgICAgICAgICAgbnVsbCwgYXJncy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIHZhciBfY29uY2F0ID0gZnVuY3Rpb24gKGVhY2hmbiwgYXJyLCBmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHIgPSBbXTtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNiKSB7XG4gICAgICAgICAgICBmbih4LCBmdW5jdGlvbiAoZXJyLCB5KSB7XG4gICAgICAgICAgICAgICAgciA9IHIuY29uY2F0KHkgfHwgW10pO1xuICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBhc3luYy5jb25jYXQgPSBkb1BhcmFsbGVsKF9jb25jYXQpO1xuICAgIGFzeW5jLmNvbmNhdFNlcmllcyA9IGRvU2VyaWVzKF9jb25jYXQpO1xuXG4gICAgYXN5bmMud2hpbHN0ID0gZnVuY3Rpb24gKHRlc3QsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAodGVzdCgpKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYXN5bmMud2hpbHN0KHRlc3QsIGl0ZXJhdG9yLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgYXN5bmMuZG9XaGlsc3QgPSBmdW5jdGlvbiAoaXRlcmF0b3IsIHRlc3QsIGNhbGxiYWNrKSB7XG4gICAgICAgIGl0ZXJhdG9yKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0ZXN0KCkpIHtcbiAgICAgICAgICAgICAgICBhc3luYy5kb1doaWxzdChpdGVyYXRvciwgdGVzdCwgY2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIGFzeW5jLnVudGlsID0gZnVuY3Rpb24gKHRlc3QsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRlc3QoKSkge1xuICAgICAgICAgICAgaXRlcmF0b3IoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFzeW5jLnVudGlsKHRlc3QsIGl0ZXJhdG9yLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgYXN5bmMuZG9VbnRpbCA9IGZ1bmN0aW9uIChpdGVyYXRvciwgdGVzdCwgY2FsbGJhY2spIHtcbiAgICAgICAgaXRlcmF0b3IoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCF0ZXN0KCkpIHtcbiAgICAgICAgICAgICAgICBhc3luYy5kb1VudGlsKGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMucXVldWUgPSBmdW5jdGlvbiAod29ya2VyLCBjb25jdXJyZW5jeSkge1xuICAgICAgICBpZiAoY29uY3VycmVuY3kgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uY3VycmVuY3kgPSAxO1xuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIF9pbnNlcnQocSwgZGF0YSwgcG9zLCBjYWxsYmFjaykge1xuICAgICAgICAgIGlmKGRhdGEuY29uc3RydWN0b3IgIT09IEFycmF5KSB7XG4gICAgICAgICAgICAgIGRhdGEgPSBbZGF0YV07XG4gICAgICAgICAgfVxuICAgICAgICAgIF9lYWNoKGRhdGEsIGZ1bmN0aW9uKHRhc2spIHtcbiAgICAgICAgICAgICAgdmFyIGl0ZW0gPSB7XG4gICAgICAgICAgICAgICAgICBkYXRhOiB0YXNrLFxuICAgICAgICAgICAgICAgICAgY2FsbGJhY2s6IHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJyA/IGNhbGxiYWNrIDogbnVsbFxuICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgIGlmIChwb3MpIHtcbiAgICAgICAgICAgICAgICBxLnRhc2tzLnVuc2hpZnQoaXRlbSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcS50YXNrcy5wdXNoKGl0ZW0pO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgaWYgKHEuc2F0dXJhdGVkICYmIHEudGFza3MubGVuZ3RoID09PSBjb25jdXJyZW5jeSkge1xuICAgICAgICAgICAgICAgICAgcS5zYXR1cmF0ZWQoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUocS5wcm9jZXNzKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB3b3JrZXJzID0gMDtcbiAgICAgICAgdmFyIHEgPSB7XG4gICAgICAgICAgICB0YXNrczogW10sXG4gICAgICAgICAgICBjb25jdXJyZW5jeTogY29uY3VycmVuY3ksXG4gICAgICAgICAgICBzYXR1cmF0ZWQ6IG51bGwsXG4gICAgICAgICAgICBlbXB0eTogbnVsbCxcbiAgICAgICAgICAgIGRyYWluOiBudWxsLFxuICAgICAgICAgICAgcHVzaDogZnVuY3Rpb24gKGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIF9pbnNlcnQocSwgZGF0YSwgZmFsc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1bnNoaWZ0OiBmdW5jdGlvbiAoZGF0YSwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgX2luc2VydChxLCBkYXRhLCB0cnVlLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvY2VzczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGlmICh3b3JrZXJzIDwgcS5jb25jdXJyZW5jeSAmJiBxLnRhc2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdGFzayA9IHEudGFza3Muc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHEuZW1wdHkgJiYgcS50YXNrcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHEuZW1wdHkoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB3b3JrZXJzICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIHZhciBuZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgd29ya2VycyAtPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhc2suY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXNrLmNhbGxiYWNrLmFwcGx5KHRhc2ssIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocS5kcmFpbiAmJiBxLnRhc2tzLmxlbmd0aCArIHdvcmtlcnMgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBxLmRyYWluKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBxLnByb2Nlc3MoKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNiID0gb25seV9vbmNlKG5leHQpO1xuICAgICAgICAgICAgICAgICAgICB3b3JrZXIodGFzay5kYXRhLCBjYik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxlbmd0aDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBxLnRhc2tzLmxlbmd0aDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBydW5uaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHdvcmtlcnM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBxO1xuICAgIH07XG5cbiAgICBhc3luYy5jYXJnbyA9IGZ1bmN0aW9uICh3b3JrZXIsIHBheWxvYWQpIHtcbiAgICAgICAgdmFyIHdvcmtpbmcgICAgID0gZmFsc2UsXG4gICAgICAgICAgICB0YXNrcyAgICAgICA9IFtdO1xuXG4gICAgICAgIHZhciBjYXJnbyA9IHtcbiAgICAgICAgICAgIHRhc2tzOiB0YXNrcyxcbiAgICAgICAgICAgIHBheWxvYWQ6IHBheWxvYWQsXG4gICAgICAgICAgICBzYXR1cmF0ZWQ6IG51bGwsXG4gICAgICAgICAgICBlbXB0eTogbnVsbCxcbiAgICAgICAgICAgIGRyYWluOiBudWxsLFxuICAgICAgICAgICAgcHVzaDogZnVuY3Rpb24gKGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaWYoZGF0YS5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IFtkYXRhXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgX2VhY2goZGF0YSwgZnVuY3Rpb24odGFzaykge1xuICAgICAgICAgICAgICAgICAgICB0YXNrcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHRhc2ssXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjazogdHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nID8gY2FsbGJhY2sgOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FyZ28uc2F0dXJhdGVkICYmIHRhc2tzLmxlbmd0aCA9PT0gcGF5bG9hZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FyZ28uc2F0dXJhdGVkKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUoY2FyZ28ucHJvY2Vzcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvY2VzczogZnVuY3Rpb24gcHJvY2VzcygpIHtcbiAgICAgICAgICAgICAgICBpZiAod29ya2luZykgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGlmICh0YXNrcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYoY2FyZ28uZHJhaW4pIGNhcmdvLmRyYWluKCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgdHMgPSB0eXBlb2YgcGF5bG9hZCA9PT0gJ251bWJlcidcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IHRhc2tzLnNwbGljZSgwLCBwYXlsb2FkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogdGFza3Muc3BsaWNlKDApO1xuXG4gICAgICAgICAgICAgICAgdmFyIGRzID0gX21hcCh0cywgZnVuY3Rpb24gKHRhc2spIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhc2suZGF0YTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGlmKGNhcmdvLmVtcHR5KSBjYXJnby5lbXB0eSgpO1xuICAgICAgICAgICAgICAgIHdvcmtpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHdvcmtlcihkcywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB3b3JraW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgICAgICAgICAgICAgIF9lYWNoKHRzLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEuY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmNhbGxiYWNrLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBwcm9jZXNzKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGVuZ3RoOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhc2tzLmxlbmd0aDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBydW5uaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHdvcmtpbmc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBjYXJnbztcbiAgICB9O1xuXG4gICAgdmFyIF9jb25zb2xlX2ZuID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgZm4uYXBwbHkobnVsbCwgYXJncy5jb25jYXQoW2Z1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uc29sZS5lcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChjb25zb2xlW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfZWFjaChhcmdzLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGVbbmFtZV0oeCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1dKSk7XG4gICAgICAgIH07XG4gICAgfTtcbiAgICBhc3luYy5sb2cgPSBfY29uc29sZV9mbignbG9nJyk7XG4gICAgYXN5bmMuZGlyID0gX2NvbnNvbGVfZm4oJ2RpcicpO1xuICAgIC8qYXN5bmMuaW5mbyA9IF9jb25zb2xlX2ZuKCdpbmZvJyk7XG4gICAgYXN5bmMud2FybiA9IF9jb25zb2xlX2ZuKCd3YXJuJyk7XG4gICAgYXN5bmMuZXJyb3IgPSBfY29uc29sZV9mbignZXJyb3InKTsqL1xuXG4gICAgYXN5bmMubWVtb2l6ZSA9IGZ1bmN0aW9uIChmbiwgaGFzaGVyKSB7XG4gICAgICAgIHZhciBtZW1vID0ge307XG4gICAgICAgIHZhciBxdWV1ZXMgPSB7fTtcbiAgICAgICAgaGFzaGVyID0gaGFzaGVyIHx8IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICByZXR1cm4geDtcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIG1lbW9pemVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICAgICAgICAgIHZhciBrZXkgPSBoYXNoZXIuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgICAgICBpZiAoa2V5IGluIG1lbW8pIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseShudWxsLCBtZW1vW2tleV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoa2V5IGluIHF1ZXVlcykge1xuICAgICAgICAgICAgICAgIHF1ZXVlc1trZXldLnB1c2goY2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcXVldWVzW2tleV0gPSBbY2FsbGJhY2tdO1xuICAgICAgICAgICAgICAgIGZuLmFwcGx5KG51bGwsIGFyZ3MuY29uY2F0KFtmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW9ba2V5XSA9IGFyZ3VtZW50cztcbiAgICAgICAgICAgICAgICAgICAgdmFyIHEgPSBxdWV1ZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHF1ZXVlc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHEubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcVtpXS5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfV0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgbWVtb2l6ZWQubWVtbyA9IG1lbW87XG4gICAgICAgIG1lbW9pemVkLnVubWVtb2l6ZWQgPSBmbjtcbiAgICAgICAgcmV0dXJuIG1lbW9pemVkO1xuICAgIH07XG5cbiAgICBhc3luYy51bm1lbW9pemUgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAoZm4udW5tZW1vaXplZCB8fCBmbikuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfTtcblxuICAgIGFzeW5jLnRpbWVzID0gZnVuY3Rpb24gKGNvdW50LCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGNvdW50ZXIgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb3VudGVyLnB1c2goaSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFzeW5jLm1hcChjb3VudGVyLCBpdGVyYXRvciwgY2FsbGJhY2spO1xuICAgIH07XG5cbiAgICBhc3luYy50aW1lc1NlcmllcyA9IGZ1bmN0aW9uIChjb3VudCwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBjb3VudGVyID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY291bnRlci5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhc3luYy5tYXBTZXJpZXMoY291bnRlciwgaXRlcmF0b3IsIGNhbGxiYWNrKTtcbiAgICB9O1xuXG4gICAgYXN5bmMuY29tcG9zZSA9IGZ1bmN0aW9uICgvKiBmdW5jdGlvbnMuLi4gKi8pIHtcbiAgICAgICAgdmFyIGZucyA9IEFycmF5LnByb3RvdHlwZS5yZXZlcnNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgICAgICAgICBhc3luYy5yZWR1Y2UoZm5zLCBhcmdzLCBmdW5jdGlvbiAobmV3YXJncywgZm4sIGNiKSB7XG4gICAgICAgICAgICAgICAgZm4uYXBwbHkodGhhdCwgbmV3YXJncy5jb25jYXQoW2Z1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5leHRhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyLCBuZXh0YXJncyk7XG4gICAgICAgICAgICAgICAgfV0pKVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGF0LCBbZXJyXS5jb25jYXQocmVzdWx0cykpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIHZhciBfYXBwbHlFYWNoID0gZnVuY3Rpb24gKGVhY2hmbiwgZm5zIC8qYXJncy4uLiovKSB7XG4gICAgICAgIHZhciBnbyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgICAgICAgICByZXR1cm4gZWFjaGZuKGZucywgZnVuY3Rpb24gKGZuLCBjYikge1xuICAgICAgICAgICAgICAgIGZuLmFwcGx5KHRoYXQsIGFyZ3MuY29uY2F0KFtjYl0pKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjYWxsYmFjayk7XG4gICAgICAgIH07XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICAgICAgcmV0dXJuIGdvLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGdvO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBhc3luYy5hcHBseUVhY2ggPSBkb1BhcmFsbGVsKF9hcHBseUVhY2gpO1xuICAgIGFzeW5jLmFwcGx5RWFjaFNlcmllcyA9IGRvU2VyaWVzKF9hcHBseUVhY2gpO1xuXG4gICAgYXN5bmMuZm9yZXZlciA9IGZ1bmN0aW9uIChmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgZnVuY3Rpb24gbmV4dChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZuKG5leHQpO1xuICAgICAgICB9XG4gICAgICAgIG5leHQoKTtcbiAgICB9O1xuXG4gICAgLy8gQU1EIC8gUmVxdWlyZUpTXG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgIT09ICd1bmRlZmluZWQnICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKFtdLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gYXN5bmM7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBOb2RlLmpzXG4gICAgZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBhc3luYztcbiAgICB9XG4gICAgLy8gaW5jbHVkZWQgZGlyZWN0bHkgdmlhIDxzY3JpcHQ+IHRhZ1xuICAgIGVsc2Uge1xuICAgICAgICByb290LmFzeW5jID0gYXN5bmM7XG4gICAgfVxuXG59KCkpO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZSgnX3Byb2Nlc3MnKSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkltNXZaR1ZmYlc5a2RXeGxjeTloYzNsdVl5OXNhV0l2WVhONWJtTXVhbk1pWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJanRCUVVGQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWk4cVoyeHZZbUZzSUhObGRFbHRiV1ZrYVdGMFpUb2dabUZzYzJVc0lITmxkRlJwYldWdmRYUTZJR1poYkhObExDQmpiMjV6YjJ4bE9pQm1ZV3h6WlNBcUwxeHVLR1oxYm1OMGFXOXVJQ2dwSUh0Y2JseHVJQ0FnSUhaaGNpQmhjM2x1WXlBOUlIdDlPMXh1WEc0Z0lDQWdMeThnWjJ4dlltRnNJRzl1SUhSb1pTQnpaWEoyWlhJc0lIZHBibVJ2ZHlCcGJpQjBhR1VnWW5KdmQzTmxjbHh1SUNBZ0lIWmhjaUJ5YjI5MExDQndjbVYyYVc5MWMxOWhjM2x1WXp0Y2JseHVJQ0FnSUhKdmIzUWdQU0IwYUdsek8xeHVJQ0FnSUdsbUlDaHliMjkwSUNFOUlHNTFiR3dwSUh0Y2JpQWdJQ0FnSUhCeVpYWnBiM1Z6WDJGemVXNWpJRDBnY205dmRDNWhjM2x1WXp0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0JoYzNsdVl5NXViME52Ym1ac2FXTjBJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUNBZ0lDQnliMjkwTG1GemVXNWpJRDBnY0hKbGRtbHZkWE5mWVhONWJtTTdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQmhjM2x1WXp0Y2JpQWdJQ0I5TzF4dVhHNGdJQ0FnWm5WdVkzUnBiMjRnYjI1c2VWOXZibU5sS0dadUtTQjdYRzRnSUNBZ0lDQWdJSFpoY2lCallXeHNaV1FnUFNCbVlXeHpaVHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdhV1lnS0dOaGJHeGxaQ2tnZEdoeWIzY2dibVYzSUVWeWNtOXlLRndpUTJGc2JHSmhZMnNnZDJGeklHRnNjbVZoWkhrZ1kyRnNiR1ZrTGx3aUtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUdOaGJHeGxaQ0E5SUhSeWRXVTdYRzRnSUNBZ0lDQWdJQ0FnSUNCbWJpNWhjSEJzZVNoeWIyOTBMQ0JoY21kMWJXVnVkSE1wTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dVhHNGdJQ0FnTHk4dkx5QmpjbTl6Y3kxaWNtOTNjMlZ5SUdOdmJYQmhkR2xpYkdsMGVTQm1kVzVqZEdsdmJuTWdMeTh2TDF4dVhHNGdJQ0FnZG1GeUlGOWxZV05vSUQwZ1puVnVZM1JwYjI0Z0tHRnljaXdnYVhSbGNtRjBiM0lwSUh0Y2JpQWdJQ0FnSUNBZ2FXWWdLR0Z5Y2k1bWIzSkZZV05vS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdZWEp5TG1admNrVmhZMmdvYVhSbGNtRjBiM0lwTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2dZWEp5TG14bGJtZDBhRHNnYVNBclBTQXhLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnBkR1Z5WVhSdmNpaGhjbkpiYVYwc0lHa3NJR0Z5Y2lrN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNCOU8xeHVYRzRnSUNBZ2RtRnlJRjl0WVhBZ1BTQm1kVzVqZEdsdmJpQW9ZWEp5TENCcGRHVnlZWFJ2Y2lrZ2UxeHVJQ0FnSUNBZ0lDQnBaaUFvWVhKeUxtMWhjQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHRnljaTV0WVhBb2FYUmxjbUYwYjNJcE8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSFpoY2lCeVpYTjFiSFJ6SUQwZ1cxMDdYRzRnSUNBZ0lDQWdJRjlsWVdOb0tHRnljaXdnWm5WdVkzUnBiMjRnS0hnc0lHa3NJR0VwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJSEpsYzNWc2RITXVjSFZ6YUNocGRHVnlZWFJ2Y2loNExDQnBMQ0JoS1NrN1hHNGdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdjbVZ6ZFd4MGN6dGNiaUFnSUNCOU8xeHVYRzRnSUNBZ2RtRnlJRjl5WldSMVkyVWdQU0JtZFc1amRHbHZiaUFvWVhKeUxDQnBkR1Z5WVhSdmNpd2diV1Z0YnlrZ2UxeHVJQ0FnSUNBZ0lDQnBaaUFvWVhKeUxuSmxaSFZqWlNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJR0Z5Y2k1eVpXUjFZMlVvYVhSbGNtRjBiM0lzSUcxbGJXOHBPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUY5bFlXTm9LR0Z5Y2l3Z1puVnVZM1JwYjI0Z0tIZ3NJR2tzSUdFcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUcxbGJXOGdQU0JwZEdWeVlYUnZjaWh0WlcxdkxDQjRMQ0JwTENCaEtUdGNiaUFnSUNBZ0lDQWdmU2s3WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJ0Wlcxdk8xeHVJQ0FnSUgwN1hHNWNiaUFnSUNCMllYSWdYMnRsZVhNZ1BTQm1kVzVqZEdsdmJpQW9iMkpxS1NCN1hHNGdJQ0FnSUNBZ0lHbG1JQ2hQWW1wbFkzUXVhMlY1Y3lrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJRTlpYW1WamRDNXJaWGx6S0c5aWFpazdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnZG1GeUlHdGxlWE1nUFNCYlhUdGNiaUFnSUNBZ0lDQWdabTl5SUNoMllYSWdheUJwYmlCdlltb3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2h2WW1vdWFHRnpUM2R1VUhKdmNHVnlkSGtvYXlrcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnJaWGx6TG5CMWMyZ29heWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR3RsZVhNN1hHNGdJQ0FnZlR0Y2JseHVJQ0FnSUM4dkx5OGdaWGh3YjNKMFpXUWdZWE41Ym1NZ2JXOWtkV3hsSUdaMWJtTjBhVzl1Y3lBdkx5OHZYRzVjYmlBZ0lDQXZMeTh2SUc1bGVIUlVhV05ySUdsdGNHeGxiV1Z1ZEdGMGFXOXVJSGRwZEdnZ1luSnZkM05sY2kxamIyMXdZWFJwWW14bElHWmhiR3hpWVdOcklDOHZMeTljYmlBZ0lDQnBaaUFvZEhsd1pXOW1JSEJ5YjJObGMzTWdQVDA5SUNkMWJtUmxabWx1WldRbklIeDhJQ0VvY0hKdlkyVnpjeTV1WlhoMFZHbGpheWtwSUh0Y2JpQWdJQ0FnSUNBZ2FXWWdLSFI1Y0dWdlppQnpaWFJKYlcxbFpHbGhkR1VnUFQwOUlDZG1kVzVqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHRnplVzVqTG01bGVIUlVhV05ySUQwZ1puVnVZM1JwYjI0Z0tHWnVLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnTHk4Z2JtOTBJR0VnWkdseVpXTjBJR0ZzYVdGeklHWnZjaUJKUlRFd0lHTnZiWEJoZEdsaWFXeHBkSGxjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J6WlhSSmJXMWxaR2xoZEdVb1ptNHBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2ZUdGNiaUFnSUNBZ0lDQWdJQ0FnSUdGemVXNWpMbk5sZEVsdGJXVmthV0YwWlNBOUlHRnplVzVqTG01bGVIUlVhV05yTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdZWE41Ym1NdWJtVjRkRlJwWTJzZ1BTQm1kVzVqZEdsdmJpQW9abTRwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCelpYUlVhVzFsYjNWMEtHWnVMQ0F3S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmhjM2x1WXk1elpYUkpiVzFsWkdsaGRHVWdQU0JoYzNsdVl5NXVaWGgwVkdsamF6dGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnSUNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnWVhONWJtTXVibVY0ZEZScFkyc2dQU0J3Y205alpYTnpMbTVsZUhSVWFXTnJPMXh1SUNBZ0lDQWdJQ0JwWmlBb2RIbHdaVzltSUhObGRFbHRiV1ZrYVdGMFpTQWhQVDBnSjNWdVpHVm1hVzVsWkNjcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdGemVXNWpMbk5sZEVsdGJXVmthV0YwWlNBOUlHWjFibU4wYVc5dUlDaG1iaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0F2THlCdWIzUWdZU0JrYVhKbFkzUWdZV3hwWVhNZ1ptOXlJRWxGTVRBZ1kyOXRjR0YwYVdKcGJHbDBlVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQnpaWFJKYlcxbFpHbGhkR1VvWm00cE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR0Z6ZVc1akxuTmxkRWx0YldWa2FXRjBaU0E5SUdGemVXNWpMbTVsZUhSVWFXTnJPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdmVnh1WEc0Z0lDQWdZWE41Ym1NdVpXRmphQ0E5SUdaMWJtTjBhVzl1SUNoaGNuSXNJR2wwWlhKaGRHOXlMQ0JqWVd4c1ltRmpheWtnZTF4dUlDQWdJQ0FnSUNCallXeHNZbUZqYXlBOUlHTmhiR3hpWVdOcklIeDhJR1oxYm1OMGFXOXVJQ2dwSUh0OU8xeHVJQ0FnSUNBZ0lDQnBaaUFvSVdGeWNpNXNaVzVuZEdncElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJqWVd4c1ltRmpheWdwTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lIWmhjaUJqYjIxd2JHVjBaV1FnUFNBd08xeHVJQ0FnSUNBZ0lDQmZaV0ZqYUNoaGNuSXNJR1oxYm1OMGFXOXVJQ2g0S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JwZEdWeVlYUnZjaWg0TENCdmJteDVYMjl1WTJVb1puVnVZM1JwYjI0Z0tHVnljaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaGxjbklwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZMkZzYkdKaFkyc29aWEp5S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZMkZzYkdKaFkyc2dQU0JtZFc1amRHbHZiaUFvS1NCN2ZUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR052YlhCc1pYUmxaQ0FyUFNBeE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb1kyOXRjR3hsZEdWa0lENDlJR0Z5Y2k1c1pXNW5kR2dwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdOaGJHeGlZV05yS0c1MWJHd3BPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnZlNrcE8xeHVJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQjlPMXh1SUNBZ0lHRnplVzVqTG1admNrVmhZMmdnUFNCaGMzbHVZeTVsWVdOb08xeHVYRzRnSUNBZ1lYTjVibU11WldGamFGTmxjbWxsY3lBOUlHWjFibU4wYVc5dUlDaGhjbklzSUdsMFpYSmhkRzl5TENCallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQmpZV3hzWW1GamF5QTlJR05oYkd4aVlXTnJJSHg4SUdaMWJtTjBhVzl1SUNncElIdDlPMXh1SUNBZ0lDQWdJQ0JwWmlBb0lXRnljaTVzWlc1bmRHZ3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCallXeHNZbUZqYXlncE8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSFpoY2lCamIyMXdiR1YwWldRZ1BTQXdPMXh1SUNBZ0lDQWdJQ0IyWVhJZ2FYUmxjbUYwWlNBOUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHbDBaWEpoZEc5eUtHRnljbHRqYjIxd2JHVjBaV1JkTENCbWRXNWpkR2x2YmlBb1pYSnlLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tHVnljaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpZV3hzWW1GamF5aGxjbklwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpZV3hzWW1GamF5QTlJR1oxYm1OMGFXOXVJQ2dwSUh0OU8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZMjl0Y0d4bGRHVmtJQ3M5SURFN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoamIyMXdiR1YwWldRZ1BqMGdZWEp5TG14bGJtZDBhQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTJGc2JHSmhZMnNvYm5Wc2JDazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCcGRHVnlZWFJsS0NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUNBZ2FYUmxjbUYwWlNncE8xeHVJQ0FnSUgwN1hHNGdJQ0FnWVhONWJtTXVabTl5UldGamFGTmxjbWxsY3lBOUlHRnplVzVqTG1WaFkyaFRaWEpwWlhNN1hHNWNiaUFnSUNCaGMzbHVZeTVsWVdOb1RHbHRhWFFnUFNCbWRXNWpkR2x2YmlBb1lYSnlMQ0JzYVcxcGRDd2dhWFJsY21GMGIzSXNJR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdJQ0FnSUhaaGNpQm1iaUE5SUY5bFlXTm9UR2x0YVhRb2JHbHRhWFFwTzF4dUlDQWdJQ0FnSUNCbWJpNWhjSEJzZVNodWRXeHNMQ0JiWVhKeUxDQnBkR1Z5WVhSdmNpd2dZMkZzYkdKaFkydGRLVHRjYmlBZ0lDQjlPMXh1SUNBZ0lHRnplVzVqTG1admNrVmhZMmhNYVcxcGRDQTlJR0Z6ZVc1akxtVmhZMmhNYVcxcGREdGNibHh1SUNBZ0lIWmhjaUJmWldGamFFeHBiV2wwSUQwZ1puVnVZM1JwYjI0Z0tHeHBiV2wwS1NCN1hHNWNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHWjFibU4wYVc5dUlDaGhjbklzSUdsMFpYSmhkRzl5TENCallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnWTJGc2JHSmhZMnNnUFNCallXeHNZbUZqYXlCOGZDQm1kVzVqZEdsdmJpQW9LU0I3ZlR0Y2JpQWdJQ0FnSUNBZ0lDQWdJR2xtSUNnaFlYSnlMbXhsYm1kMGFDQjhmQ0JzYVcxcGRDQThQU0F3S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUdOaGJHeGlZV05yS0NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQjJZWElnWTI5dGNHeGxkR1ZrSUQwZ01EdGNiaUFnSUNBZ0lDQWdJQ0FnSUhaaGNpQnpkR0Z5ZEdWa0lEMGdNRHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIWmhjaUJ5ZFc1dWFXNW5JRDBnTUR0Y2JseHVJQ0FnSUNBZ0lDQWdJQ0FnS0daMWJtTjBhVzl1SUhKbGNHeGxibWx6YUNBb0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0dOdmJYQnNaWFJsWkNBK1BTQmhjbkl1YkdWdVozUm9LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCallXeHNZbUZqYXlncE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNibHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSGRvYVd4bElDaHlkVzV1YVc1bklEd2diR2x0YVhRZ0ppWWdjM1JoY25SbFpDQThJR0Z5Y2k1c1pXNW5kR2dwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjM1JoY25SbFpDQXJQU0F4TzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlkVzV1YVc1bklDczlJREU3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbDBaWEpoZEc5eUtHRnljbHR6ZEdGeWRHVmtJQzBnTVYwc0lHWjFibU4wYVc5dUlDaGxjbklwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaGxjbklwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpZV3hzWW1GamF5aGxjbklwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHTmhiR3hpWVdOcklEMGdablZ1WTNScGIyNGdLQ2tnZTMwN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCamIyMXdiR1YwWldRZ0t6MGdNVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeWRXNXVhVzVuSUMwOUlERTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tHTnZiWEJzWlhSbFpDQStQU0JoY25JdWJHVnVaM1JvS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdOaGJHeGlZV05yS0NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWEJzWlc1cGMyZ29LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJSDBwS0NrN1hHNGdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ2ZUdGNibHh1WEc0Z0lDQWdkbUZ5SUdSdlVHRnlZV3hzWld3Z1BTQm1kVzVqZEdsdmJpQW9abTRwSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhaaGNpQmhjbWR6SUQwZ1FYSnlZWGt1Y0hKdmRHOTBlWEJsTG5Oc2FXTmxMbU5oYkd3b1lYSm5kVzFsYm5SektUdGNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJtYmk1aGNIQnNlU2h1ZFd4c0xDQmJZWE41Ym1NdVpXRmphRjB1WTI5dVkyRjBLR0Z5WjNNcEtUdGNiaUFnSUNBZ0lDQWdmVHRjYmlBZ0lDQjlPMXh1SUNBZ0lIWmhjaUJrYjFCaGNtRnNiR1ZzVEdsdGFYUWdQU0JtZFc1amRHbHZiaWhzYVcxcGRDd2dabTRwSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhaaGNpQmhjbWR6SUQwZ1FYSnlZWGt1Y0hKdmRHOTBlWEJsTG5Oc2FXTmxMbU5oYkd3b1lYSm5kVzFsYm5SektUdGNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJtYmk1aGNIQnNlU2h1ZFd4c0xDQmJYMlZoWTJoTWFXMXBkQ2hzYVcxcGRDbGRMbU52Ym1OaGRDaGhjbWR6S1NrN1hHNGdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ2ZUdGNiaUFnSUNCMllYSWdaRzlUWlhKcFpYTWdQU0JtZFc1amRHbHZiaUFvWm00cElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIWmhjaUJoY21keklEMGdRWEp5WVhrdWNISnZkRzkwZVhCbExuTnNhV05sTG1OaGJHd29ZWEpuZFcxbGJuUnpLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCbWJpNWhjSEJzZVNodWRXeHNMQ0JiWVhONWJtTXVaV0ZqYUZObGNtbGxjMTB1WTI5dVkyRjBLR0Z5WjNNcEtUdGNiaUFnSUNBZ0lDQWdmVHRjYmlBZ0lDQjlPMXh1WEc1Y2JpQWdJQ0IyWVhJZ1gyRnplVzVqVFdGd0lEMGdablZ1WTNScGIyNGdLR1ZoWTJobWJpd2dZWEp5TENCcGRHVnlZWFJ2Y2l3Z1kyRnNiR0poWTJzcElIdGNiaUFnSUNBZ0lDQWdkbUZ5SUhKbGMzVnNkSE1nUFNCYlhUdGNiaUFnSUNBZ0lDQWdZWEp5SUQwZ1gyMWhjQ2hoY25Jc0lHWjFibU4wYVc5dUlDaDRMQ0JwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdlMmx1WkdWNE9pQnBMQ0IyWVd4MVpUb2dlSDA3WEc0Z0lDQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0lDQmxZV05vWm00b1lYSnlMQ0JtZFc1amRHbHZiaUFvZUN3Z1kyRnNiR0poWTJzcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdsMFpYSmhkRzl5S0hndWRtRnNkV1VzSUdaMWJtTjBhVzl1SUNobGNuSXNJSFlwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYTjFiSFJ6VzNndWFXNWtaWGhkSUQwZ2RqdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpZV3hzWW1GamF5aGxjbklwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdmU2s3WEc0Z0lDQWdJQ0FnSUgwc0lHWjFibU4wYVc5dUlDaGxjbklwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR05oYkd4aVlXTnJLR1Z5Y2l3Z2NtVnpkV3gwY3lrN1hHNGdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lIMDdYRzRnSUNBZ1lYTjVibU11YldGd0lEMGdaRzlRWVhKaGJHeGxiQ2hmWVhONWJtTk5ZWEFwTzF4dUlDQWdJR0Z6ZVc1akxtMWhjRk5sY21sbGN5QTlJR1J2VTJWeWFXVnpLRjloYzNsdVkwMWhjQ2s3WEc0Z0lDQWdZWE41Ym1NdWJXRndUR2x0YVhRZ1BTQm1kVzVqZEdsdmJpQW9ZWEp5TENCc2FXMXBkQ3dnYVhSbGNtRjBiM0lzSUdOaGJHeGlZV05yS1NCN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCZmJXRndUR2x0YVhRb2JHbHRhWFFwS0dGeWNpd2dhWFJsY21GMGIzSXNJR05oYkd4aVlXTnJLVHRjYmlBZ0lDQjlPMXh1WEc0Z0lDQWdkbUZ5SUY5dFlYQk1hVzFwZENBOUlHWjFibU4wYVc5dUtHeHBiV2wwS1NCN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCa2IxQmhjbUZzYkdWc1RHbHRhWFFvYkdsdGFYUXNJRjloYzNsdVkwMWhjQ2s3WEc0Z0lDQWdmVHRjYmx4dUlDQWdJQzh2SUhKbFpIVmpaU0J2Ym14NUlHaGhjeUJoSUhObGNtbGxjeUIyWlhKemFXOXVMQ0JoY3lCa2IybHVaeUJ5WldSMVkyVWdhVzRnY0dGeVlXeHNaV3dnZDI5dUozUmNiaUFnSUNBdkx5QjNiM0pySUdsdUlHMWhibmtnYzJsMGRXRjBhVzl1Y3k1Y2JpQWdJQ0JoYzNsdVl5NXlaV1IxWTJVZ1BTQm1kVzVqZEdsdmJpQW9ZWEp5TENCdFpXMXZMQ0JwZEdWeVlYUnZjaXdnWTJGc2JHSmhZMnNwSUh0Y2JpQWdJQ0FnSUNBZ1lYTjVibU11WldGamFGTmxjbWxsY3loaGNuSXNJR1oxYm1OMGFXOXVJQ2g0TENCallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnYVhSbGNtRjBiM0lvYldWdGJ5d2dlQ3dnWm5WdVkzUnBiMjRnS0dWeWNpd2dkaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUcxbGJXOGdQU0IyTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdOaGJHeGlZV05yS0dWeWNpazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdmU3dnWm5WdVkzUnBiMjRnS0dWeWNpa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ1kyRnNiR0poWTJzb1pYSnlMQ0J0WlcxdktUdGNiaUFnSUNBZ0lDQWdmU2s3WEc0Z0lDQWdmVHRjYmlBZ0lDQXZMeUJwYm1wbFkzUWdZV3hwWVhOY2JpQWdJQ0JoYzNsdVl5NXBibXBsWTNRZ1BTQmhjM2x1WXk1eVpXUjFZMlU3WEc0Z0lDQWdMeThnWm05c1pHd2dZV3hwWVhOY2JpQWdJQ0JoYzNsdVl5NW1iMnhrYkNBOUlHRnplVzVqTG5KbFpIVmpaVHRjYmx4dUlDQWdJR0Z6ZVc1akxuSmxaSFZqWlZKcFoyaDBJRDBnWm5WdVkzUnBiMjRnS0dGeWNpd2diV1Z0Ynl3Z2FYUmxjbUYwYjNJc0lHTmhiR3hpWVdOcktTQjdYRzRnSUNBZ0lDQWdJSFpoY2lCeVpYWmxjbk5sWkNBOUlGOXRZWEFvWVhKeUxDQm1kVzVqZEdsdmJpQW9lQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlIZzdYRzRnSUNBZ0lDQWdJSDBwTG5KbGRtVnljMlVvS1R0Y2JpQWdJQ0FnSUNBZ1lYTjVibU11Y21Wa2RXTmxLSEpsZG1WeWMyVmtMQ0J0WlcxdkxDQnBkR1Z5WVhSdmNpd2dZMkZzYkdKaFkyc3BPMXh1SUNBZ0lIMDdYRzRnSUNBZ0x5OGdabTlzWkhJZ1lXeHBZWE5jYmlBZ0lDQmhjM2x1WXk1bWIyeGtjaUE5SUdGemVXNWpMbkpsWkhWalpWSnBaMmgwTzF4dVhHNGdJQ0FnZG1GeUlGOW1hV3gwWlhJZ1BTQm1kVzVqZEdsdmJpQW9aV0ZqYUdadUxDQmhjbklzSUdsMFpYSmhkRzl5TENCallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnY21WemRXeDBjeUE5SUZ0ZE8xeHVJQ0FnSUNBZ0lDQmhjbklnUFNCZmJXRndLR0Z5Y2l3Z1puVnVZM1JwYjI0Z0tIZ3NJR2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQjdhVzVrWlhnNklHa3NJSFpoYkhWbE9pQjRmVHRjYmlBZ0lDQWdJQ0FnZlNrN1hHNGdJQ0FnSUNBZ0lHVmhZMmhtYmloaGNuSXNJR1oxYm1OMGFXOXVJQ2g0TENCallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnYVhSbGNtRjBiM0lvZUM1MllXeDFaU3dnWm5WdVkzUnBiMjRnS0hZcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvZGlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhOMWJIUnpMbkIxYzJnb2VDazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR05oYkd4aVlXTnJLQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQWdJQ0FnZlN3Z1puVnVZM1JwYjI0Z0tHVnljaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdZMkZzYkdKaFkyc29YMjFoY0NoeVpYTjFiSFJ6TG5OdmNuUW9ablZ1WTNScGIyNGdLR0VzSUdJcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1lTNXBibVJsZUNBdElHSXVhVzVrWlhnN1hHNGdJQ0FnSUNBZ0lDQWdJQ0I5S1N3Z1puVnVZM1JwYjI0Z0tIZ3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdlQzUyWVd4MVpUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgwcEtUdGNiaUFnSUNBZ0lDQWdmU2s3WEc0Z0lDQWdmVHRjYmlBZ0lDQmhjM2x1WXk1bWFXeDBaWElnUFNCa2IxQmhjbUZzYkdWc0tGOW1hV3gwWlhJcE8xeHVJQ0FnSUdGemVXNWpMbVpwYkhSbGNsTmxjbWxsY3lBOUlHUnZVMlZ5YVdWektGOW1hV3gwWlhJcE8xeHVJQ0FnSUM4dklITmxiR1ZqZENCaGJHbGhjMXh1SUNBZ0lHRnplVzVqTG5ObGJHVmpkQ0E5SUdGemVXNWpMbVpwYkhSbGNqdGNiaUFnSUNCaGMzbHVZeTV6Wld4bFkzUlRaWEpwWlhNZ1BTQmhjM2x1WXk1bWFXeDBaWEpUWlhKcFpYTTdYRzVjYmlBZ0lDQjJZWElnWDNKbGFtVmpkQ0E5SUdaMWJtTjBhVzl1SUNobFlXTm9abTRzSUdGeWNpd2dhWFJsY21GMGIzSXNJR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdJQ0FnSUhaaGNpQnlaWE4xYkhSeklEMGdXMTA3WEc0Z0lDQWdJQ0FnSUdGeWNpQTlJRjl0WVhBb1lYSnlMQ0JtZFc1amRHbHZiaUFvZUN3Z2FTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUh0cGJtUmxlRG9nYVN3Z2RtRnNkV1U2SUhoOU8xeHVJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQWdJQ0FnWldGamFHWnVLR0Z5Y2l3Z1puVnVZM1JwYjI0Z0tIZ3NJR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnBkR1Z5WVhSdmNpaDRMblpoYkhWbExDQm1kVzVqZEdsdmJpQW9kaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDZ2hkaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWE4xYkhSekxuQjFjMmdvZUNrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHTmhiR3hpWVdOcktDazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdmU3dnWm5WdVkzUnBiMjRnS0dWeWNpa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ1kyRnNiR0poWTJzb1gyMWhjQ2h5WlhOMWJIUnpMbk52Y25Rb1puVnVZM1JwYjI0Z0tHRXNJR0lwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWVM1cGJtUmxlQ0F0SUdJdWFXNWtaWGc3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlLU3dnWm5WdVkzUnBiMjRnS0hncElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2VDNTJZV3gxWlR0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDBwS1R0Y2JpQWdJQ0FnSUNBZ2ZTazdYRzRnSUNBZ2ZUdGNiaUFnSUNCaGMzbHVZeTV5WldwbFkzUWdQU0JrYjFCaGNtRnNiR1ZzS0Y5eVpXcGxZM1FwTzF4dUlDQWdJR0Z6ZVc1akxuSmxhbVZqZEZObGNtbGxjeUE5SUdSdlUyVnlhV1Z6S0Y5eVpXcGxZM1FwTzF4dVhHNGdJQ0FnZG1GeUlGOWtaWFJsWTNRZ1BTQm1kVzVqZEdsdmJpQW9aV0ZqYUdadUxDQmhjbklzSUdsMFpYSmhkRzl5TENCdFlXbHVYMk5oYkd4aVlXTnJLU0I3WEc0Z0lDQWdJQ0FnSUdWaFkyaG1iaWhoY25Jc0lHWjFibU4wYVc5dUlDaDRMQ0JqWVd4c1ltRmpheWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdhWFJsY21GMGIzSW9lQ3dnWm5WdVkzUnBiMjRnS0hKbGMzVnNkQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaHlaWE4xYkhRcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldGcGJsOWpZV3hzWW1GamF5aDRLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXRnBibDlqWVd4c1ltRmpheUE5SUdaMWJtTjBhVzl1SUNncElIdDlPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JsYkhObElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTJGc2JHSmhZMnNvS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0FnSUNBZ2ZTd2dablZ1WTNScGIyNGdLR1Z5Y2lrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnYldGcGJsOWpZV3hzWW1GamF5Z3BPMXh1SUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0I5TzF4dUlDQWdJR0Z6ZVc1akxtUmxkR1ZqZENBOUlHUnZVR0Z5WVd4c1pXd29YMlJsZEdWamRDazdYRzRnSUNBZ1lYTjVibU11WkdWMFpXTjBVMlZ5YVdWeklEMGdaRzlUWlhKcFpYTW9YMlJsZEdWamRDazdYRzVjYmlBZ0lDQmhjM2x1WXk1emIyMWxJRDBnWm5WdVkzUnBiMjRnS0dGeWNpd2dhWFJsY21GMGIzSXNJRzFoYVc1ZlkyRnNiR0poWTJzcElIdGNiaUFnSUNBZ0lDQWdZWE41Ym1NdVpXRmphQ2hoY25Jc0lHWjFibU4wYVc5dUlDaDRMQ0JqWVd4c1ltRmpheWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdhWFJsY21GMGIzSW9lQ3dnWm5WdVkzUnBiMjRnS0hZcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvZGlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J0WVdsdVgyTmhiR3hpWVdOcktIUnlkV1VwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRZV2x1WDJOaGJHeGlZV05ySUQwZ1puVnVZM1JwYjI0Z0tDa2dlMzA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdOaGJHeGlZV05yS0NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0FnSUNBZ2ZTd2dablZ1WTNScGIyNGdLR1Z5Y2lrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnYldGcGJsOWpZV3hzWW1GamF5aG1ZV3h6WlNrN1hHNGdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lIMDdYRzRnSUNBZ0x5OGdZVzU1SUdGc2FXRnpYRzRnSUNBZ1lYTjVibU11WVc1NUlEMGdZWE41Ym1NdWMyOXRaVHRjYmx4dUlDQWdJR0Z6ZVc1akxtVjJaWEo1SUQwZ1puVnVZM1JwYjI0Z0tHRnljaXdnYVhSbGNtRjBiM0lzSUcxaGFXNWZZMkZzYkdKaFkyc3BJSHRjYmlBZ0lDQWdJQ0FnWVhONWJtTXVaV0ZqYUNoaGNuSXNJR1oxYm1OMGFXOXVJQ2g0TENCallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnYVhSbGNtRjBiM0lvZUN3Z1puVnVZM1JwYjI0Z0tIWXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb0lYWXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXRnBibDlqWVd4c1ltRmpheWhtWVd4elpTazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUcxaGFXNWZZMkZzYkdKaFkyc2dQU0JtZFc1amRHbHZiaUFvS1NCN2ZUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZMkZzYkdKaFkyc29LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0I5TENCbWRXNWpkR2x2YmlBb1pYSnlLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnRZV2x1WDJOaGJHeGlZV05yS0hSeWRXVXBPMXh1SUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0I5TzF4dUlDQWdJQzh2SUdGc2JDQmhiR2xoYzF4dUlDQWdJR0Z6ZVc1akxtRnNiQ0E5SUdGemVXNWpMbVYyWlhKNU8xeHVYRzRnSUNBZ1lYTjVibU11YzI5eWRFSjVJRDBnWm5WdVkzUnBiMjRnS0dGeWNpd2dhWFJsY21GMGIzSXNJR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdJQ0FnSUdGemVXNWpMbTFoY0NoaGNuSXNJR1oxYm1OMGFXOXVJQ2g0TENCallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnYVhSbGNtRjBiM0lvZUN3Z1puVnVZM1JwYjI0Z0tHVnljaXdnWTNKcGRHVnlhV0VwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCcFppQW9aWEp5S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR05oYkd4aVlXTnJLR1Z5Y2lrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpZV3hzWW1GamF5aHVkV3hzTENCN2RtRnNkV1U2SUhnc0lHTnlhWFJsY21saE9pQmpjbWwwWlhKcFlYMHBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0I5TENCbWRXNWpkR2x2YmlBb1pYSnlMQ0J5WlhOMWJIUnpLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnBaaUFvWlhKeUtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHTmhiR3hpWVdOcktHVnljaWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IyWVhJZ1ptNGdQU0JtZFc1amRHbHZiaUFvYkdWbWRDd2djbWxuYUhRcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZG1GeUlHRWdQU0JzWldaMExtTnlhWFJsY21saExDQmlJRDBnY21sbmFIUXVZM0pwZEdWeWFXRTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJoSUR3Z1lpQS9JQzB4SURvZ1lTQStJR0lnUHlBeElEb2dNRHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5TzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdOaGJHeGlZV05yS0c1MWJHd3NJRjl0WVhBb2NtVnpkV3gwY3k1emIzSjBLR1p1S1N3Z1puVnVZM1JwYjI0Z0tIZ3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUhndWRtRnNkV1U3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlNrcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCOUtUdGNiaUFnSUNCOU8xeHVYRzRnSUNBZ1lYTjVibU11WVhWMGJ5QTlJR1oxYm1OMGFXOXVJQ2gwWVhOcmN5d2dZMkZzYkdKaFkyc3BJSHRjYmlBZ0lDQWdJQ0FnWTJGc2JHSmhZMnNnUFNCallXeHNZbUZqYXlCOGZDQm1kVzVqZEdsdmJpQW9LU0I3ZlR0Y2JpQWdJQ0FnSUNBZ2RtRnlJR3RsZVhNZ1BTQmZhMlY1Y3loMFlYTnJjeWs3WEc0Z0lDQWdJQ0FnSUdsbUlDZ2hhMlY1Y3k1c1pXNW5kR2dwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmpZV3hzWW1GamF5aHVkV3hzS1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQWdJSFpoY2lCeVpYTjFiSFJ6SUQwZ2UzMDdYRzVjYmlBZ0lDQWdJQ0FnZG1GeUlHeHBjM1JsYm1WeWN5QTlJRnRkTzF4dUlDQWdJQ0FnSUNCMllYSWdZV1JrVEdsemRHVnVaWElnUFNCbWRXNWpkR2x2YmlBb1ptNHBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHeHBjM1JsYm1WeWN5NTFibk5vYVdaMEtHWnVLVHRjYmlBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUNBZ2RtRnlJSEpsYlc5MlpVeHBjM1JsYm1WeUlEMGdablZ1WTNScGIyNGdLR1p1S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JtYjNJZ0tIWmhjaUJwSUQwZ01Ec2dhU0E4SUd4cGMzUmxibVZ5Y3k1c1pXNW5kR2c3SUdrZ0t6MGdNU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaHNhWE4wWlc1bGNuTmJhVjBnUFQwOUlHWnVLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHeHBjM1JsYm1WeWN5NXpjR3hwWTJVb2FTd2dNU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5Ymp0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUgwN1hHNGdJQ0FnSUNBZ0lIWmhjaUIwWVhOclEyOXRjR3hsZEdVZ1BTQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmZaV0ZqYUNoc2FYTjBaVzVsY25NdWMyeHBZMlVvTUNrc0lHWjFibU4wYVc5dUlDaG1iaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdadUtDazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdmVHRjYmx4dUlDQWdJQ0FnSUNCaFpHUk1hWE4wWlc1bGNpaG1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnBaaUFvWDJ0bGVYTW9jbVZ6ZFd4MGN5a3ViR1Z1WjNSb0lEMDlQU0JyWlhsekxteGxibWQwYUNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHTmhiR3hpWVdOcktHNTFiR3dzSUhKbGMzVnNkSE1wTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdOaGJHeGlZV05ySUQwZ1puVnVZM1JwYjI0Z0tDa2dlMzA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSDBwTzF4dVhHNGdJQ0FnSUNBZ0lGOWxZV05vS0d0bGVYTXNJR1oxYm1OMGFXOXVJQ2hyS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0IyWVhJZ2RHRnpheUE5SUNoMFlYTnJjMXRyWFNCcGJuTjBZVzVqWlc5bUlFWjFibU4wYVc5dUtTQS9JRnQwWVhOcmMxdHJYVjA2SUhSaGMydHpXMnRkTzF4dUlDQWdJQ0FnSUNBZ0lDQWdkbUZ5SUhSaGMydERZV3hzWW1GamF5QTlJR1oxYm1OMGFXOXVJQ2hsY25JcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjJZWElnWVhKbmN5QTlJRUZ5Y21GNUxuQnliM1J2ZEhsd1pTNXpiR2xqWlM1allXeHNLR0Z5WjNWdFpXNTBjeXdnTVNrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLR0Z5WjNNdWJHVnVaM1JvSUR3OUlERXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1lYSm5jeUE5SUdGeVozTmJNRjA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaGxjbklwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdkbUZ5SUhOaFptVlNaWE4xYkhSeklEMGdlMzA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lGOWxZV05vS0Y5clpYbHpLSEpsYzNWc2RITXBMQ0JtZFc1amRHbHZiaWh5YTJWNUtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnpZV1psVW1WemRXeDBjMXR5YTJWNVhTQTlJSEpsYzNWc2RITmJjbXRsZVYwN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnpZV1psVW1WemRXeDBjMXRyWFNBOUlHRnlaM003WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHTmhiR3hpWVdOcktHVnljaXdnYzJGbVpWSmxjM1ZzZEhNcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0F2THlCemRHOXdJSE4xWW5ObGNYVmxiblFnWlhKeWIzSnpJR2hwZEhScGJtY2dZMkZzYkdKaFkyc2diWFZzZEdsd2JHVWdkR2x0WlhOY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZMkZzYkdKaFkyc2dQU0JtZFc1amRHbHZiaUFvS1NCN2ZUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsYzNWc2RITmJhMTBnUFNCaGNtZHpPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCaGMzbHVZeTV6WlhSSmJXMWxaR2xoZEdVb2RHRnphME52YlhCc1pYUmxLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2RtRnlJSEpsY1hWcGNtVnpJRDBnZEdGemF5NXpiR2xqWlNnd0xDQk5ZWFJvTG1GaWN5aDBZWE5yTG14bGJtZDBhQ0F0SURFcEtTQjhmQ0JiWFR0Y2JpQWdJQ0FnSUNBZ0lDQWdJSFpoY2lCeVpXRmtlU0E5SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1gzSmxaSFZqWlNoeVpYRjFhWEpsY3l3Z1puVnVZM1JwYjI0Z0tHRXNJSGdwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlDaGhJQ1ltSUhKbGMzVnNkSE11YUdGelQzZHVVSEp2Y0dWeWRIa29lQ2twTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwc0lIUnlkV1VwSUNZbUlDRnlaWE4xYkhSekxtaGhjMDkzYmxCeWIzQmxjblI1S0dzcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoeVpXRmtlU2dwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2RHRnphMXQwWVhOckxteGxibWQwYUNBdElERmRLSFJoYzJ0RFlXeHNZbUZqYXl3Z2NtVnpkV3gwY3lrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCMllYSWdiR2x6ZEdWdVpYSWdQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoeVpXRmtlU2dwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpXMXZkbVZNYVhOMFpXNWxjaWhzYVhOMFpXNWxjaWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IwWVhOclczUmhjMnN1YkdWdVozUm9JQzBnTVYwb2RHRnphME5oYkd4aVlXTnJMQ0J5WlhOMWJIUnpLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZV1JrVEdsemRHVnVaWElvYkdsemRHVnVaWElwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0I5TzF4dVhHNGdJQ0FnWVhONWJtTXVkMkYwWlhKbVlXeHNJRDBnWm5WdVkzUnBiMjRnS0hSaGMydHpMQ0JqWVd4c1ltRmpheWtnZTF4dUlDQWdJQ0FnSUNCallXeHNZbUZqYXlBOUlHTmhiR3hpWVdOcklIeDhJR1oxYm1OMGFXOXVJQ2dwSUh0OU8xeHVJQ0FnSUNBZ0lDQnBaaUFvZEdGemEzTXVZMjl1YzNSeWRXTjBiM0lnSVQwOUlFRnljbUY1S1NCN1hHNGdJQ0FnSUNBZ0lDQWdkbUZ5SUdWeWNpQTlJRzVsZHlCRmNuSnZjaWduUm1seWMzUWdZWEpuZFcxbGJuUWdkRzhnZDJGMFpYSm1ZV3hzSUcxMWMzUWdZbVVnWVc0Z1lYSnlZWGtnYjJZZ1puVnVZM1JwYjI1ekp5azdYRzRnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJR05oYkd4aVlXTnJLR1Z5Y2lrN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdhV1lnS0NGMFlYTnJjeTVzWlc1bmRHZ3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCallXeHNZbUZqYXlncE8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSFpoY2lCM2NtRndTWFJsY21GMGIzSWdQU0JtZFc1amRHbHZiaUFvYVhSbGNtRjBiM0lwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQm1kVzVqZEdsdmJpQW9aWEp5S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLR1Z5Y2lrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqWVd4c1ltRmpheTVoY0hCc2VTaHVkV3hzTENCaGNtZDFiV1Z1ZEhNcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqWVd4c1ltRmpheUE5SUdaMWJtTjBhVzl1SUNncElIdDlPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JsYkhObElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZG1GeUlHRnlaM01nUFNCQmNuSmhlUzV3Y205MGIzUjVjR1V1YzJ4cFkyVXVZMkZzYkNoaGNtZDFiV1Z1ZEhNc0lERXBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCMllYSWdibVY0ZENBOUlHbDBaWEpoZEc5eUxtNWxlSFFvS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0c1bGVIUXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR0Z5WjNNdWNIVnphQ2gzY21Gd1NYUmxjbUYwYjNJb2JtVjRkQ2twTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZWEpuY3k1d2RYTm9LR05oYkd4aVlXTnJLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JoYzNsdVl5NXpaWFJKYlcxbFpHbGhkR1VvWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FYUmxjbUYwYjNJdVlYQndiSGtvYm5Wc2JDd2dZWEpuY3lrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJSDA3WEc0Z0lDQWdJQ0FnSUgwN1hHNGdJQ0FnSUNBZ0lIZHlZWEJKZEdWeVlYUnZjaWhoYzNsdVl5NXBkR1Z5WVhSdmNpaDBZWE5yY3lrcEtDazdYRzRnSUNBZ2ZUdGNibHh1SUNBZ0lIWmhjaUJmY0dGeVlXeHNaV3dnUFNCbWRXNWpkR2x2YmlobFlXTm9abTRzSUhSaGMydHpMQ0JqWVd4c1ltRmpheWtnZTF4dUlDQWdJQ0FnSUNCallXeHNZbUZqYXlBOUlHTmhiR3hpWVdOcklIeDhJR1oxYm1OMGFXOXVJQ2dwSUh0OU8xeHVJQ0FnSUNBZ0lDQnBaaUFvZEdGemEzTXVZMjl1YzNSeWRXTjBiM0lnUFQwOUlFRnljbUY1S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JsWVdOb1ptNHViV0Z3S0hSaGMydHpMQ0JtZFc1amRHbHZiaUFvWm00c0lHTmhiR3hpWVdOcktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0dadUtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdadUtHWjFibU4wYVc5dUlDaGxjbklwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhaaGNpQmhjbWR6SUQwZ1FYSnlZWGt1Y0hKdmRHOTBlWEJsTG5Oc2FXTmxMbU5oYkd3b1lYSm5kVzFsYm5SekxDQXhLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoaGNtZHpMbXhsYm1kMGFDQThQU0F4S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZWEpuY3lBOUlHRnlaM05iTUYwN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCallXeHNZbUZqYXk1allXeHNLRzUxYkd3c0lHVnljaXdnWVhKbmN5azdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUgwc0lHTmhiR3hpWVdOcktUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0JsYkhObElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhaaGNpQnlaWE4xYkhSeklEMGdlMzA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmxZV05vWm00dVpXRmphQ2hmYTJWNWN5aDBZWE5yY3lrc0lHWjFibU4wYVc5dUlDaHJMQ0JqWVd4c1ltRmpheWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhSaGMydHpXMnRkS0daMWJtTjBhVzl1SUNobGNuSXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2RtRnlJR0Z5WjNNZ1BTQkJjbkpoZVM1d2NtOTBiM1I1Y0dVdWMyeHBZMlV1WTJGc2JDaGhjbWQxYldWdWRITXNJREVwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvWVhKbmN5NXNaVzVuZEdnZ1BEMGdNU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWVhKbmN5QTlJR0Z5WjNOYk1GMDdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVZ6ZFd4MGMxdHJYU0E5SUdGeVozTTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdOaGJHeGlZV05yS0dWeWNpazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlMQ0JtZFc1amRHbHZiaUFvWlhKeUtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZMkZzYkdKaFkyc29aWEp5TENCeVpYTjFiSFJ6S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnZlR0Y2JseHVJQ0FnSUdGemVXNWpMbkJoY21Gc2JHVnNJRDBnWm5WdVkzUnBiMjRnS0hSaGMydHpMQ0JqWVd4c1ltRmpheWtnZTF4dUlDQWdJQ0FnSUNCZmNHRnlZV3hzWld3b2V5QnRZWEE2SUdGemVXNWpMbTFoY0N3Z1pXRmphRG9nWVhONWJtTXVaV0ZqYUNCOUxDQjBZWE5yY3l3Z1kyRnNiR0poWTJzcE8xeHVJQ0FnSUgwN1hHNWNiaUFnSUNCaGMzbHVZeTV3WVhKaGJHeGxiRXhwYldsMElEMGdablZ1WTNScGIyNG9kR0Z6YTNNc0lHeHBiV2wwTENCallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQmZjR0Z5WVd4c1pXd29leUJ0WVhBNklGOXRZWEJNYVcxcGRDaHNhVzFwZENrc0lHVmhZMmc2SUY5bFlXTm9UR2x0YVhRb2JHbHRhWFFwSUgwc0lIUmhjMnR6TENCallXeHNZbUZqYXlrN1hHNGdJQ0FnZlR0Y2JseHVJQ0FnSUdGemVXNWpMbk5sY21sbGN5QTlJR1oxYm1OMGFXOXVJQ2gwWVhOcmN5d2dZMkZzYkdKaFkyc3BJSHRjYmlBZ0lDQWdJQ0FnWTJGc2JHSmhZMnNnUFNCallXeHNZbUZqYXlCOGZDQm1kVzVqZEdsdmJpQW9LU0I3ZlR0Y2JpQWdJQ0FnSUNBZ2FXWWdLSFJoYzJ0ekxtTnZibk4wY25WamRHOXlJRDA5UFNCQmNuSmhlU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdZWE41Ym1NdWJXRndVMlZ5YVdWektIUmhjMnR6TENCbWRXNWpkR2x2YmlBb1ptNHNJR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tHWnVLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHWnVLR1oxYm1OMGFXOXVJQ2hsY25JcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIWmhjaUJoY21keklEMGdRWEp5WVhrdWNISnZkRzkwZVhCbExuTnNhV05sTG1OaGJHd29ZWEpuZFcxbGJuUnpMQ0F4S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaGhjbWR6TG14bGJtZDBhQ0E4UFNBeEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWVhKbmN5QTlJR0Z5WjNOYk1GMDdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpZV3hzWW1GamF5NWpZV3hzS0c1MWJHd3NJR1Z5Y2l3Z1lYSm5jeWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lIMHNJR05oYkd4aVlXTnJLVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIWmhjaUJ5WlhOMWJIUnpJRDBnZTMwN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JoYzNsdVl5NWxZV05vVTJWeWFXVnpLRjlyWlhsektIUmhjMnR6S1N3Z1puVnVZM1JwYjI0Z0tHc3NJR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZEdGemEzTmJhMTBvWm5WdVkzUnBiMjRnS0dWeWNpa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCMllYSWdZWEpuY3lBOUlFRnljbUY1TG5CeWIzUnZkSGx3WlM1emJHbGpaUzVqWVd4c0tHRnlaM1Z0Wlc1MGN5d2dNU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2hoY21kekxteGxibWQwYUNBOFBTQXhLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JoY21keklEMGdZWEpuYzFzd1hUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWE4xYkhSelcydGRJRDBnWVhKbmN6dGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTJGc2JHSmhZMnNvWlhKeUtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMHNJR1oxYm1OMGFXOXVJQ2hsY25JcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpZV3hzWW1GamF5aGxjbklzSUhKbGMzVnNkSE1wTzF4dUlDQWdJQ0FnSUNBZ0lDQWdmU2s3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0I5TzF4dVhHNGdJQ0FnWVhONWJtTXVhWFJsY21GMGIzSWdQU0JtZFc1amRHbHZiaUFvZEdGemEzTXBJSHRjYmlBZ0lDQWdJQ0FnZG1GeUlHMWhhMlZEWVd4c1ltRmpheUE5SUdaMWJtTjBhVzl1SUNocGJtUmxlQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdkbUZ5SUdadUlEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaDBZWE5yY3k1c1pXNW5kR2dwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdkR0Z6YTNOYmFXNWtaWGhkTG1Gd2NHeDVLRzUxYkd3c0lHRnlaM1Z0Wlc1MGN5azdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQm1iaTV1WlhoMEtDazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOU8xeHVJQ0FnSUNBZ0lDQWdJQ0FnWm00dWJtVjRkQ0E5SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z0tHbHVaR1Y0SUR3Z2RHRnphM011YkdWdVozUm9JQzBnTVNrZ1B5QnRZV3RsUTJGc2JHSmhZMnNvYVc1a1pYZ2dLeUF4S1RvZ2JuVnNiRHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWm00N1hHNGdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQnRZV3RsUTJGc2JHSmhZMnNvTUNrN1hHNGdJQ0FnZlR0Y2JseHVJQ0FnSUdGemVXNWpMbUZ3Y0d4NUlEMGdablZ1WTNScGIyNGdLR1p1S1NCN1hHNGdJQ0FnSUNBZ0lIWmhjaUJoY21keklEMGdRWEp5WVhrdWNISnZkRzkwZVhCbExuTnNhV05sTG1OaGJHd29ZWEpuZFcxbGJuUnpMQ0F4S1R0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJtYmk1aGNIQnNlU2hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J1ZFd4c0xDQmhjbWR6TG1OdmJtTmhkQ2hCY25KaGVTNXdjbTkwYjNSNWNHVXVjMnhwWTJVdVkyRnNiQ2hoY21kMWJXVnVkSE1wS1Z4dUlDQWdJQ0FnSUNBZ0lDQWdLVHRjYmlBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0I5TzF4dVhHNGdJQ0FnZG1GeUlGOWpiMjVqWVhRZ1BTQm1kVzVqZEdsdmJpQW9aV0ZqYUdadUxDQmhjbklzSUdadUxDQmpZV3hzWW1GamF5a2dlMXh1SUNBZ0lDQWdJQ0IyWVhJZ2NpQTlJRnRkTzF4dUlDQWdJQ0FnSUNCbFlXTm9abTRvWVhKeUxDQm1kVzVqZEdsdmJpQW9lQ3dnWTJJcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdadUtIZ3NJR1oxYm1OMGFXOXVJQ2hsY25Jc0lIa3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5SUQwZ2NpNWpiMjVqWVhRb2VTQjhmQ0JiWFNrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1kySW9aWEp5S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnSUNCOUxDQm1kVzVqZEdsdmJpQW9aWEp5S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JqWVd4c1ltRmpheWhsY25Jc0lISXBPMXh1SUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0I5TzF4dUlDQWdJR0Z6ZVc1akxtTnZibU5oZENBOUlHUnZVR0Z5WVd4c1pXd29YMk52Ym1OaGRDazdYRzRnSUNBZ1lYTjVibU11WTI5dVkyRjBVMlZ5YVdWeklEMGdaRzlUWlhKcFpYTW9YMk52Ym1OaGRDazdYRzVjYmlBZ0lDQmhjM2x1WXk1M2FHbHNjM1FnUFNCbWRXNWpkR2x2YmlBb2RHVnpkQ3dnYVhSbGNtRjBiM0lzSUdOaGJHeGlZV05yS1NCN1hHNGdJQ0FnSUNBZ0lHbG1JQ2gwWlhOMEtDa3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHbDBaWEpoZEc5eUtHWjFibU4wYVc5dUlDaGxjbklwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCcFppQW9aWEp5S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmpZV3hzWW1GamF5aGxjbklwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCaGMzbHVZeTUzYUdsc2MzUW9kR1Z6ZEN3Z2FYUmxjbUYwYjNJc0lHTmhiR3hpWVdOcktUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnWTJGc2JHSmhZMnNvS1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUgwN1hHNWNiaUFnSUNCaGMzbHVZeTVrYjFkb2FXeHpkQ0E5SUdaMWJtTjBhVzl1SUNocGRHVnlZWFJ2Y2l3Z2RHVnpkQ3dnWTJGc2JHSmhZMnNwSUh0Y2JpQWdJQ0FnSUNBZ2FYUmxjbUYwYjNJb1puVnVZM1JwYjI0Z0tHVnljaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdhV1lnS0dWeWNpa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmpZV3hzWW1GamF5aGxjbklwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLSFJsYzNRb0tTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR0Z6ZVc1akxtUnZWMmhwYkhOMEtHbDBaWEpoZEc5eUxDQjBaWE4wTENCallXeHNZbUZqYXlrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCallXeHNZbUZqYXlncE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCOUtUdGNiaUFnSUNCOU8xeHVYRzRnSUNBZ1lYTjVibU11ZFc1MGFXd2dQU0JtZFc1amRHbHZiaUFvZEdWemRDd2dhWFJsY21GMGIzSXNJR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdJQ0FnSUdsbUlDZ2hkR1Z6ZENncEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCcGRHVnlZWFJ2Y2lobWRXNWpkR2x2YmlBb1pYSnlLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tHVnljaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1kyRnNiR0poWTJzb1pYSnlLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWVhONWJtTXVkVzUwYVd3b2RHVnpkQ3dnYVhSbGNtRjBiM0lzSUdOaGJHeGlZV05yS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdZMkZzYkdKaFkyc29LVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJSDA3WEc1Y2JpQWdJQ0JoYzNsdVl5NWtiMVZ1ZEdsc0lEMGdablZ1WTNScGIyNGdLR2wwWlhKaGRHOXlMQ0IwWlhOMExDQmpZV3hzWW1GamF5a2dlMXh1SUNBZ0lDQWdJQ0JwZEdWeVlYUnZjaWhtZFc1amRHbHZiaUFvWlhKeUtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCcFppQW9aWEp5S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUdOaGJHeGlZV05yS0dWeWNpazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb0lYUmxjM1FvS1NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHRnplVzVqTG1SdlZXNTBhV3dvYVhSbGNtRjBiM0lzSUhSbGMzUXNJR05oYkd4aVlXTnJLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR05oYkd4aVlXTnJLQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJSDA3WEc1Y2JpQWdJQ0JoYzNsdVl5NXhkV1YxWlNBOUlHWjFibU4wYVc5dUlDaDNiM0pyWlhJc0lHTnZibU4xY25KbGJtTjVLU0I3WEc0Z0lDQWdJQ0FnSUdsbUlDaGpiMjVqZFhKeVpXNWplU0E5UFQwZ2RXNWtaV1pwYm1Wa0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCamIyNWpkWEp5Wlc1amVTQTlJREU3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ1puVnVZM1JwYjI0Z1gybHVjMlZ5ZENoeExDQmtZWFJoTENCd2IzTXNJR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2FXWW9aR0YwWVM1amIyNXpkSEoxWTNSdmNpQWhQVDBnUVhKeVlYa3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdaR0YwWVNBOUlGdGtZWFJoWFR0Y2JpQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnWDJWaFkyZ29aR0YwWVN3Z1puVnVZM1JwYjI0b2RHRnpheWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0IyWVhJZ2FYUmxiU0E5SUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHUmhkR0U2SUhSaGMyc3NYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqWVd4c1ltRmphem9nZEhsd1pXOW1JR05oYkd4aVlXTnJJRDA5UFNBblpuVnVZM1JwYjI0bklEOGdZMkZzYkdKaFkyc2dPaUJ1ZFd4c1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUgwN1hHNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLSEJ2Y3lrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIRXVkR0Z6YTNNdWRXNXphR2xtZENocGRHVnRLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnhMblJoYzJ0ekxuQjFjMmdvYVhSbGJTazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNibHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvY1M1ellYUjFjbUYwWldRZ0ppWWdjUzUwWVhOcmN5NXNaVzVuZEdnZ1BUMDlJR052Ym1OMWNuSmxibU41S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnhMbk5oZEhWeVlYUmxaQ2dwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJR0Z6ZVc1akxuTmxkRWx0YldWa2FXRjBaU2h4TG5CeWIyTmxjM01wTzF4dUlDQWdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUNBZ2RtRnlJSGR2Y210bGNuTWdQU0F3TzF4dUlDQWdJQ0FnSUNCMllYSWdjU0E5SUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJSFJoYzJ0ek9pQmJYU3hjYmlBZ0lDQWdJQ0FnSUNBZ0lHTnZibU4xY25KbGJtTjVPaUJqYjI1amRYSnlaVzVqZVN4Y2JpQWdJQ0FnSUNBZ0lDQWdJSE5oZEhWeVlYUmxaRG9nYm5Wc2JDeGNiaUFnSUNBZ0lDQWdJQ0FnSUdWdGNIUjVPaUJ1ZFd4c0xGeHVJQ0FnSUNBZ0lDQWdJQ0FnWkhKaGFXNDZJRzUxYkd3c1hHNGdJQ0FnSUNBZ0lDQWdJQ0J3ZFhOb09pQm1kVzVqZEdsdmJpQW9aR0YwWVN3Z1kyRnNiR0poWTJzcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ1gybHVjMlZ5ZENoeExDQmtZWFJoTENCbVlXeHpaU3dnWTJGc2JHSmhZMnNwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdmU3hjYmlBZ0lDQWdJQ0FnSUNBZ0lIVnVjMmhwWm5RNklHWjFibU4wYVc5dUlDaGtZWFJoTENCallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCZmFXNXpaWEowS0hFc0lHUmhkR0VzSUhSeWRXVXNJR05oYkd4aVlXTnJLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMHNYRzRnSUNBZ0lDQWdJQ0FnSUNCd2NtOWpaWE56T2lCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0hkdmNtdGxjbk1nUENCeExtTnZibU4xY25KbGJtTjVJQ1ltSUhFdWRHRnphM011YkdWdVozUm9LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIWmhjaUIwWVhOcklEMGdjUzUwWVhOcmN5NXphR2xtZENncE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb2NTNWxiWEIwZVNBbUppQnhMblJoYzJ0ekxteGxibWQwYUNBOVBUMGdNQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY1M1bGJYQjBlU2dwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhkdmNtdGxjbk1nS3owZ01UdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZG1GeUlHNWxlSFFnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjNiM0pyWlhKeklDMDlJREU3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb2RHRnpheTVqWVd4c1ltRmpheWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIUmhjMnN1WTJGc2JHSmhZMnN1WVhCd2JIa29kR0Z6YXl3Z1lYSm5kVzFsYm5SektUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2h4TG1SeVlXbHVJQ1ltSUhFdWRHRnphM011YkdWdVozUm9JQ3NnZDI5eWEyVnljeUE5UFQwZ01Da2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhFdVpISmhhVzRvS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhFdWNISnZZMlZ6Y3lncE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5TzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjJZWElnWTJJZ1BTQnZibXg1WDI5dVkyVW9ibVY0ZENrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSGR2Y210bGNpaDBZWE5yTG1SaGRHRXNJR05pS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0I5TEZ4dUlDQWdJQ0FnSUNBZ0lDQWdiR1Z1WjNSb09pQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJSEV1ZEdGemEzTXViR1Z1WjNSb08xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlN4Y2JpQWdJQ0FnSUNBZ0lDQWdJSEoxYm01cGJtYzZJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnZDI5eWEyVnljenRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdmVHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJSEU3WEc0Z0lDQWdmVHRjYmx4dUlDQWdJR0Z6ZVc1akxtTmhjbWR2SUQwZ1puVnVZM1JwYjI0Z0tIZHZjbXRsY2l3Z2NHRjViRzloWkNrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnZDI5eWEybHVaeUFnSUNBZ1BTQm1ZV3h6WlN4Y2JpQWdJQ0FnSUNBZ0lDQWdJSFJoYzJ0eklDQWdJQ0FnSUQwZ1cxMDdYRzVjYmlBZ0lDQWdJQ0FnZG1GeUlHTmhjbWR2SUQwZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnZEdGemEzTTZJSFJoYzJ0ekxGeHVJQ0FnSUNBZ0lDQWdJQ0FnY0dGNWJHOWhaRG9nY0dGNWJHOWhaQ3hjYmlBZ0lDQWdJQ0FnSUNBZ0lITmhkSFZ5WVhSbFpEb2diblZzYkN4Y2JpQWdJQ0FnSUNBZ0lDQWdJR1Z0Y0hSNU9pQnVkV3hzTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdaSEpoYVc0NklHNTFiR3dzWEc0Z0lDQWdJQ0FnSUNBZ0lDQndkWE5vT2lCbWRXNWpkR2x2YmlBb1pHRjBZU3dnWTJGc2JHSmhZMnNwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCcFppaGtZWFJoTG1OdmJuTjBjblZqZEc5eUlDRTlQU0JCY25KaGVTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCa1lYUmhJRDBnVzJSaGRHRmRPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JmWldGamFDaGtZWFJoTENCbWRXNWpkR2x2YmloMFlYTnJLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIUmhjMnR6TG5CMWMyZ29lMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdaR0YwWVRvZ2RHRnpheXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR05oYkd4aVlXTnJPaUIwZVhCbGIyWWdZMkZzYkdKaFkyc2dQVDA5SUNkbWRXNWpkR2x2YmljZ1B5QmpZV3hzWW1GamF5QTZJRzUxYkd4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2hqWVhKbmJ5NXpZWFIxY21GMFpXUWdKaVlnZEdGemEzTXViR1Z1WjNSb0lEMDlQU0J3WVhsc2IyRmtLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqWVhKbmJ5NXpZWFIxY21GMFpXUW9LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR0Z6ZVc1akxuTmxkRWx0YldWa2FXRjBaU2hqWVhKbmJ5NXdjbTlqWlhOektUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgwc1hHNGdJQ0FnSUNBZ0lDQWdJQ0J3Y205alpYTnpPaUJtZFc1amRHbHZiaUJ3Y205alpYTnpLQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaDNiM0pyYVc1bktTQnlaWFIxY200N1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLSFJoYzJ0ekxteGxibWQwYUNBOVBUMGdNQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaWhqWVhKbmJ5NWtjbUZwYmlrZ1kyRnlaMjh1WkhKaGFXNG9LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1TzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIWmhjaUIwY3lBOUlIUjVjR1Z2WmlCd1lYbHNiMkZrSUQwOVBTQW5iblZ0WW1WeUoxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRDhnZEdGemEzTXVjM0JzYVdObEtEQXNJSEJoZVd4dllXUXBYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnT2lCMFlYTnJjeTV6Y0d4cFkyVW9NQ2s3WEc1Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCMllYSWdaSE1nUFNCZmJXRndLSFJ6TENCbWRXNWpkR2x2YmlBb2RHRnpheWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2RHRnpheTVrWVhSaE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHBPMXh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYVdZb1kyRnlaMjh1Wlcxd2RIa3BJR05oY21kdkxtVnRjSFI1S0NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2QyOXlhMmx1WnlBOUlIUnlkV1U3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZDI5eWEyVnlLR1J6TENCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhkdmNtdHBibWNnUFNCbVlXeHpaVHRjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjJZWElnWVhKbmN5QTlJR0Z5WjNWdFpXNTBjenRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1gyVmhZMmdvZEhNc0lHWjFibU4wYVc5dUlDaGtZWFJoS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCcFppQW9aR0YwWVM1allXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1JoZEdFdVkyRnNiR0poWTJzdVlYQndiSGtvYm5Wc2JDd2dZWEpuY3lrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBwTzF4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEJ5YjJObGMzTW9LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDBzWEc0Z0lDQWdJQ0FnSUNBZ0lDQnNaVzVuZEdnNklHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdkR0Z6YTNNdWJHVnVaM1JvTzF4dUlDQWdJQ0FnSUNBZ0lDQWdmU3hjYmlBZ0lDQWdJQ0FnSUNBZ0lISjFibTVwYm1jNklHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdkMjl5YTJsdVp6dGNiaUFnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZUdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHTmhjbWR2TzF4dUlDQWdJSDA3WEc1Y2JpQWdJQ0IyWVhJZ1gyTnZibk52YkdWZlptNGdQU0JtZFc1amRHbHZiaUFvYm1GdFpTa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdablZ1WTNScGIyNGdLR1p1S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0IyWVhJZ1lYSm5jeUE5SUVGeWNtRjVMbkJ5YjNSdmRIbHdaUzV6YkdsalpTNWpZV3hzS0dGeVozVnRaVzUwY3l3Z01TazdYRzRnSUNBZ0lDQWdJQ0FnSUNCbWJpNWhjSEJzZVNodWRXeHNMQ0JoY21kekxtTnZibU5oZENoYlpuVnVZM1JwYjI0Z0tHVnljaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhaaGNpQmhjbWR6SUQwZ1FYSnlZWGt1Y0hKdmRHOTBlWEJsTG5Oc2FXTmxMbU5oYkd3b1lYSm5kVzFsYm5SekxDQXhLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb2RIbHdaVzltSUdOdmJuTnZiR1VnSVQwOUlDZDFibVJsWm1sdVpXUW5LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2hsY25JcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2hqYjI1emIyeGxMbVZ5Y205eUtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5dWMyOXNaUzVsY25KdmNpaGxjbklwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdWc2MyVWdhV1lnS0dOdmJuTnZiR1ZiYm1GdFpWMHBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRjlsWVdOb0tHRnlaM01zSUdaMWJtTjBhVzl1SUNoNEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5dWMyOXNaVnR1WVcxbFhTaDRLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ2ZWMHBLVHRjYmlBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0I5TzF4dUlDQWdJR0Z6ZVc1akxteHZaeUE5SUY5amIyNXpiMnhsWDJadUtDZHNiMmNuS1R0Y2JpQWdJQ0JoYzNsdVl5NWthWElnUFNCZlkyOXVjMjlzWlY5bWJpZ25aR2x5SnlrN1hHNGdJQ0FnTHlwaGMzbHVZeTVwYm1adklEMGdYMk52Ym5OdmJHVmZabTRvSjJsdVptOG5LVHRjYmlBZ0lDQmhjM2x1WXk1M1lYSnVJRDBnWDJOdmJuTnZiR1ZmWm00b0ozZGhjbTRuS1R0Y2JpQWdJQ0JoYzNsdVl5NWxjbkp2Y2lBOUlGOWpiMjV6YjJ4bFgyWnVLQ2RsY25KdmNpY3BPeW92WEc1Y2JpQWdJQ0JoYzNsdVl5NXRaVzF2YVhwbElEMGdablZ1WTNScGIyNGdLR1p1TENCb1lYTm9aWElwSUh0Y2JpQWdJQ0FnSUNBZ2RtRnlJRzFsYlc4Z1BTQjdmVHRjYmlBZ0lDQWdJQ0FnZG1GeUlIRjFaWFZsY3lBOUlIdDlPMXh1SUNBZ0lDQWdJQ0JvWVhOb1pYSWdQU0JvWVhOb1pYSWdmSHdnWm5WdVkzUnBiMjRnS0hncElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUI0TzF4dUlDQWdJQ0FnSUNCOU8xeHVJQ0FnSUNBZ0lDQjJZWElnYldWdGIybDZaV1FnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCMllYSWdZWEpuY3lBOUlFRnljbUY1TG5CeWIzUnZkSGx3WlM1emJHbGpaUzVqWVd4c0tHRnlaM1Z0Wlc1MGN5azdYRzRnSUNBZ0lDQWdJQ0FnSUNCMllYSWdZMkZzYkdKaFkyc2dQU0JoY21kekxuQnZjQ2dwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdkbUZ5SUd0bGVTQTlJR2hoYzJobGNpNWhjSEJzZVNodWRXeHNMQ0JoY21kektUdGNiaUFnSUNBZ0lDQWdJQ0FnSUdsbUlDaHJaWGtnYVc0Z2JXVnRieWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdOaGJHeGlZV05yTG1Gd2NHeDVLRzUxYkd3c0lHMWxiVzliYTJWNVhTazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0JsYkhObElHbG1JQ2hyWlhrZ2FXNGdjWFZsZFdWektTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjWFZsZFdWelcydGxlVjB1Y0hWemFDaGpZV3hzWW1GamF5azdYRzRnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0JsYkhObElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnhkV1YxWlhOYmEyVjVYU0E5SUZ0allXeHNZbUZqYTEwN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1ptNHVZWEJ3Ykhrb2JuVnNiQ3dnWVhKbmN5NWpiMjVqWVhRb1cyWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXVnRiMXRyWlhsZElEMGdZWEpuZFcxbGJuUnpPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCMllYSWdjU0E5SUhGMVpYVmxjMXRyWlhsZE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JrWld4bGRHVWdjWFZsZFdWelcydGxlVjA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3TENCc0lEMGdjUzVzWlc1bmRHZzdJR2tnUENCc095QnBLeXNwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J4VzJsZExtRndjR3g1S0c1MWJHd3NJR0Z5WjNWdFpXNTBjeWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYU2twTzF4dUlDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0I5TzF4dUlDQWdJQ0FnSUNCdFpXMXZhWHBsWkM1dFpXMXZJRDBnYldWdGJ6dGNiaUFnSUNBZ0lDQWdiV1Z0YjJsNlpXUXVkVzV0WlcxdmFYcGxaQ0E5SUdadU8xeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2JXVnRiMmw2WldRN1hHNGdJQ0FnZlR0Y2JseHVJQ0FnSUdGemVXNWpMblZ1YldWdGIybDZaU0E5SUdaMWJtTjBhVzl1SUNobWJpa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJQ2htYmk1MWJtMWxiVzlwZW1Wa0lIeDhJR1p1S1M1aGNIQnNlU2h1ZFd4c0xDQmhjbWQxYldWdWRITXBPMXh1SUNBZ0lDQWdmVHRjYmlBZ0lDQjlPMXh1WEc0Z0lDQWdZWE41Ym1NdWRHbHRaWE1nUFNCbWRXNWpkR2x2YmlBb1kyOTFiblFzSUdsMFpYSmhkRzl5TENCallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnWTI5MWJuUmxjaUE5SUZ0ZE8xeHVJQ0FnSUNBZ0lDQm1iM0lnS0haaGNpQnBJRDBnTURzZ2FTQThJR052ZFc1ME95QnBLeXNwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR052ZFc1MFpYSXVjSFZ6YUNocEtUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdZWE41Ym1NdWJXRndLR052ZFc1MFpYSXNJR2wwWlhKaGRHOXlMQ0JqWVd4c1ltRmpheWs3WEc0Z0lDQWdmVHRjYmx4dUlDQWdJR0Z6ZVc1akxuUnBiV1Z6VTJWeWFXVnpJRDBnWm5WdVkzUnBiMjRnS0dOdmRXNTBMQ0JwZEdWeVlYUnZjaXdnWTJGc2JHSmhZMnNwSUh0Y2JpQWdJQ0FnSUNBZ2RtRnlJR052ZFc1MFpYSWdQU0JiWFR0Y2JpQWdJQ0FnSUNBZ1ptOXlJQ2gyWVhJZ2FTQTlJREE3SUdrZ1BDQmpiM1Z1ZERzZ2FTc3JLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmpiM1Z1ZEdWeUxuQjFjMmdvYVNrN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHRnplVzVqTG0xaGNGTmxjbWxsY3loamIzVnVkR1Z5TENCcGRHVnlZWFJ2Y2l3Z1kyRnNiR0poWTJzcE8xeHVJQ0FnSUgwN1hHNWNiaUFnSUNCaGMzbHVZeTVqYjIxd2IzTmxJRDBnWm5WdVkzUnBiMjRnS0M4cUlHWjFibU4wYVc5dWN5NHVMaUFxTHlrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnWm01eklEMGdRWEp5WVhrdWNISnZkRzkwZVhCbExuSmxkbVZ5YzJVdVkyRnNiQ2hoY21kMWJXVnVkSE1wTzF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnZG1GeUlIUm9ZWFFnUFNCMGFHbHpPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2RtRnlJR0Z5WjNNZ1BTQkJjbkpoZVM1d2NtOTBiM1I1Y0dVdWMyeHBZMlV1WTJGc2JDaGhjbWQxYldWdWRITXBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2RtRnlJR05oYkd4aVlXTnJJRDBnWVhKbmN5NXdiM0FvS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJR0Z6ZVc1akxuSmxaSFZqWlNobWJuTXNJR0Z5WjNNc0lHWjFibU4wYVc5dUlDaHVaWGRoY21kekxDQm1iaXdnWTJJcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQm1iaTVoY0hCc2VTaDBhR0YwTENCdVpYZGhjbWR6TG1OdmJtTmhkQ2hiWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IyWVhJZ1pYSnlJRDBnWVhKbmRXMWxiblJ6V3pCZE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IyWVhJZ2JtVjRkR0Z5WjNNZ1BTQkJjbkpoZVM1d2NtOTBiM1I1Y0dVdWMyeHBZMlV1WTJGc2JDaGhjbWQxYldWdWRITXNJREVwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpZaWhsY25Jc0lHNWxlSFJoY21kektUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYU2twWEc0Z0lDQWdJQ0FnSUNBZ0lDQjlMRnh1SUNBZ0lDQWdJQ0FnSUNBZ1puVnVZM1JwYjI0Z0tHVnljaXdnY21WemRXeDBjeWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdOaGJHeGlZV05yTG1Gd2NHeDVLSFJvWVhRc0lGdGxjbkpkTG1OdmJtTmhkQ2h5WlhOMWJIUnpLU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0I5TzF4dVhHNGdJQ0FnZG1GeUlGOWhjSEJzZVVWaFkyZ2dQU0JtZFc1amRHbHZiaUFvWldGamFHWnVMQ0JtYm5NZ0x5cGhjbWR6TGk0dUtpOHBJSHRjYmlBZ0lDQWdJQ0FnZG1GeUlHZHZJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnZG1GeUlIUm9ZWFFnUFNCMGFHbHpPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2RtRnlJR0Z5WjNNZ1BTQkJjbkpoZVM1d2NtOTBiM1I1Y0dVdWMyeHBZMlV1WTJGc2JDaGhjbWQxYldWdWRITXBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2RtRnlJR05oYkd4aVlXTnJJRDBnWVhKbmN5NXdiM0FvS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmxZV05vWm00b1ptNXpMQ0JtZFc1amRHbHZiaUFvWm00c0lHTmlLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWm00dVlYQndiSGtvZEdoaGRDd2dZWEpuY3k1amIyNWpZWFFvVzJOaVhTa3BPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2ZTeGNiaUFnSUNBZ0lDQWdJQ0FnSUdOaGJHeGlZV05yS1R0Y2JpQWdJQ0FnSUNBZ2ZUdGNiaUFnSUNBZ0lDQWdhV1lnS0dGeVozVnRaVzUwY3k1c1pXNW5kR2dnUGlBeUtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCMllYSWdZWEpuY3lBOUlFRnljbUY1TG5CeWIzUnZkSGx3WlM1emJHbGpaUzVqWVd4c0tHRnlaM1Z0Wlc1MGN5d2dNaWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1oyOHVZWEJ3Ykhrb2RHaHBjeXdnWVhKbmN5azdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnWld4elpTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWjI4N1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNCOU8xeHVJQ0FnSUdGemVXNWpMbUZ3Y0d4NVJXRmphQ0E5SUdSdlVHRnlZV3hzWld3b1gyRndjR3g1UldGamFDazdYRzRnSUNBZ1lYTjVibU11WVhCd2JIbEZZV05vVTJWeWFXVnpJRDBnWkc5VFpYSnBaWE1vWDJGd2NHeDVSV0ZqYUNrN1hHNWNiaUFnSUNCaGMzbHVZeTVtYjNKbGRtVnlJRDBnWm5WdVkzUnBiMjRnS0dadUxDQmpZV3hzWW1GamF5a2dlMXh1SUNBZ0lDQWdJQ0JtZFc1amRHbHZiaUJ1WlhoMEtHVnljaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdhV1lnS0dWeWNpa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdZMkZzYkdKaFkyc29aWEp5S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2RHaHliM2NnWlhKeU8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdabTRvYm1WNGRDazdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnYm1WNGRDZ3BPMXh1SUNBZ0lIMDdYRzVjYmlBZ0lDQXZMeUJCVFVRZ0x5QlNaWEYxYVhKbFNsTmNiaUFnSUNCcFppQW9kSGx3Wlc5bUlHUmxabWx1WlNBaFBUMGdKM1Z1WkdWbWFXNWxaQ2NnSmlZZ1pHVm1hVzVsTG1GdFpDa2dlMXh1SUNBZ0lDQWdJQ0JrWldacGJtVW9XMTBzSUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJoYzNsdVl6dGNiaUFnSUNBZ0lDQWdmU2s3WEc0Z0lDQWdmVnh1SUNBZ0lDOHZJRTV2WkdVdWFuTmNiaUFnSUNCbGJITmxJR2xtSUNoMGVYQmxiMllnYlc5a2RXeGxJQ0U5UFNBbmRXNWtaV1pwYm1Wa0p5QW1KaUJ0YjJSMWJHVXVaWGh3YjNKMGN5a2dlMXh1SUNBZ0lDQWdJQ0J0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR0Z6ZVc1ak8xeHVJQ0FnSUgxY2JpQWdJQ0F2THlCcGJtTnNkV1JsWkNCa2FYSmxZM1JzZVNCMmFXRWdQSE5qY21sd2RENGdkR0ZuWEc0Z0lDQWdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lISnZiM1F1WVhONWJtTWdQU0JoYzNsdVl6dGNiaUFnSUNCOVhHNWNibjBvS1NrN1hHNGlYWDA9IixudWxsLCIndXNlIHN0cmljdCc7XG5cbnZhciBfY3JlYXRlQ2xhc3MgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldOyBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7IGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTsgaWYgKCd2YWx1ZScgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0pKCk7XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG52YXIgcGlja09uZUJ5V2VpZ2h0ID0gcmVxdWlyZSgncGljay1vbmUtYnktd2VpZ2h0Jyk7XG5cbnZhciBpc1R5cGUgPSBmdW5jdGlvbiBpc1R5cGUodCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHQpLnNsaWNlKDgsIC0xKS50b0xvd2VyQ2FzZSgpO1xufTtcblxudmFyIE1hcmtvdkNoYWluID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gTWFya292Q2hhaW4oY29udGVudHMpIHtcbiAgICB2YXIgbm9ybUZuID0gYXJndW1lbnRzLmxlbmd0aCA8PSAxIHx8IGFyZ3VtZW50c1sxXSA9PT0gdW5kZWZpbmVkID8gZnVuY3Rpb24gKHdvcmQpIHtcbiAgICAgIHJldHVybiB3b3JkLnJlcGxhY2UoL1xcLiQvaWcsICcnKTtcbiAgICB9IDogYXJndW1lbnRzWzFdO1xuXG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIE1hcmtvdkNoYWluKTtcblxuICAgIHRoaXMud29yZEJhbmsgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIHRoaXMuc2VudGVuY2UgPSAnJztcbiAgICB0aGlzLl9ub3JtYWxpemVGbiA9IG5vcm1GbjtcbiAgICB0aGlzLnBhcnNlQnkgPSAvKD86XFwufFxcP3xcXG4pL2lnO1xuICAgIHRoaXMucGFyc2UoY29udGVudHMpO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKE1hcmtvdkNoYWluLCBbe1xuICAgIGtleTogJ3N0YXJ0Rm4nLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBzdGFydEZuKHdvcmRMaXN0KSB7XG4gICAgICB2YXIgayA9IE9iamVjdC5rZXlzKHdvcmRMaXN0KTtcbiAgICAgIHZhciBsID0gay5sZW5ndGg7XG4gICAgICByZXR1cm4ga1t+IH4oTWF0aC5yYW5kb20oKSAqIGwpXTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdlbmRGbicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGVuZEZuKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc2VudGVuY2Uuc3BsaXQoJyAnKS5sZW5ndGggPiA3O1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3Byb2Nlc3MnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBwcm9jZXNzKCkge1xuICAgICAgdmFyIGN1cldvcmQgPSB0aGlzLnN0YXJ0Rm4odGhpcy53b3JkQmFuayk7XG4gICAgICB0aGlzLnNlbnRlbmNlID0gY3VyV29yZDtcbiAgICAgIHdoaWxlICh0aGlzLndvcmRCYW5rW2N1cldvcmRdICYmICF0aGlzLmVuZEZuKCkpIHtcbiAgICAgICAgY3VyV29yZCA9IHBpY2tPbmVCeVdlaWdodCh0aGlzLndvcmRCYW5rW2N1cldvcmRdKTtcbiAgICAgICAgdGhpcy5zZW50ZW5jZSArPSAnICcgKyBjdXJXb3JkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc2VudGVuY2U7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncGFyc2UnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBwYXJzZSgpIHtcbiAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAgIHZhciB0ZXh0ID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8gJycgOiBhcmd1bWVudHNbMF07XG4gICAgICB2YXIgcGFyc2VCeSA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMSB8fCBhcmd1bWVudHNbMV0gPT09IHVuZGVmaW5lZCA/IHRoaXMucGFyc2VCeSA6IGFyZ3VtZW50c1sxXTtcblxuICAgICAgdGV4dC5zcGxpdChwYXJzZUJ5KS5mb3JFYWNoKGZ1bmN0aW9uIChsaW5lcykge1xuICAgICAgICB2YXIgd29yZHMgPSBsaW5lcy5zcGxpdCgnICcpLmZpbHRlcihmdW5jdGlvbiAodykge1xuICAgICAgICAgIHJldHVybiB3LnRyaW0oKSAhPT0gJyc7XG4gICAgICAgIH0pO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHdvcmRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgIHZhciBjdXJXb3JkID0gX3RoaXMuX25vcm1hbGl6ZSh3b3Jkc1tpXSk7XG4gICAgICAgICAgdmFyIG5leHRXb3JkID0gX3RoaXMuX25vcm1hbGl6ZSh3b3Jkc1tpICsgMV0pO1xuXG4gICAgICAgICAgaWYgKCFfdGhpcy53b3JkQmFua1tjdXJXb3JkXSkge1xuICAgICAgICAgICAgX3RoaXMud29yZEJhbmtbY3VyV29yZF0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIV90aGlzLndvcmRCYW5rW2N1cldvcmRdW25leHRXb3JkXSkge1xuICAgICAgICAgICAgX3RoaXMud29yZEJhbmtbY3VyV29yZF1bbmV4dFdvcmRdID0gMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX3RoaXMud29yZEJhbmtbY3VyV29yZF1bbmV4dFdvcmRdICs9IDE7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3N0YXJ0JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gc3RhcnQoZm5TdHIpIHtcbiAgICAgIHZhciBzdGFydFR5cGUgPSBpc1R5cGUoZm5TdHIpO1xuICAgICAgaWYgKHN0YXJ0VHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5zdGFydEZuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBmblN0cjtcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhcnRUeXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXMuc3RhcnRGbiA9IGZ1bmN0aW9uICh3b3JkTGlzdCkge1xuICAgICAgICAgIHJldHVybiBmblN0cih3b3JkTGlzdCk7XG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ011c3QgcGFzcyBhIGZ1bmN0aW9uLCBvciBzdHJpbmcgaW50byBzdGFydCgpJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdlbmQnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBlbmQoZm5TdHJPck51bSkge1xuICAgICAgdmFyIF90aGlzMiA9IHRoaXM7XG5cbiAgICAgIHZhciBlbmRUeXBlID0gaXNUeXBlKGZuU3RyT3JOdW0pO1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICBpZiAoZW5kVHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLmVuZEZuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBmblN0ck9yTnVtKF90aGlzMi5zZW50ZW5jZSk7XG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKGVuZFR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuZW5kRm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzMi5zZW50ZW5jZS5zcGxpdCgnICcpLnNsaWNlKC0xKVswXSA9PT0gZm5TdHJPck51bTtcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAoZW5kVHlwZSA9PT0gJ251bWJlcicgfHwgZm5TdHJPck51bSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGZuU3RyT3JOdW0gPSBmblN0ck9yTnVtIHx8IEluZmluaXR5O1xuICAgICAgICB0aGlzLmVuZEZuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBzZWxmLnNlbnRlbmNlLnNwbGl0KCcgJykubGVuZ3RoID4gZm5TdHJPck51bTtcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTXVzdCBwYXNzIGEgZnVuY3Rpb24sIHN0cmluZyBvciBudW1iZXIgaW50byBlbmQoKScpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnX25vcm1hbGl6ZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9ub3JtYWxpemUod29yZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX25vcm1hbGl6ZUZuKHdvcmQpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ25vcm1hbGl6ZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIG5vcm1hbGl6ZShmbikge1xuICAgICAgdGhpcy5fbm9ybWFsaXplRm4gPSBmbjtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfV0sIFt7XG4gICAga2V5OiAnVkVSU0lPTicsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmVxdWlyZSgnLi4vcGFja2FnZScpLnZlcnNpb247XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnTWFya292Q2hhaW4nLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgLy8gbG9hZCBvbGRlciBNYXJrb3ZDaGFpblxuICAgICAgcmV0dXJuIHJlcXVpcmUoJy4uL29sZGVyL2luZGV4LmpzJykuTWFya292Q2hhaW47XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIE1hcmtvdkNoYWluO1xufSkoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBNYXJrb3ZDaGFpbjsiLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgYXN5bmMgPSByZXF1aXJlKCdhc3luYycpXG4gICwgZnMgPSByZXF1aXJlKCdmcycpXG4gICwgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKVxuICAsIHBpY2tPbmVCeVdlaWdodCA9IHJlcXVpcmUoJ3BpY2stb25lLWJ5LXdlaWdodCcpXG4gICwgaXNUeXBlXG4gICwga2luZGFGaWxlXG4gICwgTWFya292Q2hhaW5cblxuaXNUeXBlID0gZnVuY3Rpb24odCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHQpLnNsaWNlKDgsIC0xKS50b0xvd2VyQ2FzZSgpXG59XG5cbmtpbmRhRmlsZSA9IGZ1bmN0aW9uKGZpbGUpIHtcbiAgcmV0dXJuIGZpbGUuaW5kZXhPZignLicgKyBwYXRoLnNlcCkgPT09IDAgfHwgZmlsZS5pbmRleE9mKHBhdGguc2VwKSA9PT0gMFxufVxuXG5NYXJrb3ZDaGFpbiA9IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgaWYgKCFhcmdzKSB7IGFyZ3MgPSB7fSB9XG4gIHRoaXMud29yZEJhbmsgPSB7fVxuICB0aGlzLnNlbnRlbmNlID0gJydcbiAgdGhpcy5maWxlcyA9IFtdXG4gIGlmIChhcmdzLmZpbGVzKSB7XG4gICAgcmV0dXJuIHRoaXMudXNlKGFyZ3MuZmlsZXMpXG4gIH1cblxuICB0aGlzLnN0YXJ0Rm4gPSBmdW5jdGlvbih3b3JkTGlzdCkge1xuICAgIHZhciBrID0gT2JqZWN0LmtleXMod29yZExpc3QpXG4gICAgdmFyIGwgPSBrLmxlbmd0aFxuXG4gICAgcmV0dXJuIGtbfn4oTWF0aC5yYW5kb20oKSpsKV1cbiAgfVxuXG4gIHRoaXMuZW5kRm4gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zZW50ZW5jZS5zcGxpdCgnICcpLmxlbmd0aCA+IDdcbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbk1hcmtvdkNoYWluLnByb3RvdHlwZS5WRVJTSU9OID0gcmVxdWlyZSgnLi4vcGFja2FnZScpLnZlcnNpb25cblxuTWFya292Q2hhaW4ucHJvdG90eXBlLnVzZSA9IGZ1bmN0aW9uKGZpbGVzKSB7XG4gIGlmIChpc1R5cGUoZmlsZXMpID09PSAnYXJyYXknKSB7XG4gICAgdGhpcy5maWxlcyA9IGZpbGVzXG4gIH1cbiAgZWxzZSBpZiAoaXNUeXBlKGZpbGVzKSA9PT0gJ3N0cmluZycpIHtcbiAgICB0aGlzLmZpbGVzID0gW2ZpbGVzXVxuICB9XG4gIGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcignTmVlZCB0byBwYXNzIGEgc3RyaW5nIG9yIGFycmF5IGZvciB1c2UoKScpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuTWFya292Q2hhaW4ucHJvdG90eXBlLnJlYWRGaWxlID0gZnVuY3Rpb24oZmlsZSkge1xuICByZXR1cm4gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICBmcy5yZWFkRmlsZShmaWxlLCAndXRmOCcsIGZ1bmN0aW9uKGVyciwgZGF0YSkge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICAvLyBpZiB0aGUgZmlsZSBkb2VzIG5vdCBleGlzdCxcbiAgICAgICAgLy8gaWYgYGZpbGVgIHN0YXJ0cyB3aXRoIC4vIG9yIC8sIGFzc3VtaW5nIHRyeWluZyB0byBiZSBhIGZpbGVcbiAgICAgICAgLy8gaWYgYGZpbGVgIGhhcyBhICcuJywgYW5kIHRoZSBzdHJpbmcgYWZ0ZXIgdGhhdCBoYXMgbm8gc3BhY2UsIGFzc3VtZSBmaWxlXG4gICAgICAgIGlmIChlcnIuY29kZSA9PT0gJ0VOT0VOVCcgJiYgIWtpbmRhRmlsZShmaWxlKSkge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCBmaWxlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKVxuICAgICAgfVxuICAgICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHsgY2FsbGJhY2sobnVsbCwgZGF0YSkgfSlcbiAgICB9KVxuICB9XG59XG5cbk1hcmtvdkNoYWluLnByb3RvdHlwZS5jb3VudFRvdGFsID0gZnVuY3Rpb24od29yZCkge1xuICB2YXIgdG90YWwgPSAwXG4gICAgLCBwcm9wXG5cbiAgZm9yIChwcm9wIGluIHRoaXMud29yZEJhbmtbd29yZF0pIHtcbiAgICBpZiAodGhpcy53b3JkQmFua1t3b3JkXS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgdG90YWwgKz0gdGhpcy53b3JkQmFua1t3b3JkXVtwcm9wXVxuICAgIH1cbiAgfVxuICByZXR1cm4gdG90YWxcbn1cblxuTWFya292Q2hhaW4ucHJvdG90eXBlLnByb2Nlc3MgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICB2YXIgcmVhZEZpbGVzID0gW11cblxuICB0aGlzLmZpbGVzLmZvckVhY2goZnVuY3Rpb24oZmlsZSkge1xuICAgIHJlYWRGaWxlcy5wdXNoKHRoaXMucmVhZEZpbGUoZmlsZSkpXG4gIH0uYmluZCh0aGlzKSlcblxuICBhc3luYy5wYXJhbGxlbChyZWFkRmlsZXMsIGZ1bmN0aW9uKGVyciwgcmV0RmlsZXMpIHtcbiAgICB2YXIgd29yZHNcbiAgICAgICwgY3VyV29yZFxuICAgIHRoaXMucGFyc2VGaWxlKHJldEZpbGVzLnRvU3RyaW5nKCkpXG5cbiAgICBjdXJXb3JkID0gdGhpcy5zdGFydEZuKHRoaXMud29yZEJhbmspXG5cbiAgICB0aGlzLnNlbnRlbmNlID0gY3VyV29yZFxuXG4gICAgd2hpbGUgKHRoaXMud29yZEJhbmtbY3VyV29yZF0gJiYgIXRoaXMuZW5kRm4oKSkge1xuICAgICAgY3VyV29yZCA9IHBpY2tPbmVCeVdlaWdodCh0aGlzLndvcmRCYW5rW2N1cldvcmRdKVxuICAgICAgdGhpcy5zZW50ZW5jZSArPSAnICcgKyBjdXJXb3JkXG4gICAgfVxuICAgIGNhbGxiYWNrKG51bGwsIHRoaXMuc2VudGVuY2UudHJpbSgpKVxuXG4gIH0uYmluZCh0aGlzKSlcblxuICByZXR1cm4gdGhpc1xufVxuXG5NYXJrb3ZDaGFpbi5wcm90b3R5cGUucGFyc2VGaWxlID0gZnVuY3Rpb24oZmlsZSkge1xuICAvLyBzcGxpdHMgc2VudGVuY2VzIGJhc2VkIG9uIGVpdGhlciBhbiBlbmQgbGluZVxuICAvLyBvciBhIHBlcmlvZCAoZm9sbG93ZWQgYnkgYSBzcGFjZSlcbiAgZmlsZS5zcGxpdCgvKD86XFwuIHxcXG4pL2lnKS5mb3JFYWNoKGZ1bmN0aW9uKGxpbmVzKSB7XG4gICAgdmFyIGN1cldvcmRcbiAgICAgICwgaVxuICAgICAgLCBuZXh0V29yZFxuICAgICAgLCB3b3Jkc1xuXG4gICAgd29yZHMgPSBsaW5lcy5zcGxpdCgnICcpLmZpbHRlcihmdW5jdGlvbih3KSB7IHJldHVybiAody50cmltKCkgIT09ICcnKSB9KVxuICAgIGZvciAoaSA9IDA7IGkgPCB3b3Jkcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGN1cldvcmQgPSB0aGlzLm5vcm1hbGl6ZSh3b3Jkc1tpXSlcbiAgICAgIG5leHRXb3JkID0gdGhpcy5ub3JtYWxpemUod29yZHNbaSArIDFdKVxuICAgICAgaWYgKCF0aGlzLndvcmRCYW5rW2N1cldvcmRdKSB7XG4gICAgICAgIHRoaXMud29yZEJhbmtbY3VyV29yZF0gPSB7fVxuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLndvcmRCYW5rW2N1cldvcmRdW25leHRXb3JkXSkge1xuICAgICAgICB0aGlzLndvcmRCYW5rW2N1cldvcmRdW25leHRXb3JkXSA9IDFcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLndvcmRCYW5rW2N1cldvcmRdW25leHRXb3JkXSArPSAxXG4gICAgICB9XG4gICAgfVxuICB9LmJpbmQodGhpcykpXG59XG5cbk1hcmtvdkNoYWluLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKGZuU3RyKSB7XG4gIHZhciBzdGFydFR5cGUgPSBpc1R5cGUoZm5TdHIpXG4gIGlmIChzdGFydFR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgdGhpcy5zdGFydEZuID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZm5TdHJcbiAgICB9XG4gIH1cbiAgZWxzZSBpZiAoc3RhcnRUeXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5zdGFydEZuID0gZnVuY3Rpb24od29yZExpc3QpIHtcbiAgICAgIHJldHVybiBmblN0cih3b3JkTGlzdClcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNdXN0IHBhc3MgYSBmdW5jdGlvbiwgb3Igc3RyaW5nIGludG8gc3RhcnQoKScpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuTWFya292Q2hhaW4ucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uKGZuU3RyT3JOdW0pIHtcbiAgdmFyIGVuZFR5cGUgPSBpc1R5cGUoZm5TdHJPck51bSlcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmIChlbmRUeXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5lbmRGbiA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gZm5TdHJPck51bSh0aGlzLnNlbnRlbmNlKSB9XG4gIH1cbiAgZWxzZSBpZiAoZW5kVHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICB0aGlzLmVuZEZuID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gc2VsZi5zZW50ZW5jZS5zcGxpdCgnICcpLnNsaWNlKC0xKVswXSA9PT0gZm5TdHJPck51bVxuICAgIH1cbiAgfVxuICBlbHNlIGlmIChlbmRUeXBlID09PSAnbnVtYmVyJyB8fCBmblN0ck9yTnVtID09PSB1bmRlZmluZWQpIHtcbiAgICBmblN0ck9yTnVtID0gZm5TdHJPck51bSB8fCBJbmZpbml0eVxuICAgIHRoaXMuZW5kRm4gPSBmdW5jdGlvbigpIHsgcmV0dXJuIHNlbGYuc2VudGVuY2Uuc3BsaXQoJyAnKS5sZW5ndGggPiBmblN0ck9yTnVtIH1cbiAgfVxuICBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ011c3QgcGFzcyBhIGZ1bmN0aW9uLCBzdHJpbmcgb3IgbnVtYmVyIGludG8gZW5kKCknKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbk1hcmtvdkNoYWluLnByb3RvdHlwZS5ub3JtYWxpemUgPSBmdW5jdGlvbih3b3JkKSB7XG4gIHJldHVybiB3b3JkLnJlcGxhY2UoL1xcLiQvaWcsICcnKVxufVxuXG5tb2R1bGUuZXhwb3J0cy5NYXJrb3ZDaGFpbiA9IE1hcmtvdkNoYWluXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKCdfcHJvY2VzcycpKVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OXRZWEpyYjNaamFHRnBiaTl2YkdSbGNpOXBibVJsZUM1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaU8wRkJRVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlHRnplVzVqSUQwZ2NtVnhkV2x5WlNnbllYTjVibU1uS1Z4dUlDQXNJR1p6SUQwZ2NtVnhkV2x5WlNnblpuTW5LVnh1SUNBc0lIQmhkR2dnUFNCeVpYRjFhWEpsS0Nkd1lYUm9KeWxjYmlBZ0xDQndhV05yVDI1bFFubFhaV2xuYUhRZ1BTQnlaWEYxYVhKbEtDZHdhV05yTFc5dVpTMWllUzEzWldsbmFIUW5LVnh1SUNBc0lHbHpWSGx3WlZ4dUlDQXNJR3RwYm1SaFJtbHNaVnh1SUNBc0lFMWhjbXR2ZGtOb1lXbHVYRzVjYm1selZIbHdaU0E5SUdaMWJtTjBhVzl1S0hRcElIdGNiaUFnY21WMGRYSnVJRTlpYW1WamRDNXdjbTkwYjNSNWNHVXVkRzlUZEhKcGJtY3VZMkZzYkNoMEtTNXpiR2xqWlNnNExDQXRNU2t1ZEc5TWIzZGxja05oYzJVb0tWeHVmVnh1WEc1cmFXNWtZVVpwYkdVZ1BTQm1kVzVqZEdsdmJpaG1hV3hsS1NCN1hHNGdJSEpsZEhWeWJpQm1hV3hsTG1sdVpHVjRUMllvSnk0bklDc2djR0YwYUM1elpYQXBJRDA5UFNBd0lIeDhJR1pwYkdVdWFXNWtaWGhQWmlod1lYUm9Mbk5sY0NrZ1BUMDlJREJjYm4xY2JseHVUV0Z5YTI5MlEyaGhhVzRnUFNCbWRXNWpkR2x2YmloaGNtZHpLU0I3WEc0Z0lHbG1JQ2doWVhKbmN5a2dleUJoY21keklEMGdlMzBnZlZ4dUlDQjBhR2x6TG5kdmNtUkNZVzVySUQwZ2UzMWNiaUFnZEdocGN5NXpaVzUwWlc1alpTQTlJQ2NuWEc0Z0lIUm9hWE11Wm1sc1pYTWdQU0JiWFZ4dUlDQnBaaUFvWVhKbmN5NW1hV3hsY3lrZ2UxeHVJQ0FnSUhKbGRIVnliaUIwYUdsekxuVnpaU2hoY21kekxtWnBiR1Z6S1Z4dUlDQjlYRzVjYmlBZ2RHaHBjeTV6ZEdGeWRFWnVJRDBnWm5WdVkzUnBiMjRvZDI5eVpFeHBjM1FwSUh0Y2JpQWdJQ0IyWVhJZ2F5QTlJRTlpYW1WamRDNXJaWGx6S0hkdmNtUk1hWE4wS1Z4dUlDQWdJSFpoY2lCc0lEMGdheTVzWlc1bmRHaGNibHh1SUNBZ0lISmxkSFZ5YmlCclczNStLRTFoZEdndWNtRnVaRzl0S0NrcWJDbGRYRzRnSUgxY2JseHVJQ0IwYUdsekxtVnVaRVp1SUQwZ1puVnVZM1JwYjI0b0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUhSb2FYTXVjMlZ1ZEdWdVkyVXVjM0JzYVhRb0p5QW5LUzVzWlc1bmRHZ2dQaUEzWEc0Z0lIMWNibHh1SUNCeVpYUjFjbTRnZEdocGMxeHVmVnh1WEc1TllYSnJiM1pEYUdGcGJpNXdjbTkwYjNSNWNHVXVWa1ZTVTBsUFRpQTlJSEpsY1hWcGNtVW9KeTR1TDNCaFkydGhaMlVuS1M1MlpYSnphVzl1WEc1Y2JrMWhjbXR2ZGtOb1lXbHVMbkJ5YjNSdmRIbHdaUzUxYzJVZ1BTQm1kVzVqZEdsdmJpaG1hV3hsY3lrZ2UxeHVJQ0JwWmlBb2FYTlVlWEJsS0dacGJHVnpLU0E5UFQwZ0oyRnljbUY1SnlrZ2UxeHVJQ0FnSUhSb2FYTXVabWxzWlhNZ1BTQm1hV3hsYzF4dUlDQjlYRzRnSUdWc2MyVWdhV1lnS0dselZIbHdaU2htYVd4bGN5a2dQVDA5SUNkemRISnBibWNuS1NCN1hHNGdJQ0FnZEdocGN5NW1hV3hsY3lBOUlGdG1hV3hsYzExY2JpQWdmVnh1SUNCbGJITmxJSHRjYmlBZ0lDQjBhSEp2ZHlCdVpYY2dSWEp5YjNJb0owNWxaV1FnZEc4Z2NHRnpjeUJoSUhOMGNtbHVaeUJ2Y2lCaGNuSmhlU0JtYjNJZ2RYTmxLQ2tuS1Z4dUlDQjlYRzRnSUhKbGRIVnliaUIwYUdselhHNTlYRzVjYmsxaGNtdHZka05vWVdsdUxuQnliM1J2ZEhsd1pTNXlaV0ZrUm1sc1pTQTlJR1oxYm1OMGFXOXVLR1pwYkdVcElIdGNiaUFnY21WMGRYSnVJR1oxYm1OMGFXOXVLR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdabk11Y21WaFpFWnBiR1VvWm1sc1pTd2dKM1YwWmpnbkxDQm1kVzVqZEdsdmJpaGxjbklzSUdSaGRHRXBJSHRjYmlBZ0lDQWdJR2xtSUNobGNuSXBJSHRjYmlBZ0lDQWdJQ0FnTHk4Z2FXWWdkR2hsSUdacGJHVWdaRzlsY3lCdWIzUWdaWGhwYzNRc1hHNGdJQ0FnSUNBZ0lDOHZJR2xtSUdCbWFXeGxZQ0J6ZEdGeWRITWdkMmwwYUNBdUx5QnZjaUF2TENCaGMzTjFiV2x1WnlCMGNubHBibWNnZEc4Z1ltVWdZU0JtYVd4bFhHNGdJQ0FnSUNBZ0lDOHZJR2xtSUdCbWFXeGxZQ0JvWVhNZ1lTQW5MaWNzSUdGdVpDQjBhR1VnYzNSeWFXNW5JR0ZtZEdWeUlIUm9ZWFFnYUdGeklHNXZJSE53WVdObExDQmhjM04xYldVZ1ptbHNaVnh1SUNBZ0lDQWdJQ0JwWmlBb1pYSnlMbU52WkdVZ1BUMDlJQ2RGVGs5RlRsUW5JQ1ltSUNGcmFXNWtZVVpwYkdVb1ptbHNaU2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1kyRnNiR0poWTJzb2JuVnNiQ3dnWm1sc1pTazdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR05oYkd4aVlXTnJLR1Z5Y2lsY2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUhCeWIyTmxjM011Ym1WNGRGUnBZMnNvWm5WdVkzUnBiMjRvS1NCN0lHTmhiR3hpWVdOcktHNTFiR3dzSUdSaGRHRXBJSDBwWEc0Z0lDQWdmU2xjYmlBZ2ZWeHVmVnh1WEc1TllYSnJiM1pEYUdGcGJpNXdjbTkwYjNSNWNHVXVZMjkxYm5SVWIzUmhiQ0E5SUdaMWJtTjBhVzl1S0hkdmNtUXBJSHRjYmlBZ2RtRnlJSFJ2ZEdGc0lEMGdNRnh1SUNBZ0lDd2djSEp2Y0Z4dVhHNGdJR1p2Y2lBb2NISnZjQ0JwYmlCMGFHbHpMbmR2Y21SQ1lXNXJXM2R2Y21SZEtTQjdYRzRnSUNBZ2FXWWdLSFJvYVhNdWQyOXlaRUpoYm10YmQyOXlaRjB1YUdGelQzZHVVSEp2Y0dWeWRIa29jSEp2Y0NrcElIdGNiaUFnSUNBZ0lIUnZkR0ZzSUNzOUlIUm9hWE11ZDI5eVpFSmhibXRiZDI5eVpGMWJjSEp2Y0YxY2JpQWdJQ0I5WEc0Z0lIMWNiaUFnY21WMGRYSnVJSFJ2ZEdGc1hHNTlYRzVjYmsxaGNtdHZka05vWVdsdUxuQnliM1J2ZEhsd1pTNXdjbTlqWlhOeklEMGdablZ1WTNScGIyNG9ZMkZzYkdKaFkyc3BJSHRjYmlBZ2RtRnlJSEpsWVdSR2FXeGxjeUE5SUZ0ZFhHNWNiaUFnZEdocGN5NW1hV3hsY3k1bWIzSkZZV05vS0daMWJtTjBhVzl1S0dacGJHVXBJSHRjYmlBZ0lDQnlaV0ZrUm1sc1pYTXVjSFZ6YUNoMGFHbHpMbkpsWVdSR2FXeGxLR1pwYkdVcEtWeHVJQ0I5TG1KcGJtUW9kR2hwY3lrcFhHNWNiaUFnWVhONWJtTXVjR0Z5WVd4c1pXd29jbVZoWkVacGJHVnpMQ0JtZFc1amRHbHZiaWhsY25Jc0lISmxkRVpwYkdWektTQjdYRzRnSUNBZ2RtRnlJSGR2Y21SelhHNGdJQ0FnSUNBc0lHTjFjbGR2Y21SY2JpQWdJQ0IwYUdsekxuQmhjbk5sUm1sc1pTaHlaWFJHYVd4bGN5NTBiMU4wY21sdVp5Z3BLVnh1WEc0Z0lDQWdZM1Z5VjI5eVpDQTlJSFJvYVhNdWMzUmhjblJHYmloMGFHbHpMbmR2Y21SQ1lXNXJLVnh1WEc0Z0lDQWdkR2hwY3k1elpXNTBaVzVqWlNBOUlHTjFjbGR2Y21SY2JseHVJQ0FnSUhkb2FXeGxJQ2gwYUdsekxuZHZjbVJDWVc1clcyTjFjbGR2Y21SZElDWW1JQ0YwYUdsekxtVnVaRVp1S0NrcElIdGNiaUFnSUNBZ0lHTjFjbGR2Y21RZ1BTQndhV05yVDI1bFFubFhaV2xuYUhRb2RHaHBjeTUzYjNKa1FtRnVhMXRqZFhKWGIzSmtYU2xjYmlBZ0lDQWdJSFJvYVhNdWMyVnVkR1Z1WTJVZ0t6MGdKeUFuSUNzZ1kzVnlWMjl5WkZ4dUlDQWdJSDFjYmlBZ0lDQmpZV3hzWW1GamF5aHVkV3hzTENCMGFHbHpMbk5sYm5SbGJtTmxMblJ5YVcwb0tTbGNibHh1SUNCOUxtSnBibVFvZEdocGN5a3BYRzVjYmlBZ2NtVjBkWEp1SUhSb2FYTmNibjFjYmx4dVRXRnlhMjkyUTJoaGFXNHVjSEp2ZEc5MGVYQmxMbkJoY25ObFJtbHNaU0E5SUdaMWJtTjBhVzl1S0dacGJHVXBJSHRjYmlBZ0x5OGdjM0JzYVhSeklITmxiblJsYm1ObGN5QmlZWE5sWkNCdmJpQmxhWFJvWlhJZ1lXNGdaVzVrSUd4cGJtVmNiaUFnTHk4Z2IzSWdZU0J3WlhKcGIyUWdLR1p2Ykd4dmQyVmtJR0o1SUdFZ2MzQmhZMlVwWEc0Z0lHWnBiR1V1YzNCc2FYUW9MeWcvT2x4Y0xpQjhYRnh1S1M5cFp5a3VabTl5UldGamFDaG1kVzVqZEdsdmJpaHNhVzVsY3lrZ2UxeHVJQ0FnSUhaaGNpQmpkWEpYYjNKa1hHNGdJQ0FnSUNBc0lHbGNiaUFnSUNBZ0lDd2dibVY0ZEZkdmNtUmNiaUFnSUNBZ0lDd2dkMjl5WkhOY2JseHVJQ0FnSUhkdmNtUnpJRDBnYkdsdVpYTXVjM0JzYVhRb0p5QW5LUzVtYVd4MFpYSW9ablZ1WTNScGIyNG9keWtnZXlCeVpYUjFjbTRnS0hjdWRISnBiU2dwSUNFOVBTQW5KeWtnZlNsY2JpQWdJQ0JtYjNJZ0tHa2dQU0F3T3lCcElEd2dkMjl5WkhNdWJHVnVaM1JvSUMwZ01Uc2dhU3NyS1NCN1hHNGdJQ0FnSUNCamRYSlhiM0prSUQwZ2RHaHBjeTV1YjNKdFlXeHBlbVVvZDI5eVpITmJhVjBwWEc0Z0lDQWdJQ0J1WlhoMFYyOXlaQ0E5SUhSb2FYTXVibTl5YldGc2FYcGxLSGR2Y21Selcya2dLeUF4WFNsY2JpQWdJQ0FnSUdsbUlDZ2hkR2hwY3k1M2IzSmtRbUZ1YTF0amRYSlhiM0prWFNrZ2UxeHVJQ0FnSUNBZ0lDQjBhR2x6TG5kdmNtUkNZVzVyVzJOMWNsZHZjbVJkSUQwZ2UzMWNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lHbG1JQ2doZEdocGN5NTNiM0prUW1GdWExdGpkWEpYYjNKa1hWdHVaWGgwVjI5eVpGMHBJSHRjYmlBZ0lDQWdJQ0FnZEdocGN5NTNiM0prUW1GdWExdGpkWEpYYjNKa1hWdHVaWGgwVjI5eVpGMGdQU0F4WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JsYkhObElIdGNiaUFnSUNBZ0lDQWdkR2hwY3k1M2IzSmtRbUZ1YTF0amRYSlhiM0prWFZ0dVpYaDBWMjl5WkYwZ0t6MGdNVnh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnZlM1aWFXNWtLSFJvYVhNcEtWeHVmVnh1WEc1TllYSnJiM1pEYUdGcGJpNXdjbTkwYjNSNWNHVXVjM1JoY25RZ1BTQm1kVzVqZEdsdmJpaG1ibE4wY2lrZ2UxeHVJQ0IyWVhJZ2MzUmhjblJVZVhCbElEMGdhWE5VZVhCbEtHWnVVM1J5S1Z4dUlDQnBaaUFvYzNSaGNuUlVlWEJsSUQwOVBTQW5jM1J5YVc1bkp5a2dlMXh1SUNBZ0lIUm9hWE11YzNSaGNuUkdiaUE5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUdadVUzUnlYRzRnSUNBZ2ZWeHVJQ0I5WEc0Z0lHVnNjMlVnYVdZZ0tITjBZWEowVkhsd1pTQTlQVDBnSjJaMWJtTjBhVzl1SnlrZ2UxeHVJQ0FnSUhSb2FYTXVjM1JoY25SR2JpQTlJR1oxYm1OMGFXOXVLSGR2Y21STWFYTjBLU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdabTVUZEhJb2QyOXlaRXhwYzNRcFhHNGdJQ0FnZlZ4dUlDQjlYRzRnSUdWc2MyVWdlMXh1SUNBZ0lIUm9jbTkzSUc1bGR5QkZjbkp2Y2lnblRYVnpkQ0J3WVhOeklHRWdablZ1WTNScGIyNHNJRzl5SUhOMGNtbHVaeUJwYm5SdklITjBZWEowS0NrbktWeHVJQ0I5WEc0Z0lISmxkSFZ5YmlCMGFHbHpYRzU5WEc1Y2JrMWhjbXR2ZGtOb1lXbHVMbkJ5YjNSdmRIbHdaUzVsYm1RZ1BTQm1kVzVqZEdsdmJpaG1ibE4wY2s5eVRuVnRLU0I3WEc0Z0lIWmhjaUJsYm1SVWVYQmxJRDBnYVhOVWVYQmxLR1p1VTNSeVQzSk9kVzBwWEc0Z0lIWmhjaUJ6Wld4bUlEMGdkR2hwY3p0Y2JseHVJQ0JwWmlBb1pXNWtWSGx3WlNBOVBUMGdKMloxYm1OMGFXOXVKeWtnZTF4dUlDQWdJSFJvYVhNdVpXNWtSbTRnUFNCbWRXNWpkR2x2YmlncElIc2djbVYwZFhKdUlHWnVVM1J5VDNKT2RXMG9kR2hwY3k1elpXNTBaVzVqWlNrZ2ZWeHVJQ0I5WEc0Z0lHVnNjMlVnYVdZZ0tHVnVaRlI1Y0dVZ1BUMDlJQ2R6ZEhKcGJtY25LU0I3WEc0Z0lDQWdkR2hwY3k1bGJtUkdiaUE5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUhObGJHWXVjMlZ1ZEdWdVkyVXVjM0JzYVhRb0p5QW5LUzV6YkdsalpTZ3RNU2xiTUYwZ1BUMDlJR1p1VTNSeVQzSk9kVzFjYmlBZ0lDQjlYRzRnSUgxY2JpQWdaV3h6WlNCcFppQW9aVzVrVkhsd1pTQTlQVDBnSjI1MWJXSmxjaWNnZkh3Z1ptNVRkSEpQY2s1MWJTQTlQVDBnZFc1a1pXWnBibVZrS1NCN1hHNGdJQ0FnWm01VGRISlBjazUxYlNBOUlHWnVVM1J5VDNKT2RXMGdmSHdnU1c1bWFXNXBkSGxjYmlBZ0lDQjBhR2x6TG1WdVpFWnVJRDBnWm5WdVkzUnBiMjRvS1NCN0lISmxkSFZ5YmlCelpXeG1Mbk5sYm5SbGJtTmxMbk53YkdsMEtDY2dKeWt1YkdWdVozUm9JRDRnWm01VGRISlBjazUxYlNCOVhHNGdJSDFjYmlBZ1pXeHpaU0I3WEc0Z0lDQWdkR2h5YjNjZ2JtVjNJRVZ5Y205eUtDZE5kWE4wSUhCaGMzTWdZU0JtZFc1amRHbHZiaXdnYzNSeWFXNW5JRzl5SUc1MWJXSmxjaUJwYm5SdklHVnVaQ2dwSnlsY2JpQWdmVnh1SUNCeVpYUjFjbTRnZEdocGMxeHVmVnh1WEc1TllYSnJiM1pEYUdGcGJpNXdjbTkwYjNSNWNHVXVibTl5YldGc2FYcGxJRDBnWm5WdVkzUnBiMjRvZDI5eVpDa2dlMXh1SUNCeVpYUjFjbTRnZDI5eVpDNXlaWEJzWVdObEtDOWNYQzRrTDJsbkxDQW5KeWxjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNdVRXRnlhMjkyUTJoaGFXNGdQU0JOWVhKcmIzWkRhR0ZwYmx4dUlsMTkiLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwiX2FyZ3NcIjogW1xuICAgIFtcbiAgICAgIHtcbiAgICAgICAgXCJyYXdcIjogXCJtYXJrb3ZjaGFpblwiLFxuICAgICAgICBcInNjb3BlXCI6IG51bGwsXG4gICAgICAgIFwiZXNjYXBlZE5hbWVcIjogXCJtYXJrb3ZjaGFpblwiLFxuICAgICAgICBcIm5hbWVcIjogXCJtYXJrb3ZjaGFpblwiLFxuICAgICAgICBcInJhd1NwZWNcIjogXCJcIixcbiAgICAgICAgXCJzcGVjXCI6IFwibGF0ZXN0XCIsXG4gICAgICAgIFwidHlwZVwiOiBcInRhZ1wiXG4gICAgICB9LFxuICAgICAgXCIvVXNlcnMvam9lL09uZURyaXZlL1Byb2plY3RzL21pbmktY29kZS1hZHZlbnR1cmVzLzAwMi1nZW5lcmF0ZS1kYXRhLXdpdGgtbWFya292LWNoYWluc1wiXG4gICAgXVxuICBdLFxuICBcIl9mcm9tXCI6IFwibWFya292Y2hhaW5AbGF0ZXN0XCIsXG4gIFwiX2lkXCI6IFwibWFya292Y2hhaW5AMS4wLjJcIixcbiAgXCJfaW5DYWNoZVwiOiB0cnVlLFxuICBcIl9pbnN0YWxsYWJsZVwiOiB0cnVlLFxuICBcIl9sb2NhdGlvblwiOiBcIi9tYXJrb3ZjaGFpblwiLFxuICBcIl9ub2RlVmVyc2lvblwiOiBcIjQuMC4wXCIsXG4gIFwiX25wbVVzZXJcIjoge1xuICAgIFwibmFtZVwiOiBcInN3YW5nXCIsXG4gICAgXCJlbWFpbFwiOiBcInNodWFud2FuZ0BnbWFpbC5jb21cIlxuICB9LFxuICBcIl9ucG1WZXJzaW9uXCI6IFwiMy41LjJcIixcbiAgXCJfcGhhbnRvbUNoaWxkcmVuXCI6IHt9LFxuICBcIl9yZXF1ZXN0ZWRcIjoge1xuICAgIFwicmF3XCI6IFwibWFya292Y2hhaW5cIixcbiAgICBcInNjb3BlXCI6IG51bGwsXG4gICAgXCJlc2NhcGVkTmFtZVwiOiBcIm1hcmtvdmNoYWluXCIsXG4gICAgXCJuYW1lXCI6IFwibWFya292Y2hhaW5cIixcbiAgICBcInJhd1NwZWNcIjogXCJcIixcbiAgICBcInNwZWNcIjogXCJsYXRlc3RcIixcbiAgICBcInR5cGVcIjogXCJ0YWdcIlxuICB9LFxuICBcIl9yZXF1aXJlZEJ5XCI6IFtcbiAgICBcIiNVU0VSXCIsXG4gICAgXCIvXCJcbiAgXSxcbiAgXCJfcmVzb2x2ZWRcIjogXCJodHRwczovL3JlZ2lzdHJ5Lm5wbWpzLm9yZy9tYXJrb3ZjaGFpbi8tL21hcmtvdmNoYWluLTEuMC4yLnRnelwiLFxuICBcIl9zaGFzdW1cIjogXCI1OGIzODY0M2ZiNjA5M2NkNWI2MjQ1NWI3YjFlN2JiZmU1NmQ3ZTUzXCIsXG4gIFwiX3Nocmlua3dyYXBcIjogbnVsbCxcbiAgXCJfc3BlY1wiOiBcIm1hcmtvdmNoYWluXCIsXG4gIFwiX3doZXJlXCI6IFwiL1VzZXJzL2pvZS9PbmVEcml2ZS9Qcm9qZWN0cy9taW5pLWNvZGUtYWR2ZW50dXJlcy8wMDItZ2VuZXJhdGUtZGF0YS13aXRoLW1hcmtvdi1jaGFpbnNcIixcbiAgXCJhdXRob3JcIjoge1xuICAgIFwibmFtZVwiOiBcIlNodWFuIFdhbmdcIlxuICB9LFxuICBcImJ1Z3NcIjoge1xuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL3N3YW5nL21hcmtvdmNoYWluL2lzc3Vlc1wiXG4gIH0sXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcInBpY2stb25lLWJ5LXdlaWdodFwiOiBcIn4xLjAuMFwiXG4gIH0sXG4gIFwiZGVzY3JpcHRpb25cIjogXCJnZW5lcmF0ZXMgYSBtYXJrb3YgY2hhaW4gb2Ygd29yZHMgYmFzZWQgb24gaW5wdXQgZmlsZXNcIixcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiYmFiZWxcIjogXCJ+NS44LjIzXCIsXG4gICAgXCJjaGFpXCI6IFwifjMuNC4xXCIsXG4gICAgXCJtb2NoYVwiOiBcIn4yLjMuNFwiXG4gIH0sXG4gIFwiZGlyZWN0b3JpZXNcIjoge1xuICAgIFwidGVzdFwiOiBcInRlc3RcIlxuICB9LFxuICBcImRpc3RcIjoge1xuICAgIFwic2hhc3VtXCI6IFwiNThiMzg2NDNmYjYwOTNjZDViNjI0NTViN2IxZTdiYmZlNTZkN2U1M1wiLFxuICAgIFwidGFyYmFsbFwiOiBcImh0dHBzOi8vcmVnaXN0cnkubnBtanMub3JnL21hcmtvdmNoYWluLy0vbWFya292Y2hhaW4tMS4wLjIudGd6XCJcbiAgfSxcbiAgXCJlbmdpbmVzXCI6IHtcbiAgICBcIm5vZGVcIjogXCI+PTAuOFwiXG4gIH0sXG4gIFwiZ2l0SGVhZFwiOiBcImZlZTJkMjAxMWIzODJlODcyODY0MzRlNjM4ZGMwZjE3ZThhYjc1NDdcIixcbiAgXCJob21lcGFnZVwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS9zd2FuZy9tYXJrb3ZjaGFpbiNyZWFkbWVcIixcbiAgXCJrZXl3b3Jkc1wiOiBbXG4gICAgXCJtYXJrb3YgY2hhaW5cIixcbiAgICBcIm1hcmtvdlwiXG4gIF0sXG4gIFwibGljZW5zZVwiOiBcIklTQ1wiLFxuICBcIm1haW5cIjogXCJsaWIvaW5kZXguanNcIixcbiAgXCJtYWludGFpbmVyc1wiOiBbXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwic3dhbmdcIixcbiAgICAgIFwiZW1haWxcIjogXCJzaHVhbndhbmdAZ21haWwuY29tXCJcbiAgICB9XG4gIF0sXG4gIFwibmFtZVwiOiBcIm1hcmtvdmNoYWluXCIsXG4gIFwib3B0aW9uYWxEZXBlbmRlbmNpZXNcIjoge30sXG4gIFwicmVhZG1lXCI6IFwiRVJST1I6IE5vIFJFQURNRSBkYXRhIGZvdW5kIVwiLFxuICBcInJlcG9zaXRvcnlcIjoge1xuICAgIFwidHlwZVwiOiBcImdpdFwiLFxuICAgIFwidXJsXCI6IFwiZ2l0K2h0dHBzOi8vZ2l0aHViLmNvbS9zd2FuZy9tYXJrb3ZjaGFpbi5naXRcIlxuICB9LFxuICBcInNjcmlwdHNcIjoge1xuICAgIFwiYmFiZWwtd2F0Y2hcIjogXCJiYWJlbCBzcmMgLS13YXRjaCAtLW91dC1kaXIgbGliXCIsXG4gICAgXCJjb21waWxlXCI6IFwiYmFiZWwgc3JjIC0tb3V0LWRpciBsaWJcIixcbiAgICBcInBvc3RwdWJsaXNoXCI6IFwicm0gLXJmIC4vbGliLyouanNcIixcbiAgICBcInByZXB1Ymxpc2hcIjogXCJucG0gcnVuIGNvbXBpbGUgJiYgbnBtIHRlc3RcIixcbiAgICBcInByZXZlcnNpb25cIjogXCJucG0gdGVzdFwiLFxuICAgIFwidGVzdFwiOiBcIm1vY2hhIHRlc3QvdGVzdCouanNcIlxuICB9LFxuICBcInZlcnNpb25cIjogXCIxLjAuMlwiXG59XG4iLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIHJlc29sdmVzIC4gYW5kIC4uIGVsZW1lbnRzIGluIGEgcGF0aCBhcnJheSB3aXRoIGRpcmVjdG9yeSBuYW1lcyB0aGVyZVxuLy8gbXVzdCBiZSBubyBzbGFzaGVzLCBlbXB0eSBlbGVtZW50cywgb3IgZGV2aWNlIG5hbWVzIChjOlxcKSBpbiB0aGUgYXJyYXlcbi8vIChzbyBhbHNvIG5vIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHNsYXNoZXMgLSBpdCBkb2VzIG5vdCBkaXN0aW5ndWlzaFxuLy8gcmVsYXRpdmUgYW5kIGFic29sdXRlIHBhdGhzKVxuZnVuY3Rpb24gbm9ybWFsaXplQXJyYXkocGFydHMsIGFsbG93QWJvdmVSb290KSB7XG4gIC8vIGlmIHRoZSBwYXRoIHRyaWVzIHRvIGdvIGFib3ZlIHRoZSByb290LCBgdXBgIGVuZHMgdXAgPiAwXG4gIHZhciB1cCA9IDA7XG4gIGZvciAodmFyIGkgPSBwYXJ0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIHZhciBsYXN0ID0gcGFydHNbaV07XG4gICAgaWYgKGxhc3QgPT09ICcuJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgIH0gZWxzZSBpZiAobGFzdCA9PT0gJy4uJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgdXArKztcbiAgICB9IGVsc2UgaWYgKHVwKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBwYXRoIGlzIGFsbG93ZWQgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIHJlc3RvcmUgbGVhZGluZyAuLnNcbiAgaWYgKGFsbG93QWJvdmVSb290KSB7XG4gICAgZm9yICg7IHVwLS07IHVwKSB7XG4gICAgICBwYXJ0cy51bnNoaWZ0KCcuLicpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXJ0cztcbn1cblxuLy8gU3BsaXQgYSBmaWxlbmFtZSBpbnRvIFtyb290LCBkaXIsIGJhc2VuYW1lLCBleHRdLCB1bml4IHZlcnNpb25cbi8vICdyb290JyBpcyBqdXN0IGEgc2xhc2gsIG9yIG5vdGhpbmcuXG52YXIgc3BsaXRQYXRoUmUgPVxuICAgIC9eKFxcLz98KShbXFxzXFxTXSo/KSgoPzpcXC57MSwyfXxbXlxcL10rP3wpKFxcLlteLlxcL10qfCkpKD86W1xcL10qKSQvO1xudmFyIHNwbGl0UGF0aCA9IGZ1bmN0aW9uKGZpbGVuYW1lKSB7XG4gIHJldHVybiBzcGxpdFBhdGhSZS5leGVjKGZpbGVuYW1lKS5zbGljZSgxKTtcbn07XG5cbi8vIHBhdGgucmVzb2x2ZShbZnJvbSAuLi5dLCB0bylcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMucmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcmVzb2x2ZWRQYXRoID0gJycsXG4gICAgICByZXNvbHZlZEFic29sdXRlID0gZmFsc2U7XG5cbiAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGggLSAxOyBpID49IC0xICYmICFyZXNvbHZlZEFic29sdXRlOyBpLS0pIHtcbiAgICB2YXIgcGF0aCA9IChpID49IDApID8gYXJndW1lbnRzW2ldIDogcHJvY2Vzcy5jd2QoKTtcblxuICAgIC8vIFNraXAgZW1wdHkgYW5kIGludmFsaWQgZW50cmllc1xuICAgIGlmICh0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyB0byBwYXRoLnJlc29sdmUgbXVzdCBiZSBzdHJpbmdzJyk7XG4gICAgfSBlbHNlIGlmICghcGF0aCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcmVzb2x2ZWRQYXRoID0gcGF0aCArICcvJyArIHJlc29sdmVkUGF0aDtcbiAgICByZXNvbHZlZEFic29sdXRlID0gcGF0aC5jaGFyQXQoMCkgPT09ICcvJztcbiAgfVxuXG4gIC8vIEF0IHRoaXMgcG9pbnQgdGhlIHBhdGggc2hvdWxkIGJlIHJlc29sdmVkIHRvIGEgZnVsbCBhYnNvbHV0ZSBwYXRoLCBidXRcbiAgLy8gaGFuZGxlIHJlbGF0aXZlIHBhdGhzIHRvIGJlIHNhZmUgKG1pZ2h0IGhhcHBlbiB3aGVuIHByb2Nlc3MuY3dkKCkgZmFpbHMpXG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHJlc29sdmVkUGF0aCA9IG5vcm1hbGl6ZUFycmF5KGZpbHRlcihyZXNvbHZlZFBhdGguc3BsaXQoJy8nKSwgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiAhIXA7XG4gIH0pLCAhcmVzb2x2ZWRBYnNvbHV0ZSkuam9pbignLycpO1xuXG4gIHJldHVybiAoKHJlc29sdmVkQWJzb2x1dGUgPyAnLycgOiAnJykgKyByZXNvbHZlZFBhdGgpIHx8ICcuJztcbn07XG5cbi8vIHBhdGgubm9ybWFsaXplKHBhdGgpXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgdmFyIGlzQWJzb2x1dGUgPSBleHBvcnRzLmlzQWJzb2x1dGUocGF0aCksXG4gICAgICB0cmFpbGluZ1NsYXNoID0gc3Vic3RyKHBhdGgsIC0xKSA9PT0gJy8nO1xuXG4gIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICBwYXRoID0gbm9ybWFsaXplQXJyYXkoZmlsdGVyKHBhdGguc3BsaXQoJy8nKSwgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiAhIXA7XG4gIH0pLCAhaXNBYnNvbHV0ZSkuam9pbignLycpO1xuXG4gIGlmICghcGF0aCAmJiAhaXNBYnNvbHV0ZSkge1xuICAgIHBhdGggPSAnLic7XG4gIH1cbiAgaWYgKHBhdGggJiYgdHJhaWxpbmdTbGFzaCkge1xuICAgIHBhdGggKz0gJy8nO1xuICB9XG5cbiAgcmV0dXJuIChpc0Fic29sdXRlID8gJy8nIDogJycpICsgcGF0aDtcbn07XG5cbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMuaXNBYnNvbHV0ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgcmV0dXJuIHBhdGguY2hhckF0KDApID09PSAnLyc7XG59O1xuXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLmpvaW4gPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBhdGhzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKTtcbiAgcmV0dXJuIGV4cG9ydHMubm9ybWFsaXplKGZpbHRlcihwYXRocywgZnVuY3Rpb24ocCwgaW5kZXgpIHtcbiAgICBpZiAodHlwZW9mIHAgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgdG8gcGF0aC5qb2luIG11c3QgYmUgc3RyaW5ncycpO1xuICAgIH1cbiAgICByZXR1cm4gcDtcbiAgfSkuam9pbignLycpKTtcbn07XG5cblxuLy8gcGF0aC5yZWxhdGl2ZShmcm9tLCB0bylcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMucmVsYXRpdmUgPSBmdW5jdGlvbihmcm9tLCB0bykge1xuICBmcm9tID0gZXhwb3J0cy5yZXNvbHZlKGZyb20pLnN1YnN0cigxKTtcbiAgdG8gPSBleHBvcnRzLnJlc29sdmUodG8pLnN1YnN0cigxKTtcblxuICBmdW5jdGlvbiB0cmltKGFycikge1xuICAgIHZhciBzdGFydCA9IDA7XG4gICAgZm9yICg7IHN0YXJ0IDwgYXJyLmxlbmd0aDsgc3RhcnQrKykge1xuICAgICAgaWYgKGFycltzdGFydF0gIT09ICcnKSBicmVhaztcbiAgICB9XG5cbiAgICB2YXIgZW5kID0gYXJyLmxlbmd0aCAtIDE7XG4gICAgZm9yICg7IGVuZCA+PSAwOyBlbmQtLSkge1xuICAgICAgaWYgKGFycltlbmRdICE9PSAnJykgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKHN0YXJ0ID4gZW5kKSByZXR1cm4gW107XG4gICAgcmV0dXJuIGFyci5zbGljZShzdGFydCwgZW5kIC0gc3RhcnQgKyAxKTtcbiAgfVxuXG4gIHZhciBmcm9tUGFydHMgPSB0cmltKGZyb20uc3BsaXQoJy8nKSk7XG4gIHZhciB0b1BhcnRzID0gdHJpbSh0by5zcGxpdCgnLycpKTtcblxuICB2YXIgbGVuZ3RoID0gTWF0aC5taW4oZnJvbVBhcnRzLmxlbmd0aCwgdG9QYXJ0cy5sZW5ndGgpO1xuICB2YXIgc2FtZVBhcnRzTGVuZ3RoID0gbGVuZ3RoO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGZyb21QYXJ0c1tpXSAhPT0gdG9QYXJ0c1tpXSkge1xuICAgICAgc2FtZVBhcnRzTGVuZ3RoID0gaTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHZhciBvdXRwdXRQYXJ0cyA9IFtdO1xuICBmb3IgKHZhciBpID0gc2FtZVBhcnRzTGVuZ3RoOyBpIDwgZnJvbVBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgb3V0cHV0UGFydHMucHVzaCgnLi4nKTtcbiAgfVxuXG4gIG91dHB1dFBhcnRzID0gb3V0cHV0UGFydHMuY29uY2F0KHRvUGFydHMuc2xpY2Uoc2FtZVBhcnRzTGVuZ3RoKSk7XG5cbiAgcmV0dXJuIG91dHB1dFBhcnRzLmpvaW4oJy8nKTtcbn07XG5cbmV4cG9ydHMuc2VwID0gJy8nO1xuZXhwb3J0cy5kZWxpbWl0ZXIgPSAnOic7XG5cbmV4cG9ydHMuZGlybmFtZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgdmFyIHJlc3VsdCA9IHNwbGl0UGF0aChwYXRoKSxcbiAgICAgIHJvb3QgPSByZXN1bHRbMF0sXG4gICAgICBkaXIgPSByZXN1bHRbMV07XG5cbiAgaWYgKCFyb290ICYmICFkaXIpIHtcbiAgICAvLyBObyBkaXJuYW1lIHdoYXRzb2V2ZXJcbiAgICByZXR1cm4gJy4nO1xuICB9XG5cbiAgaWYgKGRpcikge1xuICAgIC8vIEl0IGhhcyBhIGRpcm5hbWUsIHN0cmlwIHRyYWlsaW5nIHNsYXNoXG4gICAgZGlyID0gZGlyLnN1YnN0cigwLCBkaXIubGVuZ3RoIC0gMSk7XG4gIH1cblxuICByZXR1cm4gcm9vdCArIGRpcjtcbn07XG5cblxuZXhwb3J0cy5iYXNlbmFtZSA9IGZ1bmN0aW9uKHBhdGgsIGV4dCkge1xuICB2YXIgZiA9IHNwbGl0UGF0aChwYXRoKVsyXTtcbiAgLy8gVE9ETzogbWFrZSB0aGlzIGNvbXBhcmlzb24gY2FzZS1pbnNlbnNpdGl2ZSBvbiB3aW5kb3dzP1xuICBpZiAoZXh0ICYmIGYuc3Vic3RyKC0xICogZXh0Lmxlbmd0aCkgPT09IGV4dCkge1xuICAgIGYgPSBmLnN1YnN0cigwLCBmLmxlbmd0aCAtIGV4dC5sZW5ndGgpO1xuICB9XG4gIHJldHVybiBmO1xufTtcblxuXG5leHBvcnRzLmV4dG5hbWUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHJldHVybiBzcGxpdFBhdGgocGF0aClbM107XG59O1xuXG5mdW5jdGlvbiBmaWx0ZXIgKHhzLCBmKSB7XG4gICAgaWYgKHhzLmZpbHRlcikgcmV0dXJuIHhzLmZpbHRlcihmKTtcbiAgICB2YXIgcmVzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoZih4c1tpXSwgaSwgeHMpKSByZXMucHVzaCh4c1tpXSk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59XG5cbi8vIFN0cmluZy5wcm90b3R5cGUuc3Vic3RyIC0gbmVnYXRpdmUgaW5kZXggZG9uJ3Qgd29yayBpbiBJRThcbnZhciBzdWJzdHIgPSAnYWInLnN1YnN0cigtMSkgPT09ICdiJ1xuICAgID8gZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbikgeyByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKSB9XG4gICAgOiBmdW5jdGlvbiAoc3RyLCBzdGFydCwgbGVuKSB7XG4gICAgICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gc3RyLmxlbmd0aCArIHN0YXJ0O1xuICAgICAgICByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKTtcbiAgICB9XG47XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKCdfcHJvY2VzcycpKVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OXdZWFJvTFdKeWIzZHpaWEpwWm5rdmFXNWtaWGd1YW5NaVhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWp0QlFVRkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVNJc0ltWnBiR1VpT2lKblpXNWxjbUYwWldRdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lMeThnUTI5d2VYSnBaMmgwSUVwdmVXVnVkQ3dnU1c1akxpQmhibVFnYjNSb1pYSWdUbTlrWlNCamIyNTBjbWxpZFhSdmNuTXVYRzR2TDF4dUx5OGdVR1Z5YldsemMybHZiaUJwY3lCb1pYSmxZbmtnWjNKaGJuUmxaQ3dnWm5KbFpTQnZaaUJqYUdGeVoyVXNJSFJ2SUdGdWVTQndaWEp6YjI0Z2IySjBZV2x1YVc1bklHRmNiaTh2SUdOdmNIa2diMllnZEdocGN5QnpiMlowZDJGeVpTQmhibVFnWVhOemIyTnBZWFJsWkNCa2IyTjFiV1Z1ZEdGMGFXOXVJR1pwYkdWeklDaDBhR1ZjYmk4dklGd2lVMjltZEhkaGNtVmNJaWtzSUhSdklHUmxZV3dnYVc0Z2RHaGxJRk52Wm5SM1lYSmxJSGRwZEdodmRYUWdjbVZ6ZEhKcFkzUnBiMjRzSUdsdVkyeDFaR2x1WjF4dUx5OGdkMmwwYUc5MWRDQnNhVzFwZEdGMGFXOXVJSFJvWlNCeWFXZG9kSE1nZEc4Z2RYTmxMQ0JqYjNCNUxDQnRiMlJwWm5rc0lHMWxjbWRsTENCd2RXSnNhWE5vTEZ4dUx5OGdaR2x6ZEhKcFluVjBaU3dnYzNWaWJHbGpaVzV6WlN3Z1lXNWtMMjl5SUhObGJHd2dZMjl3YVdWeklHOW1JSFJvWlNCVGIyWjBkMkZ5WlN3Z1lXNWtJSFJ2SUhCbGNtMXBkRnh1THk4Z2NHVnljMjl1Y3lCMGJ5QjNhRzl0SUhSb1pTQlRiMlowZDJGeVpTQnBjeUJtZFhKdWFYTm9aV1FnZEc4Z1pHOGdjMjhzSUhOMVltcGxZM1FnZEc4Z2RHaGxYRzR2THlCbWIyeHNiM2RwYm1jZ1kyOXVaR2wwYVc5dWN6cGNiaTh2WEc0dkx5QlVhR1VnWVdKdmRtVWdZMjl3ZVhKcFoyaDBJRzV2ZEdsalpTQmhibVFnZEdocGN5QndaWEp0YVhOemFXOXVJRzV2ZEdsalpTQnphR0ZzYkNCaVpTQnBibU5zZFdSbFpGeHVMeThnYVc0Z1lXeHNJR052Y0dsbGN5QnZjaUJ6ZFdKemRHRnVkR2xoYkNCd2IzSjBhVzl1Y3lCdlppQjBhR1VnVTI5bWRIZGhjbVV1WEc0dkwxeHVMeThnVkVoRklGTlBSbFJYUVZKRklFbFRJRkJTVDFaSlJFVkVJRndpUVZNZ1NWTmNJaXdnVjBsVVNFOVZWQ0JYUVZKU1FVNVVXU0JQUmlCQlRsa2dTMGxPUkN3Z1JWaFFVa1ZUVTF4dUx5OGdUMUlnU1UxUVRFbEZSQ3dnU1U1RFRGVkVTVTVISUVKVlZDQk9UMVFnVEVsTlNWUkZSQ0JVVHlCVVNFVWdWMEZTVWtGT1ZFbEZVeUJQUmx4dUx5OGdUVVZTUTBoQlRsUkJRa2xNU1ZSWkxDQkdTVlJPUlZOVElFWlBVaUJCSUZCQlVsUkpRMVZNUVZJZ1VGVlNVRTlUUlNCQlRrUWdUazlPU1U1R1VrbE9SMFZOUlU1VUxpQkpUbHh1THk4Z1RrOGdSVlpGVGxRZ1UwaEJURXdnVkVoRklFRlZWRWhQVWxNZ1QxSWdRMDlRV1ZKSlIwaFVJRWhQVEVSRlVsTWdRa1VnVEVsQlFreEZJRVpQVWlCQlRsa2dRMHhCU1Uwc1hHNHZMeUJFUVUxQlIwVlRJRTlTSUU5VVNFVlNJRXhKUVVKSlRFbFVXU3dnVjBoRlZFaEZVaUJKVGlCQlRpQkJRMVJKVDA0Z1QwWWdRMDlPVkZKQlExUXNJRlJQVWxRZ1QxSmNiaTh2SUU5VVNFVlNWMGxUUlN3Z1FWSkpVMGxPUnlCR1VrOU5MQ0JQVlZRZ1QwWWdUMUlnU1U0Z1EwOU9Ua1ZEVkVsUFRpQlhTVlJJSUZSSVJTQlRUMFpVVjBGU1JTQlBVaUJVU0VWY2JpOHZJRlZUUlNCUFVpQlBWRWhGVWlCRVJVRk1TVTVIVXlCSlRpQlVTRVVnVTA5R1ZGZEJVa1V1WEc1Y2JpOHZJSEpsYzI5c2RtVnpJQzRnWVc1a0lDNHVJR1ZzWlcxbGJuUnpJR2x1SUdFZ2NHRjBhQ0JoY25KaGVTQjNhWFJvSUdScGNtVmpkRzl5ZVNCdVlXMWxjeUIwYUdWeVpWeHVMeThnYlhWemRDQmlaU0J1YnlCemJHRnphR1Z6TENCbGJYQjBlU0JsYkdWdFpXNTBjeXdnYjNJZ1pHVjJhV05sSUc1aGJXVnpJQ2hqT2x4Y0tTQnBiaUIwYUdVZ1lYSnlZWGxjYmk4dklDaHpieUJoYkhOdklHNXZJR3hsWVdScGJtY2dZVzVrSUhSeVlXbHNhVzVuSUhOc1lYTm9aWE1nTFNCcGRDQmtiMlZ6SUc1dmRDQmthWE4wYVc1bmRXbHphRnh1THk4Z2NtVnNZWFJwZG1VZ1lXNWtJR0ZpYzI5c2RYUmxJSEJoZEdoektWeHVablZ1WTNScGIyNGdibTl5YldGc2FYcGxRWEp5WVhrb2NHRnlkSE1zSUdGc2JHOTNRV0p2ZG1WU2IyOTBLU0I3WEc0Z0lDOHZJR2xtSUhSb1pTQndZWFJvSUhSeWFXVnpJSFJ2SUdkdklHRmliM1psSUhSb1pTQnliMjkwTENCZ2RYQmdJR1Z1WkhNZ2RYQWdQaUF3WEc0Z0lIWmhjaUIxY0NBOUlEQTdYRzRnSUdadmNpQW9kbUZ5SUdrZ1BTQndZWEowY3k1c1pXNW5kR2dnTFNBeE95QnBJRDQ5SURBN0lHa3RMU2tnZTF4dUlDQWdJSFpoY2lCc1lYTjBJRDBnY0dGeWRITmJhVjA3WEc0Z0lDQWdhV1lnS0d4aGMzUWdQVDA5SUNjdUp5a2dlMXh1SUNBZ0lDQWdjR0Z5ZEhNdWMzQnNhV05sS0drc0lERXBPMXh1SUNBZ0lIMGdaV3h6WlNCcFppQW9iR0Z6ZENBOVBUMGdKeTR1SnlrZ2UxeHVJQ0FnSUNBZ2NHRnlkSE11YzNCc2FXTmxLR2tzSURFcE8xeHVJQ0FnSUNBZ2RYQXJLenRjYmlBZ0lDQjlJR1ZzYzJVZ2FXWWdLSFZ3S1NCN1hHNGdJQ0FnSUNCd1lYSjBjeTV6Y0d4cFkyVW9hU3dnTVNrN1hHNGdJQ0FnSUNCMWNDMHRPMXh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJQzh2SUdsbUlIUm9aU0J3WVhSb0lHbHpJR0ZzYkc5M1pXUWdkRzhnWjI4Z1lXSnZkbVVnZEdobElISnZiM1FzSUhKbGMzUnZjbVVnYkdWaFpHbHVaeUF1TG5OY2JpQWdhV1lnS0dGc2JHOTNRV0p2ZG1WU2IyOTBLU0I3WEc0Z0lDQWdabTl5SUNnN0lIVndMUzA3SUhWd0tTQjdYRzRnSUNBZ0lDQndZWEowY3k1MWJuTm9hV1owS0NjdUxpY3BPMXh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJSEpsZEhWeWJpQndZWEowY3p0Y2JuMWNibHh1THk4Z1UzQnNhWFFnWVNCbWFXeGxibUZ0WlNCcGJuUnZJRnR5YjI5MExDQmthWElzSUdKaGMyVnVZVzFsTENCbGVIUmRMQ0IxYm1sNElIWmxjbk5wYjI1Y2JpOHZJQ2R5YjI5MEp5QnBjeUJxZFhOMElHRWdjMnhoYzJnc0lHOXlJRzV2ZEdocGJtY3VYRzUyWVhJZ2MzQnNhWFJRWVhSb1VtVWdQVnh1SUNBZ0lDOWVLRnhjTHo5OEtTaGJYRnh6WEZ4VFhTby9LU2dvUHpwY1hDNTdNU3d5Zlh4YlhseGNMMTByUDN3cEtGeGNMbHRlTGx4Y0wxMHFmQ2twS0Q4NlcxeGNMMTBxS1NRdk8xeHVkbUZ5SUhOd2JHbDBVR0YwYUNBOUlHWjFibU4wYVc5dUtHWnBiR1Z1WVcxbEtTQjdYRzRnSUhKbGRIVnliaUJ6Y0d4cGRGQmhkR2hTWlM1bGVHVmpLR1pwYkdWdVlXMWxLUzV6YkdsalpTZ3hLVHRjYm4wN1hHNWNiaTh2SUhCaGRHZ3VjbVZ6YjJ4MlpTaGJabkp2YlNBdUxpNWRMQ0IwYnlsY2JpOHZJSEJ2YzJsNElIWmxjbk5wYjI1Y2JtVjRjRzl5ZEhNdWNtVnpiMngyWlNBOUlHWjFibU4wYVc5dUtDa2dlMXh1SUNCMllYSWdjbVZ6YjJ4MlpXUlFZWFJvSUQwZ0p5Y3NYRzRnSUNBZ0lDQnlaWE52YkhabFpFRmljMjlzZFhSbElEMGdabUZzYzJVN1hHNWNiaUFnWm05eUlDaDJZWElnYVNBOUlHRnlaM1Z0Wlc1MGN5NXNaVzVuZEdnZ0xTQXhPeUJwSUQ0OUlDMHhJQ1ltSUNGeVpYTnZiSFpsWkVGaWMyOXNkWFJsT3lCcExTMHBJSHRjYmlBZ0lDQjJZWElnY0dGMGFDQTlJQ2hwSUQ0OUlEQXBJRDhnWVhKbmRXMWxiblJ6VzJsZElEb2djSEp2WTJWemN5NWpkMlFvS1R0Y2JseHVJQ0FnSUM4dklGTnJhWEFnWlcxd2RIa2dZVzVrSUdsdWRtRnNhV1FnWlc1MGNtbGxjMXh1SUNBZ0lHbG1JQ2gwZVhCbGIyWWdjR0YwYUNBaFBUMGdKM04wY21sdVp5Y3BJSHRjYmlBZ0lDQWdJSFJvY205M0lHNWxkeUJVZVhCbFJYSnliM0lvSjBGeVozVnRaVzUwY3lCMGJ5QndZWFJvTG5KbGMyOXNkbVVnYlhWemRDQmlaU0J6ZEhKcGJtZHpKeWs3WEc0Z0lDQWdmU0JsYkhObElHbG1JQ2doY0dGMGFDa2dlMXh1SUNBZ0lDQWdZMjl1ZEdsdWRXVTdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2NtVnpiMngyWldSUVlYUm9JRDBnY0dGMGFDQXJJQ2N2SnlBcklISmxjMjlzZG1Wa1VHRjBhRHRjYmlBZ0lDQnlaWE52YkhabFpFRmljMjlzZFhSbElEMGdjR0YwYUM1amFHRnlRWFFvTUNrZ1BUMDlJQ2N2Snp0Y2JpQWdmVnh1WEc0Z0lDOHZJRUYwSUhSb2FYTWdjRzlwYm5RZ2RHaGxJSEJoZEdnZ2MyaHZkV3hrSUdKbElISmxjMjlzZG1Wa0lIUnZJR0VnWm5Wc2JDQmhZbk52YkhWMFpTQndZWFJvTENCaWRYUmNiaUFnTHk4Z2FHRnVaR3hsSUhKbGJHRjBhWFpsSUhCaGRHaHpJSFJ2SUdKbElITmhabVVnS0cxcFoyaDBJR2hoY0hCbGJpQjNhR1Z1SUhCeWIyTmxjM011WTNka0tDa2dabUZwYkhNcFhHNWNiaUFnTHk4Z1RtOXliV0ZzYVhwbElIUm9aU0J3WVhSb1hHNGdJSEpsYzI5c2RtVmtVR0YwYUNBOUlHNXZjbTFoYkdsNlpVRnljbUY1S0dacGJIUmxjaWh5WlhOdmJIWmxaRkJoZEdndWMzQnNhWFFvSnk4bktTd2dablZ1WTNScGIyNG9jQ2tnZTF4dUlDQWdJSEpsZEhWeWJpQWhJWEE3WEc0Z0lIMHBMQ0FoY21WemIyeDJaV1JCWW5OdmJIVjBaU2t1YW05cGJpZ25MeWNwTzF4dVhHNGdJSEpsZEhWeWJpQW9LSEpsYzI5c2RtVmtRV0p6YjJ4MWRHVWdQeUFuTHljZ09pQW5KeWtnS3lCeVpYTnZiSFpsWkZCaGRHZ3BJSHg4SUNjdUp6dGNibjA3WEc1Y2JpOHZJSEJoZEdndWJtOXliV0ZzYVhwbEtIQmhkR2dwWEc0dkx5QndiM05wZUNCMlpYSnphVzl1WEc1bGVIQnZjblJ6TG01dmNtMWhiR2w2WlNBOUlHWjFibU4wYVc5dUtIQmhkR2dwSUh0Y2JpQWdkbUZ5SUdselFXSnpiMngxZEdVZ1BTQmxlSEJ2Y25SekxtbHpRV0p6YjJ4MWRHVW9jR0YwYUNrc1hHNGdJQ0FnSUNCMGNtRnBiR2x1WjFOc1lYTm9JRDBnYzNWaWMzUnlLSEJoZEdnc0lDMHhLU0E5UFQwZ0p5OG5PMXh1WEc0Z0lDOHZJRTV2Y20xaGJHbDZaU0IwYUdVZ2NHRjBhRnh1SUNCd1lYUm9JRDBnYm05eWJXRnNhWHBsUVhKeVlYa29abWxzZEdWeUtIQmhkR2d1YzNCc2FYUW9KeThuS1N3Z1puVnVZM1JwYjI0b2NDa2dlMXh1SUNBZ0lISmxkSFZ5YmlBaElYQTdYRzRnSUgwcExDQWhhWE5CWW5OdmJIVjBaU2t1YW05cGJpZ25MeWNwTzF4dVhHNGdJR2xtSUNnaGNHRjBhQ0FtSmlBaGFYTkJZbk52YkhWMFpTa2dlMXh1SUNBZ0lIQmhkR2dnUFNBbkxpYzdYRzRnSUgxY2JpQWdhV1lnS0hCaGRHZ2dKaVlnZEhKaGFXeHBibWRUYkdGemFDa2dlMXh1SUNBZ0lIQmhkR2dnS3owZ0p5OG5PMXh1SUNCOVhHNWNiaUFnY21WMGRYSnVJQ2hwYzBGaWMyOXNkWFJsSUQ4Z0p5OG5JRG9nSnljcElDc2djR0YwYUR0Y2JuMDdYRzVjYmk4dklIQnZjMmw0SUhabGNuTnBiMjVjYm1WNGNHOXlkSE11YVhOQlluTnZiSFYwWlNBOUlHWjFibU4wYVc5dUtIQmhkR2dwSUh0Y2JpQWdjbVYwZFhKdUlIQmhkR2d1WTJoaGNrRjBLREFwSUQwOVBTQW5MeWM3WEc1OU8xeHVYRzR2THlCd2IzTnBlQ0IyWlhKemFXOXVYRzVsZUhCdmNuUnpMbXB2YVc0Z1BTQm1kVzVqZEdsdmJpZ3BJSHRjYmlBZ2RtRnlJSEJoZEdoeklEMGdRWEp5WVhrdWNISnZkRzkwZVhCbExuTnNhV05sTG1OaGJHd29ZWEpuZFcxbGJuUnpMQ0F3S1R0Y2JpQWdjbVYwZFhKdUlHVjRjRzl5ZEhNdWJtOXliV0ZzYVhwbEtHWnBiSFJsY2lod1lYUm9jeXdnWm5WdVkzUnBiMjRvY0N3Z2FXNWtaWGdwSUh0Y2JpQWdJQ0JwWmlBb2RIbHdaVzltSUhBZ0lUMDlJQ2R6ZEhKcGJtY25LU0I3WEc0Z0lDQWdJQ0IwYUhKdmR5QnVaWGNnVkhsd1pVVnljbTl5S0NkQmNtZDFiV1Z1ZEhNZ2RHOGdjR0YwYUM1cWIybHVJRzExYzNRZ1ltVWdjM1J5YVc1bmN5Y3BPMXh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnY0R0Y2JpQWdmU2t1YW05cGJpZ25MeWNwS1R0Y2JuMDdYRzVjYmx4dUx5OGdjR0YwYUM1eVpXeGhkR2wyWlNobWNtOXRMQ0IwYnlsY2JpOHZJSEJ2YzJsNElIWmxjbk5wYjI1Y2JtVjRjRzl5ZEhNdWNtVnNZWFJwZG1VZ1BTQm1kVzVqZEdsdmJpaG1jbTl0TENCMGJ5a2dlMXh1SUNCbWNtOXRJRDBnWlhod2IzSjBjeTV5WlhOdmJIWmxLR1p5YjIwcExuTjFZbk4wY2lneEtUdGNiaUFnZEc4Z1BTQmxlSEJ2Y25SekxuSmxjMjlzZG1Vb2RHOHBMbk4xWW5OMGNpZ3hLVHRjYmx4dUlDQm1kVzVqZEdsdmJpQjBjbWx0S0dGeWNpa2dlMXh1SUNBZ0lIWmhjaUJ6ZEdGeWRDQTlJREE3WEc0Z0lDQWdabTl5SUNnN0lITjBZWEowSUR3Z1lYSnlMbXhsYm1kMGFEc2djM1JoY25Rckt5a2dlMXh1SUNBZ0lDQWdhV1lnS0dGeWNsdHpkR0Z5ZEYwZ0lUMDlJQ2NuS1NCaWNtVmhhenRjYmlBZ0lDQjlYRzVjYmlBZ0lDQjJZWElnWlc1a0lEMGdZWEp5TG14bGJtZDBhQ0F0SURFN1hHNGdJQ0FnWm05eUlDZzdJR1Z1WkNBK1BTQXdPeUJsYm1RdExTa2dlMXh1SUNBZ0lDQWdhV1lnS0dGeWNsdGxibVJkSUNFOVBTQW5KeWtnWW5KbFlXczdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2FXWWdLSE4wWVhKMElENGdaVzVrS1NCeVpYUjFjbTRnVzEwN1hHNGdJQ0FnY21WMGRYSnVJR0Z5Y2k1emJHbGpaU2h6ZEdGeWRDd2daVzVrSUMwZ2MzUmhjblFnS3lBeEtUdGNiaUFnZlZ4dVhHNGdJSFpoY2lCbWNtOXRVR0Z5ZEhNZ1BTQjBjbWx0S0daeWIyMHVjM0JzYVhRb0p5OG5LU2s3WEc0Z0lIWmhjaUIwYjFCaGNuUnpJRDBnZEhKcGJTaDBieTV6Y0d4cGRDZ25MeWNwS1R0Y2JseHVJQ0IyWVhJZ2JHVnVaM1JvSUQwZ1RXRjBhQzV0YVc0b1puSnZiVkJoY25SekxteGxibWQwYUN3Z2RHOVFZWEowY3k1c1pXNW5kR2dwTzF4dUlDQjJZWElnYzJGdFpWQmhjblJ6VEdWdVozUm9JRDBnYkdWdVozUm9PMXh1SUNCbWIzSWdLSFpoY2lCcElEMGdNRHNnYVNBOElHeGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdhV1lnS0daeWIyMVFZWEowYzF0cFhTQWhQVDBnZEc5UVlYSjBjMXRwWFNrZ2UxeHVJQ0FnSUNBZ2MyRnRaVkJoY25SelRHVnVaM1JvSUQwZ2FUdGNiaUFnSUNBZ0lHSnlaV0ZyTzF4dUlDQWdJSDFjYmlBZ2ZWeHVYRzRnSUhaaGNpQnZkWFJ3ZFhSUVlYSjBjeUE5SUZ0ZE8xeHVJQ0JtYjNJZ0tIWmhjaUJwSUQwZ2MyRnRaVkJoY25SelRHVnVaM1JvT3lCcElEd2dabkp2YlZCaGNuUnpMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnYjNWMGNIVjBVR0Z5ZEhNdWNIVnphQ2duTGk0bktUdGNiaUFnZlZ4dVhHNGdJRzkxZEhCMWRGQmhjblJ6SUQwZ2IzVjBjSFYwVUdGeWRITXVZMjl1WTJGMEtIUnZVR0Z5ZEhNdWMyeHBZMlVvYzJGdFpWQmhjblJ6VEdWdVozUm9LU2s3WEc1Y2JpQWdjbVYwZFhKdUlHOTFkSEIxZEZCaGNuUnpMbXB2YVc0b0p5OG5LVHRjYm4wN1hHNWNibVY0Y0c5eWRITXVjMlZ3SUQwZ0p5OG5PMXh1Wlhod2IzSjBjeTVrWld4cGJXbDBaWElnUFNBbk9pYzdYRzVjYm1WNGNHOXlkSE11WkdseWJtRnRaU0E5SUdaMWJtTjBhVzl1S0hCaGRHZ3BJSHRjYmlBZ2RtRnlJSEpsYzNWc2RDQTlJSE53YkdsMFVHRjBhQ2h3WVhSb0tTeGNiaUFnSUNBZ0lISnZiM1FnUFNCeVpYTjFiSFJiTUYwc1hHNGdJQ0FnSUNCa2FYSWdQU0J5WlhOMWJIUmJNVjA3WEc1Y2JpQWdhV1lnS0NGeWIyOTBJQ1ltSUNGa2FYSXBJSHRjYmlBZ0lDQXZMeUJPYnlCa2FYSnVZVzFsSUhkb1lYUnpiMlYyWlhKY2JpQWdJQ0J5WlhSMWNtNGdKeTRuTzF4dUlDQjlYRzVjYmlBZ2FXWWdLR1JwY2lrZ2UxeHVJQ0FnSUM4dklFbDBJR2hoY3lCaElHUnBjbTVoYldVc0lITjBjbWx3SUhSeVlXbHNhVzVuSUhOc1lYTm9YRzRnSUNBZ1pHbHlJRDBnWkdseUxuTjFZbk4wY2lnd0xDQmthWEl1YkdWdVozUm9JQzBnTVNrN1hHNGdJSDFjYmx4dUlDQnlaWFIxY200Z2NtOXZkQ0FySUdScGNqdGNibjA3WEc1Y2JseHVaWGh3YjNKMGN5NWlZWE5sYm1GdFpTQTlJR1oxYm1OMGFXOXVLSEJoZEdnc0lHVjRkQ2tnZTF4dUlDQjJZWElnWmlBOUlITndiR2wwVUdGMGFDaHdZWFJvS1ZzeVhUdGNiaUFnTHk4Z1ZFOUVUem9nYldGclpTQjBhR2x6SUdOdmJYQmhjbWx6YjI0Z1kyRnpaUzFwYm5ObGJuTnBkR2wyWlNCdmJpQjNhVzVrYjNkelAxeHVJQ0JwWmlBb1pYaDBJQ1ltSUdZdWMzVmljM1J5S0MweElDb2daWGgwTG14bGJtZDBhQ2tnUFQwOUlHVjRkQ2tnZTF4dUlDQWdJR1lnUFNCbUxuTjFZbk4wY2lnd0xDQm1MbXhsYm1kMGFDQXRJR1Y0ZEM1c1pXNW5kR2dwTzF4dUlDQjlYRzRnSUhKbGRIVnliaUJtTzF4dWZUdGNibHh1WEc1bGVIQnZjblJ6TG1WNGRHNWhiV1VnUFNCbWRXNWpkR2x2Ymlod1lYUm9LU0I3WEc0Z0lISmxkSFZ5YmlCemNHeHBkRkJoZEdnb2NHRjBhQ2xiTTEwN1hHNTlPMXh1WEc1bWRXNWpkR2x2YmlCbWFXeDBaWElnS0hoekxDQm1LU0I3WEc0Z0lDQWdhV1lnS0hoekxtWnBiSFJsY2lrZ2NtVjBkWEp1SUhoekxtWnBiSFJsY2lobUtUdGNiaUFnSUNCMllYSWdjbVZ6SUQwZ1cxMDdYRzRnSUNBZ1ptOXlJQ2gyWVhJZ2FTQTlJREE3SUdrZ1BDQjRjeTVzWlc1bmRHZzdJR2tyS3lrZ2UxeHVJQ0FnSUNBZ0lDQnBaaUFvWmloNGMxdHBYU3dnYVN3Z2VITXBLU0J5WlhNdWNIVnphQ2g0YzF0cFhTazdYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGRIVnliaUJ5WlhNN1hHNTlYRzVjYmk4dklGTjBjbWx1Wnk1d2NtOTBiM1I1Y0dVdWMzVmljM1J5SUMwZ2JtVm5ZWFJwZG1VZ2FXNWtaWGdnWkc5dUozUWdkMjl5YXlCcGJpQkpSVGhjYm5aaGNpQnpkV0p6ZEhJZ1BTQW5ZV0luTG5OMVluTjBjaWd0TVNrZ1BUMDlJQ2RpSjF4dUlDQWdJRDhnWm5WdVkzUnBiMjRnS0hOMGNpd2djM1JoY25Rc0lHeGxiaWtnZXlCeVpYUjFjbTRnYzNSeUxuTjFZbk4wY2loemRHRnlkQ3dnYkdWdUtTQjlYRzRnSUNBZ09pQm1kVzVqZEdsdmJpQW9jM1J5TENCemRHRnlkQ3dnYkdWdUtTQjdYRzRnSUNBZ0lDQWdJR2xtSUNoemRHRnlkQ0E4SURBcElITjBZWEowSUQwZ2MzUnlMbXhsYm1kMGFDQXJJSE4wWVhKME8xeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2MzUnlMbk4xWW5OMGNpaHpkR0Z5ZEN3Z2JHVnVLVHRjYmlBZ0lDQjlYRzQ3WEc0aVhYMD0iLCJcInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gcGlja09uZUJ5V2VpZ2h0O1xuXG5mdW5jdGlvbiBwaWNrT25lQnlXZWlnaHQoYW5PYmopIHtcbiAgdmFyIF9rZXlzID0gT2JqZWN0LmtleXMoYW5PYmopO1xuICB2YXIgc3VtID0gX2tleXMucmVkdWNlKGZ1bmN0aW9uIChwLCBjKSB7XG4gICAgcmV0dXJuIHAgKyBhbk9ialtjXTtcbiAgfSwgMCk7XG4gIGlmICghTnVtYmVyLmlzRmluaXRlKHN1bSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJBbGwgdmFsdWVzIGluIG9iamVjdCBtdXN0IGJlIGEgbnVtZXJpYyB2YWx1ZVwiKTtcbiAgfVxuICB2YXIgY2hvb3NlID0gfiB+KE1hdGgucmFuZG9tKCkgKiBzdW0pO1xuICBmb3IgKHZhciBpID0gMCwgY291bnQgPSAwOyBpIDwgX2tleXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb3VudCArPSBhbk9ialtfa2V5c1tpXV07XG4gICAgaWYgKGNvdW50ID4gY2hvb3NlKSB7XG4gICAgICByZXR1cm4gX2tleXNbaV07XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0c1tcImRlZmF1bHRcIl07IiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxucHJvY2Vzcy5uZXh0VGljayA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNhblNldEltbWVkaWF0ZSA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnNldEltbWVkaWF0ZTtcbiAgICB2YXIgY2FuUG9zdCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnBvc3RNZXNzYWdlICYmIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyXG4gICAgO1xuXG4gICAgaWYgKGNhblNldEltbWVkaWF0ZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGYpIHsgcmV0dXJuIHdpbmRvdy5zZXRJbW1lZGlhdGUoZikgfTtcbiAgICB9XG5cbiAgICBpZiAoY2FuUG9zdCkge1xuICAgICAgICB2YXIgcXVldWUgPSBbXTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIHZhciBzb3VyY2UgPSBldi5zb3VyY2U7XG4gICAgICAgICAgICBpZiAoKHNvdXJjZSA9PT0gd2luZG93IHx8IHNvdXJjZSA9PT0gbnVsbCkgJiYgZXYuZGF0YSA9PT0gJ3Byb2Nlc3MtdGljaycpIHtcbiAgICAgICAgICAgICAgICBldi5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm4gPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSgncHJvY2Vzcy10aWNrJywgJyonKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgfTtcbn0pKCk7XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufVxuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG4iXX0=
