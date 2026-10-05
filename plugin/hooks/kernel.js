// The kernel of Backseat Driver, compiled from PureScript (kernel/src in the repository) by scripts/build-kernel.sh. Do not edit: change the source and build again.

// output/Data.Array/foreign.js
var replicateFill = function(count, value) {
  if (count < 1) {
    return [];
  }
  var result = new Array(count);
  return result.fill(value);
};
var replicatePolyfill = function(count, value) {
  var result = [];
  var n = 0;
  for (var i = 0; i < count; i++) {
    result[n++] = value;
  }
  return result;
};
var replicateImpl = typeof Array.prototype.fill === "function" ? replicateFill : replicatePolyfill;
var length = function(xs) {
  return xs.length;
};
var findIndexImpl = function(just, nothing, f, xs) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (f(xs[i])) return just(i);
  }
  return nothing;
};
var filterImpl = function(f, xs) {
  return xs.filter(f);
};
var sortByImpl = /* @__PURE__ */ (function() {
  function mergeFromTo(compare2, fromOrdering, xs1, xs2, from, to) {
    var mid;
    var i;
    var j;
    var k;
    var x;
    var y;
    var c;
    mid = from + (to - from >> 1);
    if (mid - from > 1) mergeFromTo(compare2, fromOrdering, xs2, xs1, from, mid);
    if (to - mid > 1) mergeFromTo(compare2, fromOrdering, xs2, xs1, mid, to);
    i = from;
    j = mid;
    k = from;
    while (i < mid && j < to) {
      x = xs2[i];
      y = xs2[j];
      c = fromOrdering(compare2(x)(y));
      if (c > 0) {
        xs1[k++] = y;
        ++j;
      } else {
        xs1[k++] = x;
        ++i;
      }
    }
    while (i < mid) {
      xs1[k++] = xs2[i++];
    }
    while (j < to) {
      xs1[k++] = xs2[j++];
    }
  }
  return function(compare2, fromOrdering, xs) {
    var out;
    if (xs.length < 2) return xs;
    out = xs.slice(0);
    mergeFromTo(compare2, fromOrdering, out, xs.slice(0), 0, xs.length);
    return out;
  };
})();
var sliceImpl = function(s, e, l) {
  return l.slice(s, e);
};
var anyImpl = function(p, xs) {
  var len = xs.length;
  for (var i = 0; i < len; i++) {
    if (p(xs[i])) return true;
  }
  return false;
};
var unsafeIndexImpl = function(xs, n) {
  return xs[n];
};

// output/Data.Functor/foreign.js
var arrayMap = function(f) {
  return function(arr) {
    var l = arr.length;
    var result = new Array(l);
    for (var i = 0; i < l; i++) {
      result[i] = f(arr[i]);
    }
    return result;
  };
};

// output/Control.Semigroupoid/index.js
var semigroupoidFn = {
  compose: function(f) {
    return function(g) {
      return function(x) {
        return f(g(x));
      };
    };
  }
};

// output/Control.Category/index.js
var identity = function(dict) {
  return dict.identity;
};
var categoryFn = {
  identity: function(x) {
    return x;
  },
  Semigroupoid0: function() {
    return semigroupoidFn;
  }
};

// output/Data.Boolean/index.js
var otherwise = true;

// output/Data.Function/index.js
var $$const = function(a) {
  return function(v) {
    return a;
  };
};

// output/Data.Unit/foreign.js
var unit = void 0;

// output/Data.Functor/index.js
var map = function(dict) {
  return dict.map;
};
var $$void = function(dictFunctor) {
  return map(dictFunctor)($$const(unit));
};
var functorArray = {
  map: arrayMap
};

// output/Data.Semigroup/foreign.js
var concatArray = function(xs) {
  return function(ys) {
    if (xs.length === 0) return ys;
    if (ys.length === 0) return xs;
    return xs.concat(ys);
  };
};

// output/Data.Semigroup/index.js
var semigroupArray = {
  append: concatArray
};
var append = function(dict) {
  return dict.append;
};

// output/Control.Applicative/index.js
var pure = function(dict) {
  return dict.pure;
};
var when = function(dictApplicative) {
  var pure1 = pure(dictApplicative);
  return function(v) {
    return function(v1) {
      if (v) {
        return v1;
      }
      ;
      if (!v) {
        return pure1(unit);
      }
      ;
      throw new Error("Failed pattern match at Control.Applicative (line 63, column 1 - line 63, column 63): " + [v.constructor.name, v1.constructor.name]);
    };
  };
};

// output/Control.Bind/foreign.js
var arrayBind = typeof Array.prototype.flatMap === "function" ? function(arr) {
  return function(f) {
    return arr.flatMap(f);
  };
} : function(arr) {
  return function(f) {
    var result = [];
    var l = arr.length;
    for (var i = 0; i < l; i++) {
      var xs = f(arr[i]);
      var k = xs.length;
      for (var j = 0; j < k; j++) {
        result.push(xs[j]);
      }
    }
    return result;
  };
};

// output/Control.Bind/index.js
var bind = function(dict) {
  return dict.bind;
};

// output/Control.Monad/index.js
var ap = function(dictMonad) {
  var bind2 = bind(dictMonad.Bind1());
  var pure2 = pure(dictMonad.Applicative0());
  return function(f) {
    return function(a) {
      return bind2(f)(function(f$prime) {
        return bind2(a)(function(a$prime) {
          return pure2(f$prime(a$prime));
        });
      });
    };
  };
};

// output/Data.Bounded/foreign.js
var topChar = String.fromCharCode(65535);
var bottomChar = String.fromCharCode(0);
var topNumber = Number.POSITIVE_INFINITY;
var bottomNumber = Number.NEGATIVE_INFINITY;

// output/Data.Ord/foreign.js
var unsafeCompareImpl = function(lt) {
  return function(eq2) {
    return function(gt) {
      return function(x) {
        return function(y) {
          return x < y ? lt : x === y ? eq2 : gt;
        };
      };
    };
  };
};
var ordIntImpl = unsafeCompareImpl;
var ordNumberImpl = unsafeCompareImpl;

// output/Data.Eq/foreign.js
var refEq = function(r1) {
  return function(r2) {
    return r1 === r2;
  };
};
var eqIntImpl = refEq;
var eqNumberImpl = refEq;
var eqStringImpl = refEq;

// output/Data.Eq/index.js
var eqString = {
  eq: eqStringImpl
};
var eqNumber = {
  eq: eqNumberImpl
};
var eqInt = {
  eq: eqIntImpl
};
var eq = function(dict) {
  return dict.eq;
};

// output/Data.Ordering/index.js
var LT = /* @__PURE__ */ (function() {
  function LT2() {
  }
  ;
  LT2.value = new LT2();
  return LT2;
})();
var GT = /* @__PURE__ */ (function() {
  function GT2() {
  }
  ;
  GT2.value = new GT2();
  return GT2;
})();
var EQ = /* @__PURE__ */ (function() {
  function EQ2() {
  }
  ;
  EQ2.value = new EQ2();
  return EQ2;
})();

// output/Data.Ord/index.js
var ordNumber = /* @__PURE__ */ (function() {
  return {
    compare: ordNumberImpl(LT.value)(EQ.value)(GT.value),
    Eq0: function() {
      return eqNumber;
    }
  };
})();
var ordInt = /* @__PURE__ */ (function() {
  return {
    compare: ordIntImpl(LT.value)(EQ.value)(GT.value),
    Eq0: function() {
      return eqInt;
    }
  };
})();
var compare = function(dict) {
  return dict.compare;
};
var comparing = function(dictOrd) {
  var compare3 = compare(dictOrd);
  return function(f) {
    return function(x) {
      return function(y) {
        return compare3(f(x))(f(y));
      };
    };
  };
};
var max = function(dictOrd) {
  var compare3 = compare(dictOrd);
  return function(x) {
    return function(y) {
      var v = compare3(x)(y);
      if (v instanceof LT) {
        return y;
      }
      ;
      if (v instanceof EQ) {
        return x;
      }
      ;
      if (v instanceof GT) {
        return x;
      }
      ;
      throw new Error("Failed pattern match at Data.Ord (line 181, column 3 - line 184, column 12): " + [v.constructor.name]);
    };
  };
};
var min = function(dictOrd) {
  var compare3 = compare(dictOrd);
  return function(x) {
    return function(y) {
      var v = compare3(x)(y);
      if (v instanceof LT) {
        return x;
      }
      ;
      if (v instanceof EQ) {
        return x;
      }
      ;
      if (v instanceof GT) {
        return y;
      }
      ;
      throw new Error("Failed pattern match at Data.Ord (line 172, column 3 - line 175, column 12): " + [v.constructor.name]);
    };
  };
};
var clamp = function(dictOrd) {
  var min1 = min(dictOrd);
  var max13 = max(dictOrd);
  return function(low) {
    return function(hi) {
      return function(x) {
        return min1(hi)(max13(low)(x));
      };
    };
  };
};

// output/Data.Show/foreign.js
var showIntImpl = function(n) {
  return n.toString();
};

// output/Data.Show/index.js
var showInt = {
  show: showIntImpl
};
var show = function(dict) {
  return dict.show;
};

// output/Data.Maybe/index.js
var identity2 = /* @__PURE__ */ identity(categoryFn);
var Nothing = /* @__PURE__ */ (function() {
  function Nothing2() {
  }
  ;
  Nothing2.value = new Nothing2();
  return Nothing2;
})();
var Just = /* @__PURE__ */ (function() {
  function Just2(value0) {
    this.value0 = value0;
  }
  ;
  Just2.create = function(value0) {
    return new Just2(value0);
  };
  return Just2;
})();
var maybe = function(v) {
  return function(v1) {
    return function(v2) {
      if (v2 instanceof Nothing) {
        return v;
      }
      ;
      if (v2 instanceof Just) {
        return v1(v2.value0);
      }
      ;
      throw new Error("Failed pattern match at Data.Maybe (line 237, column 1 - line 237, column 51): " + [v.constructor.name, v1.constructor.name, v2.constructor.name]);
    };
  };
};
var isJust = /* @__PURE__ */ maybe(false)(/* @__PURE__ */ $$const(true));
var functorMaybe = {
  map: function(v) {
    return function(v1) {
      if (v1 instanceof Just) {
        return new Just(v(v1.value0));
      }
      ;
      return Nothing.value;
    };
  }
};
var fromMaybe = function(a) {
  return maybe(a)(identity2);
};
var eqMaybe = function(dictEq) {
  var eq2 = eq(dictEq);
  return {
    eq: function(x) {
      return function(y) {
        if (x instanceof Nothing && y instanceof Nothing) {
          return true;
        }
        ;
        if (x instanceof Just && y instanceof Just) {
          return eq2(x.value0)(y.value0);
        }
        ;
        return false;
      };
    }
  };
};

// output/Data.Monoid/index.js
var mempty = function(dict) {
  return dict.mempty;
};

// output/Control.Monad.ST.Internal/foreign.js
var map_ = function(f) {
  return function(a) {
    return function() {
      return f(a());
    };
  };
};
var pure_ = function(a) {
  return function() {
    return a;
  };
};
var bind_ = function(a) {
  return function(f) {
    return function() {
      return f(a())();
    };
  };
};
var foreach = function(as) {
  return function(f) {
    return function() {
      for (var i = 0, l = as.length; i < l; i++) {
        f(as[i])();
      }
    };
  };
};

// output/Control.Monad.ST.Internal/index.js
var $runtime_lazy = function(name, moduleName, init) {
  var state = 0;
  var val;
  return function(lineNumber) {
    if (state === 2) return val;
    if (state === 1) throw new ReferenceError(name + " was needed before it finished initializing (module " + moduleName + ", line " + lineNumber + ")", moduleName, lineNumber);
    state = 1;
    val = init();
    state = 2;
    return val;
  };
};
var functorST = {
  map: map_
};
var monadST = {
  Applicative0: function() {
    return applicativeST;
  },
  Bind1: function() {
    return bindST;
  }
};
var bindST = {
  bind: bind_,
  Apply0: function() {
    return $lazy_applyST(0);
  }
};
var applicativeST = {
  pure: pure_,
  Apply0: function() {
    return $lazy_applyST(0);
  }
};
var $lazy_applyST = /* @__PURE__ */ $runtime_lazy("applyST", "Control.Monad.ST.Internal", function() {
  return {
    apply: ap(monadST),
    Functor0: function() {
      return functorST;
    }
  };
});

// output/Data.Array.ST/foreign.js
function newSTArray() {
  return [];
}
function unsafeFreezeThawImpl(xs) {
  return xs;
}
var unsafeFreezeImpl = unsafeFreezeThawImpl;
function copyImpl(xs) {
  return xs.slice();
}
var thawImpl = copyImpl;
var pushImpl = function(a, xs) {
  return xs.push(a);
};

// output/Control.Monad.ST.Uncurried/foreign.js
var runSTFn1 = function runSTFn12(fn) {
  return function(a) {
    return function() {
      return fn(a);
    };
  };
};
var runSTFn2 = function runSTFn22(fn) {
  return function(a) {
    return function(b) {
      return function() {
        return fn(a, b);
      };
    };
  };
};

// output/Data.Array.ST/index.js
var unsafeFreeze = /* @__PURE__ */ runSTFn1(unsafeFreezeImpl);
var thaw = /* @__PURE__ */ runSTFn1(thawImpl);
var withArray = function(f) {
  return function(xs) {
    return function __do() {
      var result = thaw(xs)();
      f(result)();
      return unsafeFreeze(result)();
    };
  };
};
var push = /* @__PURE__ */ runSTFn2(pushImpl);

// output/Data.Foldable/foreign.js
var foldrArray = function(f) {
  return function(init) {
    return function(xs) {
      var acc = init;
      var len = xs.length;
      for (var i = len - 1; i >= 0; i--) {
        acc = f(xs[i])(acc);
      }
      return acc;
    };
  };
};
var foldlArray = function(f) {
  return function(init) {
    return function(xs) {
      var acc = init;
      var len = xs.length;
      for (var i = 0; i < len; i++) {
        acc = f(acc)(xs[i]);
      }
      return acc;
    };
  };
};

// output/Data.Foldable/index.js
var foldr = function(dict) {
  return dict.foldr;
};
var foldl = function(dict) {
  return dict.foldl;
};
var foldMapDefaultR = function(dictFoldable) {
  var foldr2 = foldr(dictFoldable);
  return function(dictMonoid) {
    var append2 = append(dictMonoid.Semigroup0());
    var mempty2 = mempty(dictMonoid);
    return function(f) {
      return foldr2(function(x) {
        return function(acc) {
          return append2(f(x))(acc);
        };
      })(mempty2);
    };
  };
};
var foldableArray = {
  foldr: foldrArray,
  foldl: foldlArray,
  foldMap: function(dictMonoid) {
    return foldMapDefaultR(foldableArray)(dictMonoid);
  }
};

// output/Data.Function.Uncurried/foreign.js
var runFn2 = function(fn) {
  return function(a) {
    return function(b) {
      return fn(a, b);
    };
  };
};
var runFn3 = function(fn) {
  return function(a) {
    return function(b) {
      return function(c) {
        return fn(a, b, c);
      };
    };
  };
};
var runFn4 = function(fn) {
  return function(a) {
    return function(b) {
      return function(c) {
        return function(d) {
          return fn(a, b, c, d);
        };
      };
    };
  };
};

// output/Data.Array/index.js
var $$void2 = /* @__PURE__ */ $$void(functorST);
var map2 = /* @__PURE__ */ map(functorMaybe);
var map22 = /* @__PURE__ */ map(functorST);
var when2 = /* @__PURE__ */ when(applicativeST);
var unsafeIndex = function() {
  return runFn2(unsafeIndexImpl);
};
var unsafeIndex1 = /* @__PURE__ */ unsafeIndex();
var sortBy = function(comp) {
  return runFn3(sortByImpl)(comp)(function(v) {
    if (v instanceof GT) {
      return 1;
    }
    ;
    if (v instanceof EQ) {
      return 0;
    }
    ;
    if (v instanceof LT) {
      return -1 | 0;
    }
    ;
    throw new Error("Failed pattern match at Data.Array (line 897, column 38 - line 900, column 11): " + [v.constructor.name]);
  });
};
var sortWith = function(dictOrd) {
  var comparing2 = comparing(dictOrd);
  return function(f) {
    return sortBy(comparing2(f));
  };
};
var snoc = function(xs) {
  return function(x) {
    return withArray(push(x))(xs)();
  };
};
var slice = /* @__PURE__ */ runFn3(sliceImpl);
var $$null = function(xs) {
  return length(xs) === 0;
};
var foldl2 = /* @__PURE__ */ foldl(foldableArray);
var findIndex = /* @__PURE__ */ (function() {
  return runFn4(findIndexImpl)(Just.create)(Nothing.value);
})();
var find2 = function(f) {
  return function(xs) {
    return map2(unsafeIndex1(xs))(findIndex(f)(xs));
  };
};
var filter = /* @__PURE__ */ runFn2(filterImpl);
var elemIndex = function(dictEq) {
  var eq2 = eq(dictEq);
  return function(x) {
    return findIndex(function(v) {
      return eq2(v)(x);
    });
  };
};
var elem2 = function(dictEq) {
  var elemIndex1 = elemIndex(dictEq);
  return function(a) {
    return function(arr) {
      return isJust(elemIndex1(a)(arr));
    };
  };
};
var drop = function(n) {
  return function(xs) {
    var $173 = n < 1;
    if ($173) {
      return xs;
    }
    ;
    return slice(n)(length(xs))(xs);
  };
};
var takeEnd = function(n) {
  return function(xs) {
    return drop(length(xs) - n | 0)(xs);
  };
};
var any2 = /* @__PURE__ */ runFn2(anyImpl);
var nubByEq = function(eq2) {
  return function(xs) {
    return (function __do() {
      var arr = newSTArray();
      foreach(xs)(function(x) {
        return function __do2() {
          var e = map22((function() {
            var $194 = any2(function(v) {
              return eq2(v)(x);
            });
            return function($195) {
              return !$194($195);
            };
          })())(unsafeFreeze(arr))();
          return when2(e)($$void2(push(x)(arr)))();
        };
      })();
      return unsafeFreeze(arr)();
    })();
  };
};

// output/Data.Int/foreign.js
var toNumber = function(n) {
  return n;
};

// output/Data.Number/foreign.js
var floor = Math.floor;
var pow = function(n) {
  return function(p) {
    return Math.pow(n, p);
  };
};
var round = Math.round;

// output/Data.String.Common/foreign.js
var replaceAll = function(s1) {
  return function(s2) {
    return function(s3) {
      return s3.replace(new RegExp(s1.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"), s2);
    };
  };
};
var joinWith = function(s) {
  return function(xs) {
    return xs.join(s);
  };
};

// output/Kernel.Health/index.js
var min3 = /* @__PURE__ */ min(ordNumber);
var max3 = /* @__PURE__ */ max(ordInt);
var max1 = /* @__PURE__ */ max(ordNumber);
var elem3 = /* @__PURE__ */ elem2(eqString);
var show2 = /* @__PURE__ */ show(showInt);
var RateLimit = /* @__PURE__ */ (function() {
  function RateLimit2() {
  }
  ;
  RateLimit2.value = new RateLimit2();
  return RateLimit2;
})();
var Overloaded = /* @__PURE__ */ (function() {
  function Overloaded2() {
  }
  ;
  Overloaded2.value = new Overloaded2();
  return Overloaded2;
})();
var Server = /* @__PURE__ */ (function() {
  function Server2() {
  }
  ;
  Server2.value = new Server2();
  return Server2;
})();
var Offline = /* @__PURE__ */ (function() {
  function Offline2() {
  }
  ;
  Offline2.value = new Offline2();
  return Offline2;
})();
var Timeout = /* @__PURE__ */ (function() {
  function Timeout2() {
  }
  ;
  Timeout2.value = new Timeout2();
  return Timeout2;
})();
var Account = /* @__PURE__ */ (function() {
  function Account2() {
  }
  ;
  Account2.value = new Account2();
  return Account2;
})();
var Job = /* @__PURE__ */ (function() {
  function Job2() {
  }
  ;
  Job2.value = new Job2();
  return Job2;
})();
var Reply = /* @__PURE__ */ (function() {
  function Reply2() {
  }
  ;
  Reply2.value = new Reply2();
  return Reply2;
})();
var Ok = /* @__PURE__ */ (function() {
  function Ok2() {
  }
  ;
  Ok2.value = new Ok2();
  return Ok2;
})();
var Waiting = /* @__PURE__ */ (function() {
  function Waiting3(value0) {
    this.value0 = value0;
  }
  ;
  Waiting3.create = function(value0) {
    return new Waiting3(value0);
  };
  return Waiting3;
})();
var Recovering = /* @__PURE__ */ (function() {
  function Recovering2(value0) {
    this.value0 = value0;
  }
  ;
  Recovering2.create = function(value0) {
    return new Recovering2(value0);
  };
  return Recovering2;
})();
var Probing = /* @__PURE__ */ (function() {
  function Probing2(value0) {
    this.value0 = value0;
  }
  ;
  Probing2.create = function(value0) {
    return new Probing2(value0);
  };
  return Probing2;
})();
var Blocked = /* @__PURE__ */ (function() {
  function Blocked2(value0) {
    this.value0 = value0;
  }
  ;
  Blocked2.create = function(value0) {
    return new Blocked2(value0);
  };
  return Blocked2;
})();
var Failed = /* @__PURE__ */ (function() {
  function Failed2(value0) {
    this.value0 = value0;
  }
  ;
  Failed2.create = function(value0) {
    return new Failed2(value0);
  };
  return Failed2;
})();
var Answered = /* @__PURE__ */ (function() {
  function Answered2() {
  }
  ;
  Answered2.value = new Answered2();
  return Answered2;
})();
var Due = /* @__PURE__ */ (function() {
  function Due2() {
  }
  ;
  Due2.value = new Due2();
  return Due2;
})();
var ProbingStarted = /* @__PURE__ */ (function() {
  function ProbingStarted2() {
  }
  ;
  ProbingStarted2.value = new ProbingStarted2();
  return ProbingStarted2;
})();
var Abandoned = /* @__PURE__ */ (function() {
  function Abandoned2() {
  }
  ;
  Abandoned2.value = new Abandoned2();
  return Abandoned2;
})();
var troubleTag = function(v) {
  if (v instanceof RateLimit) {
    return "rate-limit";
  }
  ;
  if (v instanceof Overloaded) {
    return "overloaded";
  }
  ;
  if (v instanceof Server) {
    return "server";
  }
  ;
  if (v instanceof Offline) {
    return "offline";
  }
  ;
  if (v instanceof Timeout) {
    return "timeout";
  }
  ;
  if (v instanceof Account) {
    return "account";
  }
  ;
  if (v instanceof Job) {
    return "job";
  }
  ;
  if (v instanceof Reply) {
    return "reply";
  }
  ;
  throw new Error("Failed pattern match at Kernel.Health (line 182, column 14 - line 190, column 19): " + [v.constructor.name]);
};
var troubleFromTag = function(v) {
  if (v === "rate-limit") {
    return RateLimit.value;
  }
  ;
  if (v === "overloaded") {
    return Overloaded.value;
  }
  ;
  if (v === "offline") {
    return Offline.value;
  }
  ;
  if (v === "timeout") {
    return Timeout.value;
  }
  ;
  if (v === "account") {
    return Account.value;
  }
  ;
  if (v === "job") {
    return Job.value;
  }
  ;
  if (v === "reply") {
    return Reply.value;
  }
  ;
  return Server.value;
};
var spaced = /* @__PURE__ */ replaceAll("_")(" ");
var resetSlackMs = 3e4;
var mayAsk = function(v) {
  if (v instanceof Ok) {
    return true;
  }
  ;
  if (v instanceof Recovering) {
    return true;
  }
  ;
  return false;
};
var longestWaitMs = 6e5;
var jobErrors = ["model_not_found", "invalid_request", "max_output_tokens"];
var healthToWire = function(v) {
  if (v instanceof Ok) {
    return {
      state: "ok",
      trouble: "",
      detail: "",
      until: 0,
      failures: 0
    };
  }
  ;
  if (v instanceof Waiting) {
    return {
      state: "waiting",
      trouble: troubleTag(v.value0.trouble),
      detail: v.value0.detail,
      until: v.value0.until,
      failures: v.value0.failures
    };
  }
  ;
  if (v instanceof Recovering) {
    return {
      state: "recovering",
      trouble: troubleTag(v.value0.trouble),
      detail: v.value0.detail,
      until: 0,
      failures: v.value0.failures
    };
  }
  ;
  if (v instanceof Probing) {
    return {
      state: "probing",
      trouble: troubleTag(v.value0.trouble),
      detail: v.value0.detail,
      until: 0,
      failures: v.value0.failures
    };
  }
  ;
  if (v instanceof Blocked) {
    return {
      state: "blocked",
      trouble: "",
      detail: v.value0.detail,
      until: 0,
      failures: 0
    };
  }
  ;
  throw new Error("Failed pattern match at Kernel.Health (line 222, column 16 - line 227, column 92): " + [v.constructor.name]);
};
var healthFromWire = function(w) {
  if (w.state === "waiting") {
    return new Waiting({
      trouble: troubleFromTag(w.trouble),
      detail: w.detail,
      until: w.until,
      failures: w.failures
    });
  }
  ;
  if (w.state === "recovering") {
    return new Recovering({
      trouble: troubleFromTag(w.trouble),
      detail: w.detail,
      failures: w.failures
    });
  }
  ;
  if (w.state === "probing") {
    return new Probing({
      trouble: troubleFromTag(w.trouble),
      detail: w.detail,
      failures: w.failures
    });
  }
  ;
  if (w.state === "blocked") {
    return new Blocked({
      detail: w.detail
    });
  }
  ;
  return Ok.value;
};
var mayAskWire = function($89) {
  return mayAsk(healthFromWire($89));
};
var firstWaitOfflineMs = 15e3;
var firstWaitMs = 3e4;
var failedWith = function(trouble) {
  return function(detail) {
    return {
      ok: false,
      trouble: troubleTag(trouble),
      detail
    };
  };
};
var eventFromWire = function(e) {
  if (e.kind === "failed") {
    return new Just(new Failed({
      trouble: troubleFromTag(e.trouble),
      detail: e.detail,
      at: e.at,
      random: e.random,
      resetsAt: (function() {
        if (e.hasResetsAt) {
          return new Just(e.resetsAt);
        }
        ;
        return Nothing.value;
      })()
    }));
  }
  ;
  if (e.kind === "answered") {
    return new Just(Answered.value);
  }
  ;
  if (e.kind === "due") {
    return new Just(Due.value);
  }
  ;
  if (e.kind === "probing") {
    return new Just(ProbingStarted.value);
  }
  ;
  if (e.kind === "abandoned") {
    return new Just(Abandoned.value);
  }
  ;
  return Nothing.value;
};
var eqTrouble = {
  eq: function(x) {
    return function(y) {
      if (x instanceof RateLimit && y instanceof RateLimit) {
        return true;
      }
      ;
      if (x instanceof Overloaded && y instanceof Overloaded) {
        return true;
      }
      ;
      if (x instanceof Server && y instanceof Server) {
        return true;
      }
      ;
      if (x instanceof Offline && y instanceof Offline) {
        return true;
      }
      ;
      if (x instanceof Timeout && y instanceof Timeout) {
        return true;
      }
      ;
      if (x instanceof Account && y instanceof Account) {
        return true;
      }
      ;
      if (x instanceof Job && y instanceof Job) {
        return true;
      }
      ;
      if (x instanceof Reply && y instanceof Reply) {
        return true;
      }
      ;
      return false;
    };
  }
};
var eq3 = /* @__PURE__ */ eq(eqTrouble);
var retryDelayMs = function(trouble) {
  return function(failures) {
    return function(random) {
      var first = (function() {
        var $54 = eq3(trouble)(Offline.value) || eq3(trouble)(Timeout.value);
        if ($54) {
          return firstWaitOfflineMs;
        }
        ;
        return firstWaitMs;
      })();
      var whole = min3(longestWaitMs)(first * pow(2)(toNumber(max3(0)(failures - 1 | 0))));
      return round(whole / 2 + random * whole / 2);
    };
  };
};
var retryDelayMsWire = function(trouble) {
  return retryDelayMs(troubleFromTag(trouble));
};
var step = function($copy_v) {
  return function($copy_v1) {
    var $tco_var_v = $copy_v;
    var $tco_done = false;
    var $tco_result;
    function $tco_loop(v, v1) {
      if (v1 instanceof Answered) {
        $tco_done = true;
        return Ok.value;
      }
      ;
      if (v instanceof Waiting && v1 instanceof Due) {
        $tco_done = true;
        return new Recovering({
          trouble: v.value0.trouble,
          detail: v.value0.detail,
          failures: v.value0.failures
        });
      }
      ;
      if (v1 instanceof Due) {
        $tco_done = true;
        return v;
      }
      ;
      if (v instanceof Recovering && v1 instanceof ProbingStarted) {
        $tco_done = true;
        return new Probing(v.value0);
      }
      ;
      if (v1 instanceof ProbingStarted) {
        $tco_done = true;
        return v;
      }
      ;
      if (v instanceof Probing && v1 instanceof Abandoned) {
        $tco_done = true;
        return new Recovering(v.value0);
      }
      ;
      if (v1 instanceof Abandoned) {
        $tco_done = true;
        return v;
      }
      ;
      if (v1 instanceof Failed) {
        var reopens = (function() {
          if (v1.value0.resetsAt instanceof Just && (eq3(v1.value0.trouble)(RateLimit.value) && v1.value0.resetsAt.value0 > v1.value0.at)) {
            return new Just(v1.value0.resetsAt.value0);
          }
          ;
          return Nothing.value;
        })();
        var failures = (function() {
          if (v instanceof Ok) {
            return 1;
          }
          ;
          if (v instanceof Waiting) {
            return v.value0.failures + 1 | 0;
          }
          ;
          if (v instanceof Recovering) {
            return v.value0.failures + 1 | 0;
          }
          ;
          if (v instanceof Probing) {
            return v.value0.failures + 1 | 0;
          }
          ;
          if (v instanceof Blocked) {
            return 1;
          }
          ;
          throw new Error("Failed pattern match at Kernel.Health (line 142, column 14 - line 147, column 19): " + [v.constructor.name]);
        })();
        var until = (function() {
          if (reopens instanceof Just) {
            return reopens.value0 + round(v1.value0.random * resetSlackMs);
          }
          ;
          if (reopens instanceof Nothing) {
            return v1.value0.at + retryDelayMs(v1.value0.trouble)(failures)(v1.value0.random);
          }
          ;
          throw new Error("Failed pattern match at Kernel.Health (line 151, column 11 - line 153, column 63): " + [reopens.constructor.name]);
        })();
        var kept = (function() {
          if (v instanceof Waiting) {
            return max1(v.value0.until)(until);
          }
          ;
          return until;
        })();
        if (v1.value0.trouble instanceof Account) {
          $tco_done = true;
          return new Blocked({
            detail: v1.value0.detail
          });
        }
        ;
        if (v1.value0.trouble instanceof Job) {
          $tco_var_v = v;
          $copy_v1 = Abandoned.value;
          return;
        }
        ;
        if (v1.value0.trouble instanceof Reply) {
          $tco_var_v = v;
          $copy_v1 = Abandoned.value;
          return;
        }
        ;
        if (v instanceof Blocked) {
          $tco_done = true;
          return v;
        }
        ;
        $tco_done = true;
        return new Waiting({
          trouble: v1.value0.trouble,
          detail: v1.value0.detail,
          until: kept,
          failures
        });
      }
      ;
      throw new Error("Failed pattern match at Kernel.Health (line 124, column 1 - line 124, column 34): " + [v.constructor.name, v1.constructor.name]);
    }
    ;
    while (!$tco_done) {
      $tco_result = $tco_loop($tco_var_v, $copy_v1);
    }
    ;
    return $tco_result;
  };
};
var stepWire = function(health) {
  return function(event) {
    var v = eventFromWire(event);
    if (v instanceof Just) {
      return healthToWire(step(healthFromWire(health))(v.value0));
    }
    ;
    if (v instanceof Nothing) {
      return health;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Health (line 260, column 25 - line 262, column 20): " + [v.constructor.name]);
  };
};
var accountErrors = ["authentication_failed", "oauth_org_not_allowed", "account_on_hold", "verification_required", "billing_error"];
var troubleOf = function(error) {
  if (error === "rate_limit") {
    return RateLimit.value;
  }
  ;
  if (error === "overloaded") {
    return Overloaded.value;
  }
  ;
  if (elem3(error)(accountErrors)) {
    return Account.value;
  }
  ;
  if (elem3(error)(jobErrors)) {
    return Job.value;
  }
  ;
  if (otherwise) {
    return Server.value;
  }
  ;
  throw new Error("Failed pattern match at Kernel.Health (line 173, column 1 - line 173, column 31): " + [error.constructor.name]);
};
var outcomeOfErrorWire = function(error) {
  return failedWith(troubleOf(error))(spaced(error));
};
var outcomeOfWire = function(result) {
  if (result.isAnswered) {
    return {
      ok: true,
      trouble: "",
      detail: ""
    };
  }
  ;
  if (result.reason === "aborted") {
    return failedWith(Timeout.value)("timed out");
  }
  ;
  if (result.reason !== "api-error") {
    return failedWith(Reply.value)("empty reply");
  }
  ;
  if (!result.hasStatus) {
    return failedWith(Offline.value)("no connection");
  }
  ;
  if (result.error === "" || result.error === "unknown") {
    return failedWith(Server.value)("error " + show2(result.status));
  }
  ;
  if (otherwise) {
    return failedWith(troubleOf(result.error))(spaced(result.error));
  }
  ;
  throw new Error("Failed pattern match at Kernel.Health (line 287, column 1 - line 287, column 43): " + [result.constructor.name]);
};
var troubleOfWire = function($90) {
  return troubleTag(troubleOf($90));
};

// output/Kernel.Lease/index.js
var max4 = /* @__PURE__ */ max(ordNumber);
var min4 = /* @__PURE__ */ min(ordNumber);
var ttlMs = 6e4;
var soonestCheckMs = 1e3;
var slackMs = 2e3;
var noLease = {
  session: "",
  at: 0
};
var released = function(lease) {
  return function(me) {
    if (lease.session === me) {
      return noLease;
    }
    ;
    if (otherwise) {
      return lease;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Lease (line 69, column 1 - line 69, column 37): " + [lease.constructor.name, me.constructor.name]);
  };
};
var isHeld = function(lease) {
  return function(now) {
    return lease.session !== "" && now - lease.at < ttlMs;
  };
};
var claimed = function(lease) {
  return function(me) {
    return function(now) {
      return function(also) {
        if (lease.session === me || (also !== "" && lease.session === also || !isHeld(lease)(now))) {
          return {
            session: me,
            at: now
          };
        }
        ;
        if (otherwise) {
          return lease;
        }
        ;
        throw new Error("Failed pattern match at Kernel.Lease (line 63, column 1 - line 63, column 56): " + [lease.constructor.name, me.constructor.name, now.constructor.name, also.constructor.name]);
      };
    };
  };
};
var beatMs = 2e4;
var nextCheck = function(lease) {
  return function(me) {
    return function(now) {
      return function(random) {
        if (lease.session === me) {
          return now + beatMs;
        }
        ;
        if (otherwise) {
          return max4(now + soonestCheckMs)(min4(now + beatMs)(lease.at + ttlMs + round(random * slackMs)));
        }
        ;
        throw new Error("Failed pattern match at Kernel.Lease (line 78, column 1 - line 78, column 59): " + [lease.constructor.name, me.constructor.name, now.constructor.name, random.constructor.name]);
      };
    };
  };
};

// output/Kernel.Pace/index.js
var max5 = /* @__PURE__ */ max(ordNumber);
var min5 = /* @__PURE__ */ min(ordNumber);
var slowedGapMs = function(minGapMs) {
  return function(factor) {
    if (factor === 1) {
      return minGapMs;
    }
    ;
    if (otherwise) {
      return max5(minGapMs)(6e4) * factor;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Pace (line 59, column 1 - line 59, column 42): " + [minGapMs.constructor.name, factor.constructor.name]);
  };
};
var slowFromPercent = 80;
var pressureFromWire = function(w) {
  return {
    isHeld: w.level === "held",
    percent: w.percent,
    window: w.window,
    resetsAt: (function() {
      if (w.hasResetsAt) {
        return new Just(w.resetsAt);
      }
      ;
      return Nothing.value;
    })()
  };
};
var holdFromPercent = 95;
var isHeldAt = function(percent) {
  return percent >= holdFromPercent;
};
var gapFactor = function(percent) {
  if (isHeldAt(percent)) {
    return 1;
  }
  ;
  if (percent >= slowFromPercent) {
    return 4;
  }
  ;
  if (otherwise) {
    return 1;
  }
  ;
  throw new Error("Failed pattern match at Kernel.Pace (line 51, column 1 - line 51, column 30): " + [percent.constructor.name]);
};
var backoffMs = function(failures) {
  if (failures <= 0) {
    return 0;
  }
  ;
  if (otherwise) {
    return min5(6e5)(3e4 * pow(2)(toNumber(failures - 1 | 0)));
  }
  ;
  throw new Error("Failed pattern match at Kernel.Pace (line 66, column 1 - line 66, column 27): " + [failures.constructor.name]);
};

// output/Kernel.Play/index.js
var max6 = /* @__PURE__ */ max(ordNumber);
var LookFailed = /* @__PURE__ */ (function() {
  function LookFailed2(value0) {
    this.value0 = value0;
  }
  ;
  LookFailed2.create = function(value0) {
    return new LookFailed2(value0);
  };
  return LookFailed2;
})();
var InTrouble = /* @__PURE__ */ (function() {
  function InTrouble2(value0, value1) {
    this.value0 = value0;
    this.value1 = value1;
  }
  ;
  InTrouble2.create = function(value0) {
    return function(value1) {
      return new InTrouble2(value0, value1);
    };
  };
  return InTrouble2;
})();
var PlanSpent = /* @__PURE__ */ (function() {
  function PlanSpent2(value0, value1) {
    this.value0 = value0;
    this.value1 = value1;
  }
  ;
  PlanSpent2.create = function(value0) {
    return function(value1) {
      return new PlanSpent2(value0, value1);
    };
  };
  return PlanSpent2;
})();
var AccountRefused = /* @__PURE__ */ (function() {
  function AccountRefused2(value0) {
    this.value0 = value0;
  }
  ;
  AccountRefused2.create = function(value0) {
    return new AccountRefused2(value0);
  };
  return AccountRefused2;
})();
var JobRefused = /* @__PURE__ */ (function() {
  function JobRefused2(value0) {
    this.value0 = value0;
  }
  ;
  JobRefused2.create = function(value0) {
    return new JobRefused2(value0);
  };
  return JobRefused2;
})();
var Starting = /* @__PURE__ */ (function() {
  function Starting2() {
  }
  ;
  Starting2.value = new Starting2();
  return Starting2;
})();
var NoGit = /* @__PURE__ */ (function() {
  function NoGit2() {
  }
  ;
  NoGit2.value = new NoGit2();
  return NoGit2;
})();
var Following = /* @__PURE__ */ (function() {
  function Following2() {
  }
  ;
  Following2.value = new Following2();
  return Following2;
})();
var Paused = /* @__PURE__ */ (function() {
  function Paused2() {
  }
  ;
  Paused2.value = new Paused2();
  return Paused2;
})();
var Watching = /* @__PURE__ */ (function() {
  function Watching2() {
  }
  ;
  Watching2.value = new Watching2();
  return Watching2;
})();
var OnRequest = /* @__PURE__ */ (function() {
  function OnRequest2() {
  }
  ;
  OnRequest2.value = new OnRequest2();
  return OnRequest2;
})();
var Settling = /* @__PURE__ */ (function() {
  function Settling2(value0) {
    this.value0 = value0;
  }
  ;
  Settling2.create = function(value0) {
    return new Settling2(value0);
  };
  return Settling2;
})();
var Looking = /* @__PURE__ */ (function() {
  function Looking2() {
  }
  ;
  Looking2.value = new Looking2();
  return Looking2;
})();
var Waiting2 = /* @__PURE__ */ (function() {
  function Waiting3(value0) {
    this.value0 = value0;
  }
  ;
  Waiting3.create = function(value0) {
    return new Waiting3(value0);
  };
  return Waiting3;
})();
var playFromWire = function(w) {
  var why = (function() {
    if (w.why === "trouble") {
      return new InTrouble(troubleFromTag(w.trouble), w.detail);
    }
    ;
    if (w.why === "plan") {
      return new PlanSpent(w.percent, w.window);
    }
    ;
    if (w.why === "account") {
      return new AccountRefused(w.detail);
    }
    ;
    if (w.why === "job") {
      return new JobRefused(w.detail);
    }
    ;
    return new LookFailed(w.detail);
  })();
  if (w.at === "no-git") {
    return NoGit.value;
  }
  ;
  if (w.at === "following") {
    return Following.value;
  }
  ;
  if (w.at === "paused") {
    return Paused.value;
  }
  ;
  if (w.at === "watching") {
    return Watching.value;
  }
  ;
  if (w.at === "on-request") {
    return OnRequest.value;
  }
  ;
  if (w.at === "looking") {
    return Looking.value;
  }
  ;
  if (w.at === "settling") {
    return new Settling({
      dueAt: w.dueAt,
      isSpacing: w.isSpacing
    });
  }
  ;
  if (w.at === "waiting") {
    return new Waiting2({
      until: (function() {
        if (w.hasUntil) {
          return new Just(w.until);
        }
        ;
        return Nothing.value;
      })(),
      why
    });
  }
  ;
  return Starting.value;
};
var plain = function(at) {
  return {
    at,
    dueAt: 0,
    isSpacing: false,
    hasUntil: false,
    until: 0,
    why: "",
    detail: "",
    trouble: "",
    percent: 0,
    window: ""
  };
};
var playToWire = /* @__PURE__ */ (function() {
  var withWhy = function(why) {
    return function(wire) {
      if (why instanceof LookFailed) {
        return {
          trouble: wire.trouble,
          percent: wire.percent,
          window: wire.window,
          at: wire.at,
          dueAt: wire.dueAt,
          hasUntil: wire.hasUntil,
          isSpacing: wire.isSpacing,
          until: wire.until,
          why: "failed",
          detail: why.value0
        };
      }
      ;
      if (why instanceof InTrouble) {
        return {
          percent: wire.percent,
          window: wire.window,
          at: wire.at,
          dueAt: wire.dueAt,
          hasUntil: wire.hasUntil,
          isSpacing: wire.isSpacing,
          until: wire.until,
          why: "trouble",
          trouble: troubleTag(why.value0),
          detail: why.value1
        };
      }
      ;
      if (why instanceof PlanSpent) {
        return {
          detail: wire.detail,
          trouble: wire.trouble,
          at: wire.at,
          dueAt: wire.dueAt,
          hasUntil: wire.hasUntil,
          isSpacing: wire.isSpacing,
          until: wire.until,
          why: "plan",
          percent: why.value0,
          window: why.value1
        };
      }
      ;
      if (why instanceof AccountRefused) {
        return {
          percent: wire.percent,
          trouble: wire.trouble,
          window: wire.window,
          at: wire.at,
          dueAt: wire.dueAt,
          hasUntil: wire.hasUntil,
          isSpacing: wire.isSpacing,
          until: wire.until,
          why: "account",
          detail: why.value0
        };
      }
      ;
      if (why instanceof JobRefused) {
        return {
          percent: wire.percent,
          trouble: wire.trouble,
          window: wire.window,
          at: wire.at,
          dueAt: wire.dueAt,
          hasUntil: wire.hasUntil,
          isSpacing: wire.isSpacing,
          until: wire.until,
          why: "job",
          detail: why.value0
        };
      }
      ;
      throw new Error("Failed pattern match at Kernel.Play (line 237, column 22 - line 242, column 63): " + [why.constructor.name]);
    };
  };
  var withUntil = function(until) {
    return function(wire) {
      if (until instanceof Just) {
        return {
          at: wire.at,
          detail: wire.detail,
          dueAt: wire.dueAt,
          isSpacing: wire.isSpacing,
          percent: wire.percent,
          trouble: wire.trouble,
          why: wire.why,
          window: wire.window,
          hasUntil: true,
          until: until.value0
        };
      }
      ;
      if (until instanceof Nothing) {
        return wire;
      }
      ;
      throw new Error("Failed pattern match at Kernel.Play (line 234, column 26 - line 236, column 20): " + [until.constructor.name]);
    };
  };
  return function(v) {
    if (v instanceof Starting) {
      return plain("starting");
    }
    ;
    if (v instanceof NoGit) {
      return plain("no-git");
    }
    ;
    if (v instanceof Following) {
      return plain("following");
    }
    ;
    if (v instanceof Paused) {
      return plain("paused");
    }
    ;
    if (v instanceof Watching) {
      return plain("watching");
    }
    ;
    if (v instanceof OnRequest) {
      return plain("on-request");
    }
    ;
    if (v instanceof Looking) {
      return plain("looking");
    }
    ;
    if (v instanceof Settling) {
      var v1 = plain("settling");
      return {
        at: v1.at,
        hasUntil: v1.hasUntil,
        until: v1.until,
        why: v1.why,
        detail: v1.detail,
        trouble: v1.trouble,
        percent: v1.percent,
        window: v1.window,
        dueAt: v.value0.dueAt,
        isSpacing: v.value0.isSpacing
      };
    }
    ;
    if (v instanceof Waiting2) {
      return withUntil(v.value0.until)(withWhy(v.value0.why)(plain("waiting")));
    }
    ;
    throw new Error("Failed pattern match at Kernel.Play (line 223, column 14 - line 232, column 67): " + [v.constructor.name]);
  };
})();
var paced = function(facts) {
  if (facts.lastChangeAt instanceof Just && facts.hasPending) {
    return new Just((function() {
      if (facts.lastLookAt instanceof Nothing) {
        return facts.lastChangeAt.value0 + facts.quietMs;
      }
      ;
      if (facts.lastLookAt instanceof Just) {
        return max6(facts.lastChangeAt.value0 + facts.quietMs)(facts.lastLookAt.value0 + slowedGapMs(facts.minGapMs)(gapFactor(facts.pressure.percent)) + backoffMs(facts.failures));
      }
      ;
      throw new Error("Failed pattern match at Kernel.Play (line 98, column 7 - line 101, column 110): " + [facts.lastLookAt.constructor.name]);
    })());
  }
  ;
  return Nothing.value;
};
var playOf = function(facts) {
  if (!facts.isReady) {
    return Starting.value;
  }
  ;
  if (!facts.hasRepo) {
    return NoGit.value;
  }
  ;
  if (facts.isPaused) {
    return Paused.value;
  }
  ;
  if (facts.isFollowing) {
    return Following.value;
  }
  ;
  if (facts.isLooking) {
    return Looking.value;
  }
  ;
  if (!facts.isAutomatic) {
    return OnRequest.value;
  }
  ;
  if (otherwise) {
    var spaced2 = function(dueAt) {
      if (facts.lastChangeAt instanceof Just) {
        return dueAt > facts.lastChangeAt.value0 + facts.quietMs;
      }
      ;
      if (facts.lastChangeAt instanceof Nothing) {
        return false;
      }
      ;
      throw new Error("Failed pattern match at Kernel.Play (line 132, column 18 - line 134, column 21): " + [facts.lastChangeAt.constructor.name]);
    };
    var failed = (function() {
      var $47 = facts.failures > 0;
      if ($47) {
        return new Just(new LookFailed(facts.failure));
      }
      ;
      return Nothing.value;
    })();
    var orTrouble = function(trouble) {
      return function(detail) {
        if (failed instanceof Just) {
          return failed.value0;
        }
        ;
        if (failed instanceof Nothing) {
          return new InTrouble(trouble, detail);
        }
        ;
        throw new Error("Failed pattern match at Kernel.Play (line 129, column 30 - line 131, column 40): " + [failed.constructor.name]);
      };
    };
    var held = function(dueAt) {
      if (facts.jobBlock !== "") {
        return new Waiting2({
          until: Nothing.value,
          why: new JobRefused(facts.jobBlock)
        });
      }
      ;
      if (otherwise) {
        if (facts.health instanceof Blocked) {
          return new Waiting2({
            until: Nothing.value,
            why: new AccountRefused(facts.health.value0.detail)
          });
        }
        ;
        if (facts.pressure.isHeld) {
          return new Waiting2({
            until: facts.pressure.resetsAt,
            why: new PlanSpent(facts.pressure.percent, facts.pressure.window)
          });
        }
        ;
        if (facts.health instanceof Waiting) {
          return new Waiting2({
            until: new Just(max6(facts.health.value0.until)(dueAt)),
            why: orTrouble(facts.health.value0.trouble)(facts.health.value0.detail)
          });
        }
        ;
        if (facts.health instanceof Probing) {
          return new Waiting2({
            until: Nothing.value,
            why: orTrouble(facts.health.value0.trouble)(facts.health.value0.detail)
          });
        }
        ;
        if (failed instanceof Just) {
          return new Waiting2({
            until: new Just(dueAt),
            why: failed.value0
          });
        }
        ;
        if (failed instanceof Nothing) {
          return new Settling({
            dueAt,
            isSpacing: spaced2(dueAt)
          });
        }
        ;
        throw new Error("Failed pattern match at Kernel.Play (line 126, column 14 - line 128, column 65): " + [failed.constructor.name]);
      }
      ;
      throw new Error("Failed pattern match at Kernel.Play (line 118, column 3 - line 128, column 65): " + [dueAt.constructor.name]);
    };
    var v = paced(facts);
    if (v instanceof Nothing) {
      return Watching.value;
    }
    ;
    if (v instanceof Just) {
      return held(v.value0);
    }
    ;
    throw new Error("Failed pattern match at Kernel.Play (line 113, column 17 - line 115, column 31): " + [v.constructor.name]);
  }
  ;
  throw new Error("Failed pattern match at Kernel.Play (line 105, column 1 - line 105, column 24): " + [facts.constructor.name]);
};
var wakeAt = function(facts) {
  var v = playOf(facts);
  if (v instanceof Settling) {
    return new Just(v.value0.dueAt);
  }
  ;
  if (v instanceof Waiting2) {
    return v.value0.until;
  }
  ;
  return Nothing.value;
};
var isLookDue = function(facts) {
  return function(now) {
    var retried = function(v2) {
      if (v2 instanceof LookFailed) {
        return true;
      }
      ;
      if (v2 instanceof InTrouble) {
        return true;
      }
      ;
      return false;
    };
    var isWaiting = function(v2) {
      if (v2 instanceof Waiting) {
        return true;
      }
      ;
      return false;
    };
    var v = playOf(facts);
    if (v instanceof Settling) {
      return v.value0.dueAt <= now && mayAsk(facts.health);
    }
    ;
    if (v instanceof Waiting2 && (v.value0.until instanceof Just && retried(v.value0.why))) {
      return v.value0.until.value0 <= now && (mayAsk(facts.health) || isWaiting(facts.health));
    }
    ;
    return false;
  };
};
var factsFromWire = function(w) {
  return {
    isPaused: w.isPaused,
    isReady: w.isReady,
    hasRepo: w.hasRepo,
    isFollowing: w.isFollowing,
    isAutomatic: w.isAutomatic,
    hasPending: w.hasPending,
    lastChangeAt: (function() {
      if (w.hasLastChangeAt) {
        return new Just(w.lastChangeAt);
      }
      ;
      return Nothing.value;
    })(),
    lastLookAt: (function() {
      if (w.hasLastLookAt) {
        return new Just(w.lastLookAt);
      }
      ;
      return Nothing.value;
    })(),
    isLooking: w.isLooking,
    failures: w.failures,
    failure: w.failure,
    quietMs: w.quietMs,
    minGapMs: w.minGapMs,
    health: healthFromWire(w.health),
    pressure: pressureFromWire(w.pressure),
    jobBlock: w.jobBlock
  };
};
var isLookDueWire = function($78) {
  return isLookDue(factsFromWire($78));
};
var playOfWire = function($79) {
  return playToWire(playOf(factsFromWire($79)));
};
var wakeAtWire = function(facts) {
  var v = wakeAt(factsFromWire(facts));
  if (v instanceof Just) {
    return {
      has: true,
      at: v.value0
    };
  }
  ;
  if (v instanceof Nothing) {
    return {
      has: false,
      at: 0
    };
  }
  ;
  throw new Error("Failed pattern match at Kernel.Play (line 270, column 20 - line 272, column 37): " + [v.constructor.name]);
};

// output/Kernel.Queue/index.js
var max7 = /* @__PURE__ */ max(ordInt);
var map3 = /* @__PURE__ */ map(functorMaybe);
var max12 = /* @__PURE__ */ max(ordNumber);
var map1 = /* @__PURE__ */ map(functorArray);
var ToReview = /* @__PURE__ */ (function() {
  function ToReview2() {
  }
  ;
  ToReview2.value = new ToReview2();
  return ToReview2;
})();
var ToAssess = /* @__PURE__ */ (function() {
  function ToAssess2() {
  }
  ;
  ToAssess2.value = new ToAssess2();
  return ToAssess2;
})();
var Queue = function(x) {
  return x;
};
var withoutCommit = function(hash) {
  return function(v) {
    return filter(function(commit) {
      return commit.hash !== hash;
    })(v);
  };
};
var watchdogMs = /* @__PURE__ */ (function() {
  return 15 * 60 * 1e3;
})();
var watchdogLimitMs = /* @__PURE__ */ (function() {
  return 45 * 60 * 1e3;
})();
var waitingFromWire = function(w) {
  return {
    hash: w.hash,
    title: w.title,
    at: w.at,
    stage: (function() {
      if (w.isReviewed) {
        return ToAssess.value;
      }
      ;
      return ToReview.value;
    })(),
    attempts: w.attempts
  };
};
var verdictMs = 2e3;
var toCommits = function(v) {
  return v;
};
var retryBaseMs = 6e4;
var retryMs = function(attempts) {
  return retryBaseMs * pow(2)(toNumber(max7(0)(attempts - 1 | 0)));
};
var planHeld = "you are close to your plan limit. Press r to run it anyway.";
var maxWaiting = 3;
var withCommit = function(commit) {
  return function(at) {
    return function(v) {
      if (any2(function(known) {
        return known.hash === commit.hash;
      })(v)) {
        return v;
      }
      ;
      if (otherwise) {
        return takeEnd(maxWaiting)(snoc(v)({
          hash: commit.hash,
          title: commit.title,
          at,
          stage: ToReview.value,
          attempts: 0
        }));
      }
      ;
      throw new Error("Failed pattern match at Kernel.Queue (line 132, column 1 - line 132, column 78): " + [commit.constructor.name, at.constructor.name, v.constructor.name]);
    };
  };
};
var maxWaitMs = /* @__PURE__ */ (function() {
  return 24 * 60 * 60 * 1e3;
})();
var maxAttempts = 3;
var isSpent = function(hash) {
  return function(v) {
    return fromMaybe(0)(map3(function(v1) {
      return v1.attempts;
    })(find2(function(commit) {
      return commit.hash === hash;
    })(v))) >= maxAttempts;
  };
};
var heldText = function(clock) {
  return function(health) {
    return function(pressure) {
      return function(jobBlock) {
        return function(retryAt) {
          var notAnswering = function(detail) {
            return function(when3) {
              return "Claude is not answering (" + (detail + ("). It is tried again " + (when3 + ", or press r.")));
            };
          };
          var maybe$prime2 = function(none) {
            return function(some) {
              return function(v) {
                if (v instanceof Just) {
                  return some(v.value0);
                }
                ;
                if (v instanceof Nothing) {
                  return none;
                }
                ;
                throw new Error("Failed pattern match at Kernel.Queue (line 209, column 22 - line 211, column 20): " + [v.constructor.name]);
              };
            };
          };
          if (jobBlock instanceof Just) {
            return "the deep review cannot run (" + (jobBlock.value0 + "). Its model is set in /config.");
          }
          ;
          if (health instanceof Blocked) {
            return "Claude is refusing this account (" + (health.value0.detail + "). It is reviewed once that is sorted out.");
          }
          ;
          if (pressure.isHeld) {
            return planHeld;
          }
          ;
          if (health instanceof Waiting) {
            return notAnswering(health.value0.detail)("at " + clock(max12(health.value0.until)(fromMaybe(0)(retryAt))));
          }
          ;
          if (health instanceof Probing) {
            return notAnswering(health.value0.detail)(maybe$prime2("shortly")(function(at) {
              return "at " + clock(at);
            })(retryAt));
          }
          ;
          return "";
        };
      };
    };
  };
};
var heldTextWire = function(clock) {
  return function(health) {
    return function(pressure) {
      return function(jobBlock) {
        return function(hasRetryAt) {
          return function(retryAt) {
            return heldText(clock)(healthFromWire(health))(pressureFromWire(pressure))((function() {
              var $52 = jobBlock === "";
              if ($52) {
                return Nothing.value;
              }
              ;
              return new Just(jobBlock);
            })())((function() {
              if (hasRetryAt) {
                return new Just(retryAt);
              }
              ;
              return Nothing.value;
            })());
          };
        };
      };
    };
  };
};
var fromCommits = /* @__PURE__ */ (function() {
  var $73 = takeEnd(maxWaiting);
  var $74 = nubByEq(function(a) {
    return function(b) {
      return a.hash === b.hash;
    };
  });
  return function($75) {
    return Queue($73($74($75)));
  };
})();
var fromWire = /* @__PURE__ */ (function() {
  var $76 = map1(waitingFromWire);
  return function($77) {
    return fromCommits($76($77));
  };
})();
var isSpentWire = function(commits) {
  return function(hash) {
    return isSpent(hash)(fromWire(commits));
  };
};
var failedText = function(clock) {
  return function(detail) {
    return function(v) {
      if (v instanceof Nothing) {
        return detail + ". Press r to run it again.";
      }
      ;
      if (v instanceof Just) {
        return detail + (". It is tried again at " + (clock(v.value0) + ", or press r."));
      }
      ;
      throw new Error("Failed pattern match at Kernel.Queue (line 216, column 27 - line 218, column 80): " + [v.constructor.name]);
    };
  };
};
var failedTextWire = function(clock) {
  return function(detail) {
    return function(hasRetryAt) {
      return function(retryAt) {
        return failedText(clock)(detail)((function() {
          if (hasRetryAt) {
            return new Just(retryAt);
          }
          ;
          return Nothing.value;
        })());
      };
    };
  };
};
var eqStage = {
  eq: function(x) {
    return function(y) {
      if (x instanceof ToReview && y instanceof ToReview) {
        return true;
      }
      ;
      if (x instanceof ToAssess && y instanceof ToAssess) {
        return true;
      }
      ;
      return false;
    };
  }
};
var eq12 = /* @__PURE__ */ eq(eqStage);
var isPastReview = function(wanted) {
  return function(commit) {
    return eq12(commit.stage)(ToAssess.value) || !wanted.wantsReview;
  };
};
var nextToAssess = function(wanted) {
  return function(v) {
    if (wanted.wantsAssessment) {
      return find2(isPastReview(wanted))(v);
    }
    ;
    if (otherwise) {
      return Nothing.value;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Queue (line 180, column 1 - line 180, column 49): " + [wanted.constructor.name, v.constructor.name]);
  };
};
var settledIn = function(wanted) {
  return function(v) {
    if (wanted.wantsAssessment) {
      return [];
    }
    ;
    if (otherwise) {
      return map1(function(v1) {
        return v1.hash;
      })(filter(isPastReview(wanted))(v));
    }
    ;
    throw new Error("Failed pattern match at Kernel.Queue (line 186, column 1 - line 186, column 45): " + [wanted.constructor.name, v.constructor.name]);
  };
};
var settledInWire = function(commits) {
  return function(wanted) {
    return settledIn(wanted)(fromWire(commits));
  };
};
var nextToReview = function(wanted) {
  return function(v) {
    if (wanted.wantsReview) {
      return find2(function(commit) {
        return eq12(commit.stage)(ToReview.value);
      })(v);
    }
    ;
    if (otherwise) {
      return Nothing.value;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Queue (line 173, column 1 - line 173, column 49): " + [wanted.constructor.name, v.constructor.name]);
  };
};
var waitingToWire = function(w) {
  return {
    hash: w.hash,
    title: w.title,
    at: w.at,
    isReviewed: eq12(w.stage)(ToAssess.value),
    attempts: w.attempts
  };
};
var nextToWire = function(v) {
  if (v instanceof Just) {
    return {
      has: true,
      commit: waitingToWire(v.value0)
    };
  }
  ;
  if (v instanceof Nothing) {
    return {
      has: false,
      commit: {
        hash: "",
        title: "",
        at: 0,
        isReviewed: false,
        attempts: 0
      }
    };
  }
  ;
  throw new Error("Failed pattern match at Kernel.Queue (line 246, column 14 - line 248, column 102): " + [v.constructor.name]);
};
var nextToAssessWire = function(commits) {
  return function(wanted) {
    return nextToWire(nextToAssess(wanted)(fromWire(commits)));
  };
};
var nextToReviewWire = function(commits) {
  return function(wanted) {
    return nextToWire(nextToReview(wanted)(fromWire(commits)));
  };
};
var toWire = /* @__PURE__ */ (function() {
  var $78 = map1(waitingToWire);
  return function($79) {
    return $78(toCommits($79));
  };
})();
var through = function(change) {
  return function($80) {
    return toWire(change(fromWire($80)));
  };
};
var withCommitWire = function(commits) {
  return function(hash) {
    return function(title) {
      return function(at) {
        return through(withCommit({
          hash,
          title
        })(at))(commits);
      };
    };
  };
};
var withoutCommitWire = function(commits) {
  return function(hash) {
    return through(withoutCommit(hash))(commits);
  };
};
var current = function(now) {
  return function(v) {
    return filter(function(commit) {
      return now - commit.at < maxWaitMs;
    })(v);
  };
};
var currentQueueWire = function(commits) {
  return function(now) {
    return through(current(now))(commits);
  };
};
var changed = function(hash) {
  return function(change) {
    return function(v) {
      return map1(function(commit) {
        var $72 = commit.hash === hash;
        if ($72) {
          return change(commit);
        }
        ;
        return commit;
      })(v);
    };
  };
};
var reviewed = function(hash) {
  return changed(hash)(function(v) {
    return {
      hash: v.hash,
      title: v.title,
      at: v.at,
      stage: ToAssess.value,
      attempts: 0
    };
  });
};
var reviewedWire = function(commits) {
  return function(hash) {
    return through(reviewed(hash))(commits);
  };
};
var withAttempt = function(hash) {
  return changed(hash)(function(commit) {
    return {
      hash: commit.hash,
      title: commit.title,
      at: commit.at,
      stage: commit.stage,
      attempts: commit.attempts + 1 | 0
    };
  });
};
var withAttemptWire = function(commits) {
  return function(hash) {
    return through(withAttempt(hash))(commits);
  };
};

// output/Kernel.Schedule/index.js
var min6 = /* @__PURE__ */ min(ordNumber);
var map4 = /* @__PURE__ */ map(functorArray);
var sortWith2 = /* @__PURE__ */ sortWith(ordNumber);
var max8 = /* @__PURE__ */ max(ordNumber);
var eq13 = /* @__PURE__ */ eq(/* @__PURE__ */ eqMaybe(eqNumber));
var Keep = /* @__PURE__ */ (function() {
  function Keep2() {
  }
  ;
  Keep2.value = new Keep2();
  return Keep2;
})();
var Disarm = /* @__PURE__ */ (function() {
  function Disarm2() {
  }
  ;
  Disarm2.value = new Disarm2();
  return Disarm2;
})();
var ArmFor = /* @__PURE__ */ (function() {
  function ArmFor2(value0) {
    this.value0 = value0;
  }
  ;
  ArmFor2.create = function(value0) {
    return new ArmFor2(value0);
  };
  return ArmFor2;
})();
var earliest = /* @__PURE__ */ (function() {
  var first = function(v) {
    return function(v1) {
      if (v instanceof Nothing) {
        return new Just(v1.at);
      }
      ;
      if (v instanceof Just) {
        return new Just(min6(v.value0)(v1.at));
      }
      ;
      throw new Error("Failed pattern match at Kernel.Schedule (line 54, column 3 - line 54, column 44): " + [v.constructor.name, v1.constructor.name]);
    };
  };
  return foldl2(first)(Nothing.value);
})();
var dueNow = function(now) {
  var $32 = map4(function(v) {
    return v.name;
  });
  var $33 = sortWith2(function(v) {
    return v.at;
  });
  var $34 = filter(function(deadline) {
    return deadline.at <= now;
  });
  return function($35) {
    return $32($33($34($35)));
  };
};
var dueNowWire = function(deadlines) {
  return function(now) {
    return dueNow(now)(deadlines);
  };
};
var delayMs = function(at) {
  return function(now) {
    return max8(0)(at - now);
  };
};
var delayMsWire = delayMs;
var arming = function(armedFor) {
  return function(deadlines) {
    var v = earliest(deadlines);
    if (eq13(v)(armedFor)) {
      return Keep.value;
    }
    ;
    if (v instanceof Nothing) {
      return Disarm.value;
    }
    ;
    if (v instanceof Just) {
      return new ArmFor(v.value0);
    }
    ;
    throw new Error("Failed pattern match at Kernel.Schedule (line 60, column 29 - line 63, column 23): " + [v.constructor.name]);
  };
};
var armingWire = function(isArmed) {
  return function(armedFor) {
    return function(deadlines) {
      var v = arming((function() {
        if (isArmed) {
          return new Just(armedFor);
        }
        ;
        return Nothing.value;
      })())(deadlines);
      if (v instanceof Keep) {
        return {
          next: "keep",
          at: 0
        };
      }
      ;
      if (v instanceof Disarm) {
        return {
          next: "disarm",
          at: 0
        };
      }
      ;
      if (v instanceof ArmFor) {
        return {
          next: "arm",
          at: v.value0
        };
      }
      ;
      throw new Error("Failed pattern match at Kernel.Schedule (line 79, column 41 - line 82, column 35): " + [v.constructor.name]);
    };
  };
};

// output/Kernel.Sensor/index.js
var min7 = /* @__PURE__ */ min(ordNumber);
var max9 = /* @__PURE__ */ max(ordNumber);
var slowScanWaitMs = 2e3;
var slowScanStepMs = 250;
var scanMs = 2e3;
var longestScanGapMs = 32e3;
var longestFocusGapMs = 2e3;
var idleScanMs = 5e3;
var idleAfterMs = 6e5;
var hotScanMs = 1e3;
var hotForMs = 6e4;
var scanGapMs = function(facts) {
  var slowness = floor(facts.lastScanMs / slowScanStepMs) * slowScanWaitMs;
  var base = (function() {
    if (facts.activeAt instanceof Nothing) {
      return idleScanMs;
    }
    ;
    if (facts.activeAt instanceof Just) {
      if (facts.now - facts.activeAt.value0 < hotForMs) {
        return hotScanMs;
      }
      ;
      if (facts.now - facts.activeAt.value0 >= idleAfterMs) {
        return idleScanMs;
      }
      ;
      if (otherwise) {
        return scanMs;
      }
      ;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Sensor (line 85, column 10 - line 90, column 28): " + [facts.activeAt.constructor.name]);
  })();
  return min7(longestScanGapMs)(base + slowness);
};
var scanGapMsWire = function(w) {
  return scanGapMs({
    now: w.now,
    activeAt: (function() {
      if (w.hasActiveAt) {
        return new Just(w.activeAt);
      }
      ;
      return Nothing.value;
    })(),
    lastScanMs: w.lastScanMs
  });
};
var focusScanMs = 100;
var focusGapMs = function(tookMs) {
  return min7(longestFocusGapMs)(max9(focusScanMs)(tookMs * 4));
};

// output/Data.Number.Format/foreign.js
function wrap(method) {
  return function(d) {
    return function(num) {
      return method.apply(num, [d]);
    };
  };
}
var toPrecisionNative = wrap(Number.prototype.toPrecision);
var toFixedNative = wrap(Number.prototype.toFixed);
var toExponentialNative = wrap(Number.prototype.toExponential);

// output/Data.Number.Format/index.js
var clamp2 = /* @__PURE__ */ clamp(ordInt);
var Precision = /* @__PURE__ */ (function() {
  function Precision2(value0) {
    this.value0 = value0;
  }
  ;
  Precision2.create = function(value0) {
    return new Precision2(value0);
  };
  return Precision2;
})();
var Fixed = /* @__PURE__ */ (function() {
  function Fixed2(value0) {
    this.value0 = value0;
  }
  ;
  Fixed2.create = function(value0) {
    return new Fixed2(value0);
  };
  return Fixed2;
})();
var Exponential = /* @__PURE__ */ (function() {
  function Exponential2(value0) {
    this.value0 = value0;
  }
  ;
  Exponential2.create = function(value0) {
    return new Exponential2(value0);
  };
  return Exponential2;
})();
var toStringWith = function(v) {
  if (v instanceof Precision) {
    return toPrecisionNative(v.value0);
  }
  ;
  if (v instanceof Fixed) {
    return toFixedNative(v.value0);
  }
  ;
  if (v instanceof Exponential) {
    return toExponentialNative(v.value0);
  }
  ;
  throw new Error("Failed pattern match at Data.Number.Format (line 59, column 1 - line 59, column 43): " + [v.constructor.name]);
};
var fixed = /* @__PURE__ */ (function() {
  var $9 = clamp2(0)(20);
  return function($10) {
    return Fixed.create($9($10));
  };
})();

// output/Kernel.Status/index.js
var append1 = /* @__PURE__ */ append(semigroupArray);
var watchState = function(v) {
  if (v instanceof Starting) {
    return "starting";
  }
  ;
  if (v instanceof NoGit) {
    return "no-git";
  }
  ;
  if (v instanceof Looking) {
    return "looking";
  }
  ;
  if (v instanceof Settling) {
    return "settling";
  }
  ;
  if (v instanceof Waiting2) {
    return "waiting";
  }
  ;
  return "idle";
};
var watchStateWire = function($40) {
  return watchState(playFromWire($40));
};
var troubleText = function(v) {
  if (v instanceof RateLimit) {
    return "Claude is rate limited";
  }
  ;
  if (v instanceof Overloaded) {
    return "Claude is overloaded";
  }
  ;
  if (v instanceof Server) {
    return "Claude had a server error";
  }
  ;
  if (v instanceof Offline) {
    return "There is no connection to Claude";
  }
  ;
  if (v instanceof Timeout) {
    return "Claude did not answer in time";
  }
  ;
  return "Claude is not answering";
};
var slowScanMs = 1500;
var playLine = function(clock) {
  return function(v) {
    if (v instanceof Paused) {
      return "Paused. /bsd resume to continue.";
    }
    ;
    if (v instanceof Starting) {
      return "On. Getting ready.";
    }
    ;
    if (v instanceof NoGit) {
      return "On. This folder is not a git repository, so there is no play-by-play.";
    }
    ;
    if (v instanceof Following) {
      return "On. Another session is driving this project. This one is for the conversation.";
    }
    ;
    if (v instanceof Watching) {
      return "On. Watching for your next save.";
    }
    ;
    if (v instanceof OnRequest) {
      return "On. Looking only when you ask.";
    }
    ;
    if (v instanceof Settling) {
      if (v.value0.isSpacing) {
        return "On. Saw your save. Next look after " + (clock(v.value0.dueAt) + ".");
      }
      ;
      if (otherwise) {
        return "On. Saw your save. Looking when you pause.";
      }
      ;
    }
    ;
    if (v instanceof Looking) {
      return "On. Looking at your changes.";
    }
    ;
    if (v instanceof Waiting2) {
      var next = (function() {
        if (v.value0.until instanceof Nothing) {
          return "";
        }
        ;
        if (v.value0.until instanceof Just) {
          return " Next try " + (clock(v.value0.until.value0) + ".");
        }
        ;
        throw new Error("Failed pattern match at Kernel.Status (line 65, column 12 - line 67, column 49): " + [v.value0.until.constructor.name]);
      })();
      if (v.value0.why instanceof LookFailed) {
        return "On. The last look failed (" + (v.value0.why.value0 + (")." + (function() {
          var $19 = next === "";
          if ($19) {
            return " It will try again.";
          }
          ;
          return next;
        })()));
      }
      ;
      if (v.value0.why instanceof InTrouble) {
        return "On. " + (troubleText(v.value0.why.value0) + ("." + next));
      }
      ;
      if (v.value0.why instanceof PlanSpent) {
        if (v.value0.until instanceof Nothing) {
          return "On. Holding back, because you are close to your plan limit. It still looks when you ask.";
        }
        ;
        if (v.value0.until instanceof Just) {
          return "On. Holding back until " + (clock(v.value0.until.value0) + ", because you are close to your plan limit. It still looks when you ask.");
        }
        ;
        throw new Error("Failed pattern match at Kernel.Status (line 59, column 22 - line 61, column 133): " + [v.value0.until.constructor.name]);
      }
      ;
      if (v.value0.why instanceof AccountRefused) {
        return "On. Claude is refusing this account (" + (v.value0.why.value0 + "). Nothing runs in the background until that is sorted out.");
      }
      ;
      if (v.value0.why instanceof JobRefused) {
        return "On. The play-by-play cannot run (" + (v.value0.why.value0 + "). Its model is set in /config.");
      }
      ;
      throw new Error("Failed pattern match at Kernel.Status (line 56, column 29 - line 63, column 108): " + [v.value0.why.constructor.name]);
    }
    ;
    throw new Error("Failed pattern match at Kernel.Status (line 45, column 18 - line 67, column 49): " + [v.constructor.name]);
  };
};
var playLineWire = function(clock) {
  var $41 = playLine(clock);
  return function($42) {
    return $41(playFromWire($42));
  };
};
var healthLine = function(clock) {
  return function(facts) {
    var until = function(v) {
      if (v instanceof Just) {
        return " until " + clock(v.value0);
      }
      ;
      if (v instanceof Nothing) {
        return "";
      }
      ;
      throw new Error("Failed pattern match at Kernel.Status (line 103, column 11 - line 105, column 18): " + [v.constructor.name]);
    };
    var slowGit = (function() {
      if (facts.lastScanMs >= slowScanMs) {
        return ["git is slow here: the last look at the working tree took " + (toStringWith(fixed(1))(facts.lastScanMs / 1e3) + " s.")];
      }
      ;
      if (otherwise) {
        return [];
      }
      ;
      throw new Error("Failed pattern match at Kernel.Status (line 106, column 3 - line 108, column 21): ");
    })();
    var service = (function() {
      if (facts.play instanceof Waiting2) {
        return [];
      }
      ;
      if (facts.health instanceof Blocked) {
        return ["Claude is refusing this account (" + (facts.health.value0.detail + "). Nothing runs in the background until that is sorted out.")];
      }
      ;
      if (facts.health instanceof Waiting) {
        return [troubleText(facts.health.value0.trouble) + (". Background work waits until " + (clock(facts.health.value0.until) + "."))];
      }
      ;
      if (facts.pressure.isHeld) {
        return ["You are close to your plan limit. Nothing runs in the background" + (until(facts.pressure.resetsAt) + " unless you ask.")];
      }
      ;
      if (otherwise) {
        return [];
      }
      ;
      throw new Error("Failed pattern match at Kernel.Status (line 96, column 10 - line 102, column 26): " + [facts.health.constructor.name]);
    })();
    var keepsFailing = (function() {
      if ($$null(facts.failing)) {
        return [];
      }
      ;
      if (otherwise) {
        return ["Keeps failing: " + (joinWith(", ")(facts.failing) + ". /bsd debug dump saves the details.")];
      }
      ;
      throw new Error("Failed pattern match at Kernel.Status (line 109, column 3 - line 111, column 113): ");
    })();
    if (facts.play instanceof Paused) {
      return "";
    }
    ;
    if (facts.play instanceof Following) {
      return "";
    }
    ;
    if (facts.play instanceof Starting) {
      return "";
    }
    ;
    if (facts.play instanceof NoGit) {
      return "";
    }
    ;
    return joinWith(" ")(append1(service)(append1(slowGit)(keepsFailing)));
  };
};
var healthLineWire = function(clock) {
  return function(w) {
    return healthLine(clock)({
      play: playFromWire(w.play),
      health: healthFromWire(w.health),
      pressure: pressureFromWire(w.pressure),
      lastScanMs: w.lastScanMs,
      failing: w.failing
    });
  };
};

// output/Kernel.Store/index.js
var Unchanged = /* @__PURE__ */ (function() {
  function Unchanged2() {
  }
  ;
  Unchanged2.value = new Unchanged2();
  return Unchanged2;
})();
var CheckFirst = /* @__PURE__ */ (function() {
  function CheckFirst2() {
  }
  ;
  CheckFirst2.value = new CheckFirst2();
  return CheckFirst2;
})();
var WriteNow = /* @__PURE__ */ (function() {
  function WriteNow2() {
  }
  ;
  WriteNow2.value = new WriteNow2();
  return WriteNow2;
})();
var Missing = /* @__PURE__ */ (function() {
  function Missing2() {
  }
  ;
  Missing2.value = new Missing2();
  return Missing2;
})();
var Parsed = /* @__PURE__ */ (function() {
  function Parsed2() {
  }
  ;
  Parsed2.value = new Parsed2();
  return Parsed2;
})();
var Unreadable = /* @__PURE__ */ (function() {
  function Unreadable2() {
  }
  ;
  Unreadable2.value = new Unreadable2();
  return Unreadable2;
})();
var Done2 = /* @__PURE__ */ (function() {
  function Done3() {
  }
  ;
  Done3.value = new Done3();
  return Done3;
})();
var Unconfirmed = /* @__PURE__ */ (function() {
  function Unconfirmed2() {
  }
  ;
  Unconfirmed2.value = new Unconfirmed2();
  return Unconfirmed2;
})();
var TryAgainIn = /* @__PURE__ */ (function() {
  function TryAgainIn2(value0) {
    this.value0 = value0;
  }
  ;
  TryAgainIn2.create = function(value0) {
    return new TryAgainIn2(value0);
  };
  return TryAgainIn2;
})();
var Absent = /* @__PURE__ */ (function() {
  function Absent2() {
  }
  ;
  Absent2.value = new Absent2();
  return Absent2;
})();
var Sound = /* @__PURE__ */ (function() {
  function Sound2() {
  }
  ;
  Sound2.value = new Sound2();
  return Sound2;
})();
var ReadAgainIn = /* @__PURE__ */ (function() {
  function ReadAgainIn2(value0) {
    this.value0 = value0;
  }
  ;
  ReadAgainIn2.create = function(value0) {
    return new ReadAgainIn2(value0);
  };
  return ReadAgainIn2;
})();
var Broken = /* @__PURE__ */ (function() {
  function Broken2() {
  }
  ;
  Broken2.value = new Broken2();
  return Broken2;
})();
var writeTries = 4;
var stepOf = function(facts) {
  if (facts.isSound && facts.isSame) {
    return Unchanged.value;
  }
  ;
  if (!facts.hasLock && facts.attempt < writeTries) {
    return CheckFirst.value;
  }
  ;
  if (otherwise) {
    return WriteNow.value;
  }
  ;
  throw new Error("Failed pattern match at Kernel.Store (line 90, column 1 - line 90, column 96): " + [facts.constructor.name]);
};
var stepOfWire = function(facts) {
  var v = stepOf(facts);
  if (v instanceof Unchanged) {
    return "unchanged";
  }
  ;
  if (v instanceof CheckFirst) {
    return "check";
  }
  ;
  if (v instanceof WriteNow) {
    return "write";
  }
  ;
  throw new Error("Failed pattern match at Kernel.Store (line 133, column 20 - line 136, column 22): " + [v.constructor.name]);
};
var readTries = 3;
var readRetryMs = 25;
var keepsBackup = function(facts) {
  return facts.wantsBackup && (facts.isSound && facts.exists);
};
var keepsBackupWire = keepsBackup;
var afterWrite = function(attempt) {
  return function(isConfirmed) {
    if (isConfirmed) {
      return Done2.value;
    }
    ;
    if (attempt >= writeTries) {
      return Unconfirmed.value;
    }
    ;
    if (otherwise) {
      return new TryAgainIn(readRetryMs * toNumber(attempt));
    }
    ;
    throw new Error("Failed pattern match at Kernel.Store (line 109, column 1 - line 109, column 43): " + [attempt.constructor.name, isConfirmed.constructor.name]);
  };
};
var afterWriteWire = function(attempt) {
  return function(isConfirmed) {
    var v = afterWrite(attempt)(isConfirmed);
    if (v instanceof Done2) {
      return {
        next: "done",
        waitMs: 0
      };
    }
    ;
    if (v instanceof Unconfirmed) {
      return {
        next: "unconfirmed",
        waitMs: 0
      };
    }
    ;
    if (v instanceof TryAgainIn) {
      return {
        next: "again",
        waitMs: v.value0
      };
    }
    ;
    throw new Error("Failed pattern match at Kernel.Store (line 143, column 38 - line 146, column 49): " + [v.constructor.name]);
  };
};
var afterRead = function(attempt) {
  return function(v) {
    if (v instanceof Missing) {
      return Absent.value;
    }
    ;
    if (v instanceof Parsed) {
      return Sound.value;
    }
    ;
    if (v instanceof Unreadable) {
      if (attempt < readTries) {
        return new ReadAgainIn(readRetryMs);
      }
      ;
      if (otherwise) {
        return Broken.value;
      }
      ;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Store (line 72, column 21 - line 77, column 26): " + [v.constructor.name]);
  };
};
var afterReadWire = function(attempt) {
  return function(found) {
    var foundFromTag = function(v2) {
      if (v2 === "missing") {
        return Missing.value;
      }
      ;
      if (v2 === "parsed") {
        return Parsed.value;
      }
      ;
      return Unreadable.value;
    };
    var v = afterRead(attempt)(foundFromTag(found));
    if (v instanceof Absent) {
      return {
        next: "absent",
        waitMs: 0
      };
    }
    ;
    if (v instanceof Sound) {
      return {
        next: "sound",
        waitMs: 0
      };
    }
    ;
    if (v instanceof ReadAgainIn) {
      return {
        next: "again",
        waitMs: v.value0
      };
    }
    ;
    if (v instanceof Broken) {
      return {
        next: "broken",
        waitMs: 0
      };
    }
    ;
    throw new Error("Failed pattern match at Kernel.Store (line 120, column 31 - line 124, column 44): " + [v.constructor.name]);
  };
};

// output/Kernel.Main/index.js
var leaseTtlMs = ttlMs;
var leaseSlackMs = slackMs;
var leaseReleased = released;
var leaseNextCheck = nextCheck;
var leaseIsHeld = isHeld;
var leaseClaimed = claimed;
var leaseBeatMs = beatMs;
export {
  afterReadWire,
  afterWriteWire,
  armingWire,
  backoffMs,
  currentQueueWire,
  delayMsWire,
  dueNowWire,
  failedTextWire,
  focusGapMs,
  focusScanMs,
  gapFactor,
  healthLineWire,
  heldTextWire,
  hotForMs,
  hotScanMs,
  idleAfterMs,
  idleScanMs,
  isHeldAt,
  isLookDueWire,
  isSpentWire,
  keepsBackupWire,
  leaseBeatMs,
  leaseClaimed,
  leaseIsHeld,
  leaseNextCheck,
  leaseReleased,
  leaseSlackMs,
  leaseTtlMs,
  longestFocusGapMs,
  longestScanGapMs,
  maxAttempts,
  maxWaitMs,
  maxWaiting,
  mayAskWire,
  nextToAssessWire,
  nextToReviewWire,
  outcomeOfErrorWire,
  outcomeOfWire,
  planHeld,
  playLineWire,
  playOfWire,
  readRetryMs,
  readTries,
  retryBaseMs,
  retryDelayMsWire,
  retryMs,
  reviewedWire,
  scanGapMsWire,
  scanMs,
  settledInWire,
  slowScanMs,
  slowedGapMs,
  stepOfWire,
  stepWire,
  troubleOfWire,
  verdictMs,
  wakeAtWire,
  watchStateWire,
  watchdogLimitMs,
  watchdogMs,
  withAttemptWire,
  withCommitWire,
  withoutCommitWire,
  writeTries
};
