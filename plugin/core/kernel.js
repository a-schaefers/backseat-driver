// The kernel of Backseat Driver, compiled from PureScript (kernel/src in the repository) by scripts/build-kernel.sh. Do not edit: change the source and build again.

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
var indexImpl = function(just, nothing, xs, i) {
  return i < 0 || i >= xs.length ? nothing : just(xs[i]);
};
var findIndexImpl = function(just, nothing, f, xs) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (f(xs[i])) return just(i);
  }
  return nothing;
};
var reverse = function(l) {
  return l.slice().reverse();
};
var filterImpl = function(f, xs) {
  return xs.filter(f);
};
var sortByImpl = /* @__PURE__ */ (function() {
  function mergeFromTo(compare5, fromOrdering, xs1, xs2, from, to) {
    var mid;
    var i;
    var j;
    var k;
    var x;
    var y;
    var c;
    mid = from + (to - from >> 1);
    if (mid - from > 1) mergeFromTo(compare5, fromOrdering, xs2, xs1, from, mid);
    if (to - mid > 1) mergeFromTo(compare5, fromOrdering, xs2, xs1, mid, to);
    i = from;
    j = mid;
    k = from;
    while (i < mid && j < to) {
      x = xs2[i];
      y = xs2[j];
      c = fromOrdering(compare5(x)(y));
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
  return function(compare5, fromOrdering, xs) {
    var out;
    if (xs.length < 2) return xs;
    out = xs.slice(0);
    mergeFromTo(compare5, fromOrdering, out, xs.slice(0), 0, xs.length);
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

// output/Data.Boolean/index.js
var otherwise = true;

// output/Data.Function/index.js
var flip = function(f) {
  return function(b) {
    return function(a) {
      return f(a)(b);
    };
  };
};
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

// output/Control.Apply/foreign.js
var arrayApply = function(fs) {
  return function(xs) {
    var l = fs.length;
    var k = xs.length;
    var result = new Array(l * k);
    var n = 0;
    for (var i = 0; i < l; i++) {
      var f = fs[i];
      for (var j = 0; j < k; j++) {
        result[n++] = f(xs[j]);
      }
    }
    return result;
  };
};

// output/Control.Apply/index.js
var applyArray = {
  apply: arrayApply,
  Functor0: function() {
    return functorArray;
  }
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
var bindArray = {
  bind: arrayBind,
  Apply0: function() {
    return applyArray;
  }
};
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
var topInt = 2147483647;
var bottomInt = -2147483648;
var topChar = String.fromCharCode(65535);
var bottomChar = String.fromCharCode(0);
var topNumber = Number.POSITIVE_INFINITY;
var bottomNumber = Number.NEGATIVE_INFINITY;

// output/Data.Ord/foreign.js
var unsafeCompareImpl = function(lt) {
  return function(eq5) {
    return function(gt) {
      return function(x) {
        return function(y) {
          return x < y ? lt : x === y ? eq5 : gt;
        };
      };
    };
  };
};
var ordIntImpl = unsafeCompareImpl;
var ordNumberImpl = unsafeCompareImpl;
var ordStringImpl = unsafeCompareImpl;

// output/Data.Eq/foreign.js
var refEq = function(r1) {
  return function(r2) {
    return r1 === r2;
  };
};
var eqBooleanImpl = refEq;
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
var eqBoolean = {
  eq: eqBooleanImpl
};
var eq = function(dict) {
  return dict.eq;
};
var eq2 = /* @__PURE__ */ eq(eqBoolean);
var notEq = function(dictEq) {
  var eq34 = eq(dictEq);
  return function(x) {
    return function(y) {
      return eq2(eq34(x)(y))(false);
    };
  };
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
var semigroupOrdering = {
  append: function(v) {
    return function(v1) {
      if (v instanceof LT) {
        return LT.value;
      }
      ;
      if (v instanceof GT) {
        return GT.value;
      }
      ;
      if (v instanceof EQ) {
        return v1;
      }
      ;
      throw new Error("Failed pattern match at Data.Ordering (line 21, column 1 - line 24, column 18): " + [v.constructor.name, v1.constructor.name]);
    };
  }
};
var eqOrdering = {
  eq: function(v) {
    return function(v1) {
      if (v instanceof LT && v1 instanceof LT) {
        return true;
      }
      ;
      if (v instanceof GT && v1 instanceof GT) {
        return true;
      }
      ;
      if (v instanceof EQ && v1 instanceof EQ) {
        return true;
      }
      ;
      return false;
    };
  }
};

// output/Data.Ring/foreign.js
var intSub = function(x) {
  return function(y) {
    return x - y | 0;
  };
};

// output/Data.Semiring/foreign.js
var intAdd = function(x) {
  return function(y) {
    return x + y | 0;
  };
};
var intMul = function(x) {
  return function(y) {
    return x * y | 0;
  };
};
var numAdd = function(n1) {
  return function(n2) {
    return n1 + n2;
  };
};
var numMul = function(n1) {
  return function(n2) {
    return n1 * n2;
  };
};

// output/Data.Semiring/index.js
var zero = function(dict) {
  return dict.zero;
};
var semiringNumber = {
  add: numAdd,
  zero: 0,
  mul: numMul,
  one: 1
};
var semiringInt = {
  add: intAdd,
  zero: 0,
  mul: intMul,
  one: 1
};
var add = function(dict) {
  return dict.add;
};

// output/Data.Ring/index.js
var sub = function(dict) {
  return dict.sub;
};
var ringInt = {
  sub: intSub,
  Semiring0: function() {
    return semiringInt;
  }
};
var negate = function(dictRing) {
  var sub1 = sub(dictRing);
  var zero2 = zero(dictRing.Semiring0());
  return function(a) {
    return sub1(zero2)(a);
  };
};

// output/Data.Ord/index.js
var ordString = /* @__PURE__ */ (function() {
  return {
    compare: ordStringImpl(LT.value)(EQ.value)(GT.value),
    Eq0: function() {
      return eqString;
    }
  };
})();
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
  var compare33 = compare(dictOrd);
  return function(f) {
    return function(x) {
      return function(y) {
        return compare33(f(x))(f(y));
      };
    };
  };
};
var greaterThanOrEq = function(dictOrd) {
  var compare33 = compare(dictOrd);
  return function(a1) {
    return function(a2) {
      var v = compare33(a1)(a2);
      if (v instanceof LT) {
        return false;
      }
      ;
      return true;
    };
  };
};
var lessThanOrEq = function(dictOrd) {
  var compare33 = compare(dictOrd);
  return function(a1) {
    return function(a2) {
      var v = compare33(a1)(a2);
      if (v instanceof GT) {
        return false;
      }
      ;
      return true;
    };
  };
};
var max = function(dictOrd) {
  var compare33 = compare(dictOrd);
  return function(x) {
    return function(y) {
      var v = compare33(x)(y);
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
  var compare33 = compare(dictOrd);
  return function(x) {
    return function(y) {
      var v = compare33(x)(y);
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
  var min12 = min(dictOrd);
  var max16 = max(dictOrd);
  return function(low) {
    return function(hi) {
      return function(x) {
        return min12(hi)(max16(low)(x));
      };
    };
  };
};
var abs = function(dictOrd) {
  var greaterThanOrEq1 = greaterThanOrEq(dictOrd);
  return function(dictRing) {
    var zero2 = zero(dictRing.Semiring0());
    var negate1 = negate(dictRing);
    return function(x) {
      var $99 = greaterThanOrEq1(x)(zero2);
      if ($99) {
        return x;
      }
      ;
      return negate1(x);
    };
  };
};

// output/Data.Bounded/index.js
var top = function(dict) {
  return dict.top;
};
var boundedInt = {
  top: topInt,
  bottom: bottomInt,
  Ord0: function() {
    return ordInt;
  }
};
var bottom = function(dict) {
  return dict.bottom;
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
var isNothing = /* @__PURE__ */ maybe(true)(/* @__PURE__ */ $$const(false));
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
var fromJust = function() {
  return function(v) {
    if (v instanceof Just) {
      return v.value0;
    }
    ;
    throw new Error("Failed pattern match at Data.Maybe (line 288, column 1 - line 288, column 46): " + [v.constructor.name]);
  };
};
var eqMaybe = function(dictEq) {
  var eq5 = eq(dictEq);
  return {
    eq: function(x) {
      return function(y) {
        if (x instanceof Nothing && y instanceof Nothing) {
          return true;
        }
        ;
        if (x instanceof Just && y instanceof Just) {
          return eq5(x.value0)(y.value0);
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
var unsafeThawImpl = unsafeFreezeThawImpl;
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
var unsafeThaw = /* @__PURE__ */ runSTFn1(unsafeThawImpl);
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

// output/Data.Tuple/index.js
var Tuple = /* @__PURE__ */ (function() {
  function Tuple2(value0, value1) {
    this.value0 = value0;
    this.value1 = value1;
  }
  ;
  Tuple2.create = function(value0) {
    return function(value1) {
      return new Tuple2(value0, value1);
    };
  };
  return Tuple2;
})();
var snd = function(v) {
  return v.value1;
};
var fst = function(v) {
  return v.value0;
};

// output/Data.Foldable/index.js
var eq12 = /* @__PURE__ */ eq(eqOrdering);
var foldr = function(dict) {
  return dict.foldr;
};
var foldl = function(dict) {
  return dict.foldl;
};
var maximumBy = function(dictFoldable) {
  var foldl22 = foldl(dictFoldable);
  return function(cmp) {
    var max$prime = function(v) {
      return function(v1) {
        if (v instanceof Nothing) {
          return new Just(v1);
        }
        ;
        if (v instanceof Just) {
          return new Just((function() {
            var $303 = eq12(cmp(v.value0)(v1))(GT.value);
            if ($303) {
              return v.value0;
            }
            ;
            return v1;
          })());
        }
        ;
        throw new Error("Failed pattern match at Data.Foldable (line 441, column 3 - line 441, column 27): " + [v.constructor.name, v1.constructor.name]);
      };
    };
    return foldl22(max$prime)(Nothing.value);
  };
};
var maximum = function(dictOrd) {
  var compare5 = compare(dictOrd);
  return function(dictFoldable) {
    return maximumBy(dictFoldable)(compare5);
  };
};
var sum = function(dictFoldable) {
  var foldl22 = foldl(dictFoldable);
  return function(dictSemiring) {
    return foldl22(add(dictSemiring))(zero(dictSemiring));
  };
};
var foldMapDefaultR = function(dictFoldable) {
  var foldr2 = foldr(dictFoldable);
  return function(dictMonoid) {
    var append4 = append(dictMonoid.Semigroup0());
    var mempty2 = mempty(dictMonoid);
    return function(f) {
      return foldr2(function(x) {
        return function(acc) {
          return append4(f(x))(acc);
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

// output/Data.FunctorWithIndex/foreign.js
var mapWithIndexArray = function(f) {
  return function(xs) {
    var l = xs.length;
    var result = Array(l);
    for (var i = 0; i < l; i++) {
      result[i] = f(i)(xs[i]);
    }
    return result;
  };
};

// output/Data.FunctorWithIndex/index.js
var mapWithIndex = function(dict) {
  return dict.mapWithIndex;
};
var functorWithIndexArray = {
  mapWithIndex: mapWithIndexArray,
  Functor0: function() {
    return functorArray;
  }
};

// output/Data.Array/index.js
var $$void2 = /* @__PURE__ */ $$void(functorST);
var map2 = /* @__PURE__ */ map(functorMaybe);
var map1 = /* @__PURE__ */ map(functorArray);
var map22 = /* @__PURE__ */ map(functorST);
var fromJust2 = /* @__PURE__ */ fromJust();
var when2 = /* @__PURE__ */ when(applicativeST);
var notEq2 = /* @__PURE__ */ notEq(eqOrdering);
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
var sortWith1 = /* @__PURE__ */ sortWith(ordInt);
var snoc = function(xs) {
  return function(x) {
    return withArray(push(x))(xs)();
  };
};
var slice = /* @__PURE__ */ runFn3(sliceImpl);
var take = function(n) {
  return function(xs) {
    var $152 = n < 1;
    if ($152) {
      return [];
    }
    ;
    return slice(0)(n)(xs);
  };
};
var singleton2 = function(a) {
  return [a];
};
var $$null = function(xs) {
  return length(xs) === 0;
};
var mapWithIndex2 = /* @__PURE__ */ mapWithIndex(functorWithIndexArray);
var index = /* @__PURE__ */ (function() {
  return runFn4(indexImpl)(Just.create)(Nothing.value);
})();
var last = function(xs) {
  return index(xs)(length(xs) - 1 | 0);
};
var head = function(xs) {
  return index(xs)(0);
};
var nubBy = function(comp) {
  return function(xs) {
    var indexedAndSorted = sortBy(function(x) {
      return function(y) {
        return comp(snd(x))(snd(y));
      };
    })(mapWithIndex2(Tuple.create)(xs));
    var v = head(indexedAndSorted);
    if (v instanceof Nothing) {
      return [];
    }
    ;
    if (v instanceof Just) {
      return map1(snd)(sortWith1(fst)((function __do() {
        var result = unsafeThaw(singleton2(v.value0))();
        foreach(indexedAndSorted)(function(v1) {
          return function __do2() {
            var lst = map22(/* @__PURE__ */ (function() {
              var $183 = function($185) {
                return fromJust2(last($185));
              };
              return function($184) {
                return snd($183($184));
              };
            })())(unsafeFreeze(result))();
            return when2(notEq2(comp(lst)(v1.value1))(EQ.value))($$void2(push(v1)(result)))();
          };
        })();
        return unsafeFreeze(result)();
      })()));
    }
    ;
    throw new Error("Failed pattern match at Data.Array (line 1115, column 17 - line 1123, column 28): " + [v.constructor.name]);
  };
};
var nub = function(dictOrd) {
  return nubBy(compare(dictOrd));
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
  var eq25 = eq(dictEq);
  return function(x) {
    return findIndex(function(v) {
      return eq25(v)(x);
    });
  };
};
var notElem2 = function(dictEq) {
  var elemIndex1 = elemIndex(dictEq);
  return function(a) {
    return function(arr) {
      return isNothing(elemIndex1(a)(arr));
    };
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
var concatMap = /* @__PURE__ */ flip(/* @__PURE__ */ bind(bindArray));
var mapMaybe = function(f) {
  return concatMap((function() {
    var $189 = maybe([])(singleton2);
    return function($190) {
      return $189(f($190));
    };
  })());
};
var any2 = /* @__PURE__ */ runFn2(anyImpl);
var nubByEq = function(eq25) {
  return function(xs) {
    return (function __do() {
      var arr = newSTArray();
      foreach(xs)(function(x) {
        return function __do2() {
          var e = map22((function() {
            var $194 = any2(function(v) {
              return eq25(v)(x);
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
var fromNumberImpl = function(just) {
  return function(nothing) {
    return function(n) {
      return (n | 0) === n ? just(n) : nothing;
    };
  };
};
var toNumber = function(n) {
  return n;
};

// output/Data.Number/foreign.js
var isFiniteImpl = isFinite;
var floor = Math.floor;
var pow = function(n) {
  return function(p) {
    return Math.pow(n, p);
  };
};
var round = Math.round;

// output/Data.Int/index.js
var top2 = /* @__PURE__ */ top(boundedInt);
var bottom2 = /* @__PURE__ */ bottom(boundedInt);
var fromNumber = /* @__PURE__ */ (function() {
  return fromNumberImpl(Just.create)(Nothing.value);
})();
var unsafeClamp = function(x) {
  if (!isFiniteImpl(x)) {
    return 0;
  }
  ;
  if (x >= toNumber(top2)) {
    return top2;
  }
  ;
  if (x <= toNumber(bottom2)) {
    return bottom2;
  }
  ;
  if (otherwise) {
    return fromMaybe(0)(fromNumber(x));
  }
  ;
  throw new Error("Failed pattern match at Data.Int (line 72, column 1 - line 72, column 29): " + [x.constructor.name]);
};
var floor2 = function($39) {
  return unsafeClamp(floor($39));
};

// output/Kernel.Growth/index.js
var map3 = /* @__PURE__ */ map(functorArray);
var sum2 = /* @__PURE__ */ sum(foldableArray);
var sum1 = /* @__PURE__ */ sum2(semiringNumber);
var nub2 = /* @__PURE__ */ nub(ordString);
var max3 = /* @__PURE__ */ max(ordNumber);
var min3 = /* @__PURE__ */ min(ordNumber);
var max1 = /* @__PURE__ */ max(ordInt);
var compare2 = /* @__PURE__ */ compare(ordInt);
var append2 = /* @__PURE__ */ append(semigroupArray);
var elem3 = /* @__PURE__ */ elem2(eqString);
var sum22 = /* @__PURE__ */ sum2(semiringInt);
var min1 = /* @__PURE__ */ min(ordInt);
var identity3 = /* @__PURE__ */ identity(categoryFn);
var Beginner = /* @__PURE__ */ (function() {
  function Beginner2() {
  }
  ;
  Beginner2.value = new Beginner2();
  return Beginner2;
})();
var Junior = /* @__PURE__ */ (function() {
  function Junior2() {
  }
  ;
  Junior2.value = new Junior2();
  return Junior2;
})();
var Mid = /* @__PURE__ */ (function() {
  function Mid2() {
  }
  ;
  Mid2.value = new Mid2();
  return Mid2;
})();
var Senior = /* @__PURE__ */ (function() {
  function Senior2() {
  }
  ;
  Senior2.value = new Senior2();
  return Senior2;
})();
var skillStates = /* @__PURE__ */ (function() {
  var step2 = function(states) {
    return function(seen) {
      var v = find2(function(state) {
        return state.skill === seen.skill;
      })(states);
      if (v instanceof Nothing) {
        return snoc(states)({
          skill: seen.skill,
          commit: seen.commit,
          rank: seen.rank,
          shownNow: seen.isShown,
          missedNow: !seen.isShown,
          shownBefore: false,
          missedBefore: false
        });
      }
      ;
      if (v instanceof Just) {
        return map3(function(state) {
          var $66 = state.skill !== seen.skill;
          if ($66) {
            return state;
          }
          ;
          var $67 = state.commit === seen.commit;
          if ($67) {
            return {
              commit: state.commit,
              skill: state.skill,
              missedBefore: state.missedBefore,
              rank: state.rank,
              shownBefore: state.shownBefore,
              shownNow: state.shownNow || seen.isShown,
              missedNow: state.missedNow || !seen.isShown
            };
          }
          ;
          return {
            skill: seen.skill,
            commit: seen.commit,
            rank: seen.rank,
            shownNow: seen.isShown,
            missedNow: !seen.isShown,
            shownBefore: v.value0.shownBefore || v.value0.shownNow,
            missedBefore: v.value0.missedBefore || v.value0.missedNow
          };
        })(states);
      }
      ;
      throw new Error("Failed pattern match at Kernel.Growth (line 248, column 22 - line 265, column 15): " + [v.constructor.name]);
    };
  };
  return foldl2(step2)([]);
})();
var selfStep = 0.25;
var recurringTimes = 3;
var reach = 4;
var rankOf = function(n) {
  if (n <= 0) {
    return Beginner.value;
  }
  ;
  if (n === 1) {
    return Junior.value;
  }
  ;
  if (n === 2) {
    return Mid.value;
  }
  ;
  if (otherwise) {
    return Senior.value;
  }
  ;
  throw new Error("Failed pattern match at Kernel.Growth (line 72, column 1 - line 72, column 22): " + [n.constructor.name]);
};
var rankNumber = function(v) {
  if (v instanceof Beginner) {
    return 0;
  }
  ;
  if (v instanceof Junior) {
    return 1;
  }
  ;
  if (v instanceof Mid) {
    return 2;
  }
  ;
  if (v instanceof Senior) {
    return 3;
  }
  ;
  throw new Error("Failed pattern match at Kernel.Growth (line 79, column 1 - line 79, column 26): " + [v.constructor.name]);
};
var placeObservations = 8;
var placeLines = 80;
var placeCommits = 3;
var ownAtLeast = 2;
var lessonCap = 2;
var item = function(kind) {
  return function(what) {
    return function(count) {
      return function(total) {
        return {
          kind,
          what,
          count,
          total
        };
      };
    };
  };
};
var isStillMissed = function(state) {
  return !state.shownNow && !state.shownBefore;
};
var isSlipping = function(state) {
  return !state.shownNow && state.shownBefore;
};
var isRecurring = function(topic) {
  return topic.flagged >= recurringTimes;
};
var isImproved = function(state) {
  return state.shownNow && (!state.missedNow && state.missedBefore);
};
var isFinished = function(lesson) {
  return lesson.steps > 0 && lesson.done >= lesson.steps;
};
var isUnderWay = function(lesson) {
  return lesson.done > 0 && !isFinished(lesson);
};
var habitPoints = 5;
var habitLooks = 12;
var isHabitImproved = function(topic) {
  return isRecurring(topic) && topic.sinceLooks >= habitLooks;
};
var isStillComing = function(topic) {
  return isRecurring(topic) && topic.sinceLooks < habitLooks;
};
var habitCap = 20;
var evidenceSpan = 80;
var eqRank = {
  eq: function(x) {
    return function(y) {
      if (x instanceof Beginner && y instanceof Beginner) {
        return true;
      }
      ;
      if (x instanceof Junior && y instanceof Junior) {
        return true;
      }
      ;
      if (x instanceof Mid && y instanceof Mid) {
        return true;
      }
      ;
      if (x instanceof Senior && y instanceof Senior) {
        return true;
      }
      ;
      return false;
    };
  }
};
var eq22 = /* @__PURE__ */ eq(/* @__PURE__ */ eqMaybe(eqRank));
var eq3 = /* @__PURE__ */ eq(eqRank);
var ordRank = {
  compare: function(x) {
    return function(y) {
      if (x instanceof Beginner && y instanceof Beginner) {
        return EQ.value;
      }
      ;
      if (x instanceof Beginner) {
        return LT.value;
      }
      ;
      if (y instanceof Beginner) {
        return GT.value;
      }
      ;
      if (x instanceof Junior && y instanceof Junior) {
        return EQ.value;
      }
      ;
      if (x instanceof Junior) {
        return LT.value;
      }
      ;
      if (y instanceof Junior) {
        return GT.value;
      }
      ;
      if (x instanceof Mid && y instanceof Mid) {
        return EQ.value;
      }
      ;
      if (x instanceof Mid) {
        return LT.value;
      }
      ;
      if (y instanceof Mid) {
        return GT.value;
      }
      ;
      if (x instanceof Senior && y instanceof Senior) {
        return EQ.value;
      }
      ;
      throw new Error("Failed pattern match at Kernel.Growth (line 0, column 0 - line 0, column 0): " + [x.constructor.name, y.constructor.name]);
    };
  },
  Eq0: function() {
    return eqRank;
  }
};
var lessThanOrEq1 = /* @__PURE__ */ lessThanOrEq(ordRank);
var greaterThanOrEq2 = /* @__PURE__ */ greaterThanOrEq(ordRank);
var missedLow = function(facts) {
  return sum1(map3(function(v) {
    return v.weight;
  })(filter(function(seen) {
    return !seen.isShown && lessThanOrEq1(seen.rank)(Junior.value);
  })(facts.seen)));
};
var ownAt = function(facts) {
  return function(rank) {
    return sum1(map3(function(v) {
      return v.weight;
    })(filter(function(seen) {
      return seen.isShown && greaterThanOrEq2(seen.rank)(rank);
    })(facts.seen)));
  };
};
var commitCount = function(seen) {
  return length(nub2(map3(function(v) {
    return v.commit;
  })(seen)));
};
var isPlaced = function(facts) {
  return length(facts.seen) >= placeObservations && (commitCount(facts.seen) >= placeCommits && facts.linesRead >= placeLines);
};
var clamp$prime = function(low) {
  return function(high) {
    return function(x) {
      return max3(low)(min3(high)(x));
    };
  };
};
var checkedStep = 0.5;
var lessonCredit = function(lesson) {
  return toNumber(lesson.checked) * checkedStep + toNumber(max1(0)(lesson.done - lesson.checked | 0)) * selfStep;
};
var evidenceAt = function(facts) {
  return function(rank) {
    var missed = sum1(map3(function(v) {
      return v.weight;
    })(filter(function(seen) {
      return !seen.isShown && lessThanOrEq1(seen.rank)(rank);
    })(facts.seen)));
    var lessons = min3(lessonCap)(sum1(map3(lessonCredit)(filter(function(lesson) {
      return lesson.isCounted && greaterThanOrEq2(lesson.rank)(rank);
    })(facts.lessons))));
    return ownAt(facts)(rank) + lessons - missed;
  };
};
var holds = function(facts) {
  return function(rank) {
    return evidenceAt(facts)(rank) >= reach && ownAt(facts)(rank) >= ownAtLeast;
  };
};
var byCount = /* @__PURE__ */ sortBy(function(a) {
  return function(b) {
    return compare2(b.count)(a.count);
  };
});
var beginnerNeeds = 2;
var levelOf = function(facts) {
  if (!isPlaced(facts)) {
    return Nothing.value;
  }
  ;
  if (otherwise) {
    var v = find2(holds(facts))([Senior.value, Mid.value, Junior.value]);
    if (v instanceof Just) {
      return new Just(v.value0);
    }
    ;
    if (v instanceof Nothing) {
      var $78 = missedLow(facts) >= beginnerNeeds;
      if ($78) {
        return new Just(Beginner.value);
      }
      ;
      return Nothing.value;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Growth (line 238, column 17 - line 240, column 85): " + [v.constructor.name]);
  }
  ;
  throw new Error("Failed pattern match at Kernel.Growth (line 235, column 1 - line 235, column 31): " + [facts.constructor.name]);
};
var alt2 = function(v) {
  return function(v1) {
    if (v instanceof Just) {
      return new Just(v.value0);
    }
    ;
    if (v instanceof Nothing) {
      return v1;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Growth (line 402, column 1 - line 402, column 47): " + [v.constructor.name, v1.constructor.name]);
  };
};
var above = function(v) {
  if (v instanceof Beginner) {
    return new Just(Junior.value);
  }
  ;
  if (v instanceof Junior) {
    return new Just(Mid.value);
  }
  ;
  if (v instanceof Mid) {
    return new Just(Senior.value);
  }
  ;
  if (v instanceof Senior) {
    return Nothing.value;
  }
  ;
  throw new Error("Failed pattern match at Kernel.Growth (line 85, column 1 - line 85, column 28): " + [v.constructor.name]);
};
var growthOf = function(facts) {
  var states = skillStates(facts.seen);
  var open = filter(function(lesson) {
    return lesson.isCounted && !isFinished(lesson);
  })(facts.lessons);
  var nub$prime = function(lessons) {
    return foldl2(function(kept2) {
      return function(lesson) {
        var $83 = any2(function(other) {
          return other.id === lesson.id;
        })(kept2);
        if ($83) {
          return kept2;
        }
        ;
        return snoc(kept2)(lesson);
      };
    })([])(lessons);
  };
  var level = levelOf(facts);
  var placeItem = (function() {
    var $84 = isPlaced(facts);
    if ($84) {
      var $85 = eq22(level)(Nothing.value);
      if ($85) {
        return [item("evidence")("")(0)(0)];
      }
      ;
      return [];
    }
    ;
    return append2((function() {
      var $86 = length(facts.seen) < placeObservations || commitCount(facts.seen) < placeCommits;
      if ($86) {
        return [item("place")("")(max1(0)(placeObservations - length(facts.seen) | 0))(max1(0)(placeCommits - commitCount(facts.seen) | 0))];
      }
      ;
      return [];
    })())((function() {
      var $87 = facts.linesRead < placeLines;
      if ($87) {
        return [item("lines")("")(placeLines - facts.linesRead | 0)(placeLines)];
      }
      ;
      return [];
    })());
  })();
  var target = (function() {
    if (level instanceof Nothing) {
      return Nothing.value;
    }
    ;
    if (level instanceof Just) {
      return above(level.value0);
    }
    ;
    throw new Error("Failed pattern match at Kernel.Growth (line 362, column 12 - line 364, column 28): " + [level.constructor.name]);
  })();
  var nextSkills = (function() {
    if (target instanceof Nothing) {
      return [];
    }
    ;
    if (target instanceof Just) {
      return map3(function(state) {
        return item("skill")(state.skill)(rankNumber(target.value0))(0);
      })(filter(function(state) {
        return eq3(state.rank)(target.value0) && !state.shownNow;
      })(states));
    }
    ;
    throw new Error("Failed pattern match at Kernel.Growth (line 367, column 16 - line 369, column 147): " + [target.constructor.name]);
  })();
  var ownItem = (function() {
    if (target instanceof Just && ownAt(facts)(target.value0) < ownAtLeast) {
      return [item("own")("")(rankNumber(target.value0))(0)];
    }
    ;
    return [];
  })();
  var habits = filter(isHabitImproved)(facts.topics);
  var improved = take(5)(append2(map3(function(topic) {
    return item("habit")(topic.topic)(topic.flagged)(topic.sinceLooks);
  })(habits))(append2(map3(function(state) {
    return item("skill")(state.skill)(0)(0);
  })(reverse(filter(isImproved)(states))))(map3(function(lesson) {
    return item("lesson")(lesson.title)(lesson.steps)(0);
  })(filter(isFinished)(facts.lessons)))));
  var habitLift = min3(habitCap)(toNumber(length(habits)) * habitPoints);
  var encouragement = (function() {
    if (improved.length === 0) {
      return Nothing.value;
    }
    ;
    return alt2(alt2(find2(function(it) {
      return it.kind === "habit";
    })(improved))(find2(function(it) {
      return it.kind === "skill";
    })(improved)))(find2(function(it) {
      return it.kind === "lesson";
    })(improved));
  })();
  var coming = filter(isStillComing)(facts.topics);
  var comingDrag = min3(habitCap)(toNumber(length(coming)) * habitPoints);
  var toNext = (function() {
    if (level instanceof Nothing) {
      return 0;
    }
    ;
    if (level instanceof Just) {
      var carried = (function() {
        var v = above(level.value0);
        if (v instanceof Just) {
          return clamp$prime(0)(1)(evidenceAt(facts)(v.value0) / reach) * evidenceSpan;
        }
        ;
        if (v instanceof Nothing) {
          return clamp$prime(0)(1)(evidenceAt(facts)(level.value0) / (2 * reach)) * evidenceSpan;
        }
        ;
        throw new Error("Failed pattern match at Kernel.Growth (line 325, column 19 - line 328, column 91): " + [v.constructor.name]);
      })();
      return floor2(clamp$prime(0)(99)(carried + habitLift - comingDrag));
    }
    ;
    throw new Error("Failed pattern match at Kernel.Growth (line 321, column 12 - line 330, column 67): " + [level.constructor.name]);
  })();
  var score = (function() {
    if (level instanceof Nothing) {
      return -1 | 0;
    }
    ;
    if (level instanceof Just) {
      return (rankNumber(level.value0) * 100 | 0) + toNext | 0;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Growth (line 332, column 11 - line 334, column 48): " + [level.constructor.name]);
  })();
  var focus = append2(map3(function(v) {
    return v.skill;
  })(filter(function(state) {
    return isSlipping(state) || isStillMissed(state);
  })(states)))(map3(function(v) {
    return v.topic;
  })(coming));
  var fits = function(lesson) {
    return any2(function(skill) {
      return elem3(skill)(focus);
    })(lesson.skills);
  };
  var neededHelp = take(5)(byCount(append2(map3(function(topic) {
    return item("asked")(topic.topic)(topic.explained)(0);
  })(filter(function(topic) {
    return topic.explained > 0;
  })(facts.topics)))(append2(map3(function(topic) {
    return item("flagged")(topic.topic)(topic.flagged)(0);
  })(coming))(map3(function(lesson) {
    return item("lesson")(lesson.title)(lesson.helped)(0);
  })(filter(function(lesson) {
    return lesson.helped > 0;
  })(facts.lessons))))));
  var workOn = take(6)(append2(map3(function(state) {
    return item("slipping")(state.skill)(0)(0);
  })(filter(isSlipping)(states)))(append2(map3(function(topic) {
    return item("recurring")(topic.topic)(topic.flagged)(0);
  })(sortBy(function(a) {
    return function(b) {
      return compare2(b.flagged)(a.flagged);
    };
  })(coming)))(append2(map3(function(state) {
    return item("missed")(state.skill)(0)(0);
  })(filter(isStillMissed)(states)))(map3(function(lesson) {
    return item("lesson")(lesson.title)(lesson.done)(lesson.steps);
  })(filter(isUnderWay)(facts.lessons))))));
  var atLeast = function(lesson) {
    if (level instanceof Nothing) {
      return true;
    }
    ;
    if (level instanceof Just) {
      return greaterThanOrEq2(lesson.rank)(level.value0);
    }
    ;
    throw new Error("Failed pattern match at Kernel.Growth (line 374, column 20 - line 376, column 37): " + [level.constructor.name]);
  };
  var suggested = take(2)(nub$prime(append2(filter(fits)(open))(append2(filter(function(lesson) {
    return eq22(new Just(lesson.rank))(target);
  })(open))(filter(atLeast)(open)))));
  var lessonItems = map3(function(lesson) {
    return item("lesson")(lesson.title)(lesson.done)(lesson.steps);
  })(suggested);
  var toRaise = take(5)(append2(placeItem)(append2(nextSkills)(append2(ownItem)(lessonItems))));
  return {
    level,
    score,
    toNext,
    shown: sum1(map3(function(v) {
      return v.weight;
    })(filter(function(v) {
      return v.isShown;
    })(facts.seen))),
    missed: sum1(map3(function(v) {
      return v.weight;
    })(filter(function($105) {
      return !(function(v) {
        return v.isShown;
      })($105);
    })(facts.seen))),
    lessonSteps: sum22(map3(function(v) {
      return v.done;
    })(facts.lessons)),
    habitsImproved: length(habits),
    stillComing: length(coming),
    workOn,
    neededHelp,
    improved,
    toRaise,
    encouragement
  };
};
var growthWire = function(wire) {
  var maybe$prime2 = function(fallback) {
    return function(f) {
      return function(v) {
        if (v instanceof Nothing) {
          return fallback;
        }
        ;
        if (v instanceof Just) {
          return f(v.value0);
        }
        ;
        throw new Error("Failed pattern match at Kernel.Growth (line 456, column 23 - line 458, column 18): " + [v.constructor.name]);
      };
    };
  };
  var grown = growthOf({
    seen: map3(function(seen) {
      return {
        commit: seen.commit,
        isShown: seen.isShown,
        skill: seen.skill,
        rank: rankOf(seen.rank),
        weight: clamp$prime(0)(1)(seen.weight)
      };
    })(wire.seen),
    lessons: map3(function(lesson) {
      return {
        steps: lesson.steps,
        helped: lesson.helped,
        id: lesson.id,
        isCounted: lesson.isCounted,
        skills: lesson.skills,
        title: lesson.title,
        rank: rankOf(lesson.rank),
        done: min1(lesson.steps)(max1(0)(lesson.done)),
        checked: max1(0)(min1(lesson.done)(lesson.checked))
      };
    })(wire.lessons),
    topics: wire.topics,
    linesRead: max1(0)(wire.linesRead)
  });
  return {
    rank: maybe$prime2(-1 | 0)(rankNumber)(grown.level),
    score: grown.score,
    toNext: grown.toNext,
    shown: grown.shown,
    missed: grown.missed,
    lessonSteps: grown.lessonSteps,
    habitsImproved: grown.habitsImproved,
    stillComing: grown.stillComing,
    workOn: grown.workOn,
    neededHelp: grown.neededHelp,
    improved: grown.improved,
    toRaise: grown.toRaise,
    encouragement: mapMaybe(identity3)([grown.encouragement])
  };
};

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
var min4 = /* @__PURE__ */ min(ordNumber);
var max4 = /* @__PURE__ */ max(ordInt);
var max12 = /* @__PURE__ */ max(ordNumber);
var elem4 = /* @__PURE__ */ elem2(eqString);
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
var eq32 = /* @__PURE__ */ eq(eqTrouble);
var retryDelayMs = function(trouble) {
  return function(failures) {
    return function(random) {
      var first = (function() {
        var $54 = eq32(trouble)(Offline.value) || eq32(trouble)(Timeout.value);
        if ($54) {
          return firstWaitOfflineMs;
        }
        ;
        return firstWaitMs;
      })();
      var whole = min4(longestWaitMs)(first * pow(2)(toNumber(max4(0)(failures - 1 | 0))));
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
          if (v1.value0.resetsAt instanceof Just && (eq32(v1.value0.trouble)(RateLimit.value) && v1.value0.resetsAt.value0 > v1.value0.at)) {
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
        var kept2 = (function() {
          if (v instanceof Waiting) {
            return max12(v.value0.until)(until);
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
          until: kept2,
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
var accountErrors = ["authentication_failed", "oauth_org_not_allowed", "account_on_hold", "verification_required", "billing_error", "cloud_credential_error"];
var troubleOf = function(error) {
  if (error === "rate_limit") {
    return RateLimit.value;
  }
  ;
  if (error === "overloaded") {
    return Overloaded.value;
  }
  ;
  if (elem4(error)(accountErrors)) {
    return Account.value;
  }
  ;
  if (elem4(error)(jobErrors)) {
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
var max5 = /* @__PURE__ */ max(ordNumber);
var min5 = /* @__PURE__ */ min(ordNumber);
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
          return max5(now + soonestCheckMs)(min5(now + beatMs)(lease.at + ttlMs + round(random * slackMs)));
        }
        ;
        throw new Error("Failed pattern match at Kernel.Lease (line 78, column 1 - line 78, column 59): " + [lease.constructor.name, me.constructor.name, now.constructor.name, random.constructor.name]);
      };
    };
  };
};

// output/Kernel.Ledger/index.js
var abs3 = /* @__PURE__ */ abs(ordInt)(ringInt);
var append3 = /* @__PURE__ */ append(semigroupOrdering);
var compare3 = /* @__PURE__ */ compare(ordNumber);
var compare12 = /* @__PURE__ */ compare(ordInt);
var map4 = /* @__PURE__ */ map(functorArray);
var elem5 = /* @__PURE__ */ elem2(eqInt);
var compare22 = /* @__PURE__ */ compare(ordString);
var max6 = /* @__PURE__ */ max(ordInt);
var maximum2 = /* @__PURE__ */ maximum(ordInt)(foldableArray);
var elem1 = /* @__PURE__ */ elem2(eqString);
var append1 = /* @__PURE__ */ append(semigroupArray);
var notElem3 = /* @__PURE__ */ notElem2(eqInt);
var Open = /* @__PURE__ */ (function() {
  function Open2() {
  }
  ;
  Open2.value = new Open2();
  return Open2;
})();
var Partly = /* @__PURE__ */ (function() {
  function Partly2() {
  }
  ;
  Partly2.value = new Partly2();
  return Partly2;
})();
var Resolved = /* @__PURE__ */ (function() {
  function Resolved2() {
  }
  ;
  Resolved2.value = new Resolved2();
  return Resolved2;
})();
var Dismissed = /* @__PURE__ */ (function() {
  function Dismissed2() {
  }
  ;
  Dismissed2.value = new Dismissed2();
  return Dismissed2;
})();
var Critical = /* @__PURE__ */ (function() {
  function Critical2() {
  }
  ;
  Critical2.value = new Critical2();
  return Critical2;
})();
var High = /* @__PURE__ */ (function() {
  function High2() {
  }
  ;
  High2.value = new High2();
  return High2;
})();
var Medium = /* @__PURE__ */ (function() {
  function Medium2() {
  }
  ;
  Medium2.value = new Medium2();
  return Medium2;
})();
var Low = /* @__PURE__ */ (function() {
  function Low2() {
  }
  ;
  Low2.value = new Low2();
  return Low2;
})();
var Security = /* @__PURE__ */ (function() {
  function Security2() {
  }
  ;
  Security2.value = new Security2();
  return Security2;
})();
var Bug = /* @__PURE__ */ (function() {
  function Bug2() {
  }
  ;
  Bug2.value = new Bug2();
  return Bug2;
})();
var EdgeCase = /* @__PURE__ */ (function() {
  function EdgeCase2() {
  }
  ;
  EdgeCase2.value = new EdgeCase2();
  return EdgeCase2;
})();
var Logic = /* @__PURE__ */ (function() {
  function Logic2() {
  }
  ;
  Logic2.value = new Logic2();
  return Logic2;
})();
var Robustness = /* @__PURE__ */ (function() {
  function Robustness2() {
  }
  ;
  Robustness2.value = new Robustness2();
  return Robustness2;
})();
var Quality = /* @__PURE__ */ (function() {
  function Quality2() {
  }
  ;
  Quality2.value = new Quality2();
  return Quality2;
})();
var Person = /* @__PURE__ */ (function() {
  function Person2() {
  }
  ;
  Person2.value = new Person2();
  return Person2;
})();
var Review = /* @__PURE__ */ (function() {
  function Review2() {
  }
  ;
  Review2.value = new Review2();
  return Review2;
})();
var Look = /* @__PURE__ */ (function() {
  function Look2() {
  }
  ;
  Look2.value = new Look2();
  return Look2;
})();
var statusWord = function(v) {
  if (v instanceof Open) {
    return "open";
  }
  ;
  if (v instanceof Partly) {
    return "partly";
  }
  ;
  if (v instanceof Resolved) {
    return "resolved";
  }
  ;
  if (v instanceof Dismissed) {
    return "dismissed";
  }
  ;
  throw new Error("Failed pattern match at Kernel.Ledger (line 233, column 14 - line 237, column 27): " + [v.constructor.name]);
};
var statusOf = function(v) {
  if (v === "open") {
    return new Just(Open.value);
  }
  ;
  if (v === "partly") {
    return new Just(Partly.value);
  }
  ;
  if (v === "resolved") {
    return new Just(Resolved.value);
  }
  ;
  if (v === "dismissed") {
    return new Just(Dismissed.value);
  }
  ;
  return Nothing.value;
};
var severityWord = function(v) {
  if (v instanceof Critical) {
    return "critical";
  }
  ;
  if (v instanceof High) {
    return "high";
  }
  ;
  if (v instanceof Medium) {
    return "medium";
  }
  ;
  if (v instanceof Low) {
    return "low";
  }
  ;
  throw new Error("Failed pattern match at Kernel.Ledger (line 200, column 16 - line 204, column 15): " + [v.constructor.name]);
};
var severityOf = function(v) {
  if (v === "critical") {
    return Critical.value;
  }
  ;
  if (v === "high") {
    return High.value;
  }
  ;
  if (v === "low") {
    return Low.value;
  }
  ;
  return Medium.value;
};
var ledgerNearLines = 3;
var ledgerMaxClosed = 60;
var isSame = function(candidate) {
  return function(finding) {
    return finding.file === candidate.file && (finding.topic === candidate.topic && (candidate.lineText !== "" && finding.lineText === candidate.lineText || abs3(finding.line - candidate.line | 0) <= ledgerNearLines));
  };
};
var eqStatus = {
  eq: function(x) {
    return function(y) {
      if (x instanceof Open && y instanceof Open) {
        return true;
      }
      ;
      if (x instanceof Partly && y instanceof Partly) {
        return true;
      }
      ;
      if (x instanceof Resolved && y instanceof Resolved) {
        return true;
      }
      ;
      if (x instanceof Dismissed && y instanceof Dismissed) {
        return true;
      }
      ;
      return false;
    };
  }
};
var eq23 = /* @__PURE__ */ eq(eqStatus);
var notEq22 = /* @__PURE__ */ notEq(eqStatus);
var isOpen = function(finding) {
  return eq23(finding.status)(Open.value) || eq23(finding.status)(Partly.value);
};
var pruned = function(v) {
  var closed = take(ledgerMaxClosed)(sortBy(function(a) {
    return function(b) {
      return append3(compare3(b.statusAt)(a.statusAt))(compare12(b.id)(a.id));
    };
  })(filter(function($144) {
    return !isOpen($144);
  })(v.findings)));
  var kept2 = map4(function(v1) {
    return v1.id;
  })(closed);
  return {
    nextId: v.nextId,
    coverage: v.coverage,
    findings: filter(function(f) {
      return isOpen(f) || elem5(f.id)(kept2);
    })(v.findings)
  };
};
var mayRule = function(actor) {
  return function(from) {
    return function(to) {
      var isOpenStatus = function(status) {
        return eq23(status)(Open.value) || eq23(status)(Partly.value);
      };
      if (actor instanceof Person) {
        return eq23(to)(Dismissed.value) || eq23(from)(Dismissed.value) && eq23(to)(Open.value);
      }
      ;
      if (actor instanceof Review) {
        return notEq22(from)(Dismissed.value) && notEq22(to)(Dismissed.value);
      }
      ;
      if (actor instanceof Look) {
        return isOpenStatus(from) && (eq23(to)(Resolved.value) || eq23(to)(Partly.value));
      }
      ;
      throw new Error("Failed pattern match at Kernel.Ledger (line 404, column 25 - line 407, column 64): " + [actor.constructor.name]);
    };
  };
};
var eqSeverity = {
  eq: function(x) {
    return function(y) {
      if (x instanceof Critical && y instanceof Critical) {
        return true;
      }
      ;
      if (x instanceof High && y instanceof High) {
        return true;
      }
      ;
      if (x instanceof Medium && y instanceof Medium) {
        return true;
      }
      ;
      if (x instanceof Low && y instanceof Low) {
        return true;
      }
      ;
      return false;
    };
  }
};
var eq33 = /* @__PURE__ */ eq(eqSeverity);
var notEq3 = /* @__PURE__ */ notEq(eqSeverity);
var ordSeverity = {
  compare: function(x) {
    return function(y) {
      if (x instanceof Critical && y instanceof Critical) {
        return EQ.value;
      }
      ;
      if (x instanceof Critical) {
        return LT.value;
      }
      ;
      if (y instanceof Critical) {
        return GT.value;
      }
      ;
      if (x instanceof High && y instanceof High) {
        return EQ.value;
      }
      ;
      if (x instanceof High) {
        return LT.value;
      }
      ;
      if (y instanceof High) {
        return GT.value;
      }
      ;
      if (x instanceof Medium && y instanceof Medium) {
        return EQ.value;
      }
      ;
      if (x instanceof Medium) {
        return LT.value;
      }
      ;
      if (y instanceof Medium) {
        return GT.value;
      }
      ;
      if (x instanceof Low && y instanceof Low) {
        return EQ.value;
      }
      ;
      throw new Error("Failed pattern match at Kernel.Ledger (line 0, column 0 - line 0, column 0): " + [x.constructor.name, y.constructor.name]);
    };
  },
  Eq0: function() {
    return eqSeverity;
  }
};
var compare32 = /* @__PURE__ */ compare(ordSeverity);
var eqCategory = {
  eq: function(x) {
    return function(y) {
      if (x instanceof Security && y instanceof Security) {
        return true;
      }
      ;
      if (x instanceof Bug && y instanceof Bug) {
        return true;
      }
      ;
      if (x instanceof EdgeCase && y instanceof EdgeCase) {
        return true;
      }
      ;
      if (x instanceof Logic && y instanceof Logic) {
        return true;
      }
      ;
      if (x instanceof Robustness && y instanceof Robustness) {
        return true;
      }
      ;
      if (x instanceof Quality && y instanceof Quality) {
        return true;
      }
      ;
      return false;
    };
  }
};
var ordCategory = {
  compare: function(x) {
    return function(y) {
      if (x instanceof Security && y instanceof Security) {
        return EQ.value;
      }
      ;
      if (x instanceof Security) {
        return LT.value;
      }
      ;
      if (y instanceof Security) {
        return GT.value;
      }
      ;
      if (x instanceof Bug && y instanceof Bug) {
        return EQ.value;
      }
      ;
      if (x instanceof Bug) {
        return LT.value;
      }
      ;
      if (y instanceof Bug) {
        return GT.value;
      }
      ;
      if (x instanceof EdgeCase && y instanceof EdgeCase) {
        return EQ.value;
      }
      ;
      if (x instanceof EdgeCase) {
        return LT.value;
      }
      ;
      if (y instanceof EdgeCase) {
        return GT.value;
      }
      ;
      if (x instanceof Logic && y instanceof Logic) {
        return EQ.value;
      }
      ;
      if (x instanceof Logic) {
        return LT.value;
      }
      ;
      if (y instanceof Logic) {
        return GT.value;
      }
      ;
      if (x instanceof Robustness && y instanceof Robustness) {
        return EQ.value;
      }
      ;
      if (x instanceof Robustness) {
        return LT.value;
      }
      ;
      if (y instanceof Robustness) {
        return GT.value;
      }
      ;
      if (x instanceof Quality && y instanceof Quality) {
        return EQ.value;
      }
      ;
      throw new Error("Failed pattern match at Kernel.Ledger (line 0, column 0 - line 0, column 0): " + [x.constructor.name, y.constructor.name]);
    };
  },
  Eq0: function() {
    return eqCategory;
  }
};
var compare4 = /* @__PURE__ */ compare(ordCategory);
var rankOrder = function(a) {
  return function(b) {
    return append3(compare32(a.severity)(b.severity))(append3(compare4(a.category)(b.category))(append3(compare22(a.file)(b.file))(append3(compare12(a.line)(b.line))(compare12(a.id)(b.id)))));
  };
};
var eqActor = {
  eq: function(x) {
    return function(y) {
      if (x instanceof Person && y instanceof Person) {
        return true;
      }
      ;
      if (x instanceof Review && y instanceof Review) {
        return true;
      }
      ;
      if (x instanceof Look && y instanceof Look) {
        return true;
      }
      ;
      return false;
    };
  }
};
var notEq4 = /* @__PURE__ */ notEq(eqActor);
var eq4 = /* @__PURE__ */ eq(eqActor);
var categoryWord = function(v) {
  if (v instanceof Security) {
    return "security";
  }
  ;
  if (v instanceof Bug) {
    return "bug";
  }
  ;
  if (v instanceof EdgeCase) {
    return "edge-case";
  }
  ;
  if (v instanceof Logic) {
    return "logic";
  }
  ;
  if (v instanceof Robustness) {
    return "robustness";
  }
  ;
  if (v instanceof Quality) {
    return "quality";
  }
  ;
  throw new Error("Failed pattern match at Kernel.Ledger (line 216, column 16 - line 222, column 23): " + [v.constructor.name]);
};
var findingToWire = function(f) {
  return {
    id: f.id,
    file: f.file,
    line: f.line,
    lineText: f.lineText,
    severity: severityWord(f.severity),
    category: categoryWord(f.category),
    topic: f.topic,
    title: f.title,
    text: f.text,
    condition: f.condition,
    origin: f.origin,
    commit: f.commit,
    at: f.at,
    status: statusWord(f.status),
    statusAt: f.statusAt,
    statusBy: f.statusBy,
    statusNote: f.statusNote,
    isPinned: f.isPinned
  };
};
var toWire = function(v) {
  return {
    nextId: v.nextId,
    findings: map4(findingToWire)(v.findings),
    coverage: v.coverage
  };
};
var categoryOf = function(v) {
  if (v === "security") {
    return Security.value;
  }
  ;
  if (v === "bug") {
    return Bug.value;
  }
  ;
  if (v === "edge-case") {
    return EdgeCase.value;
  }
  ;
  if (v === "logic") {
    return Logic.value;
  }
  ;
  if (v === "robustness") {
    return Robustness.value;
  }
  ;
  return Quality.value;
};
var findingFromWire = function(w) {
  return {
    id: w.id,
    file: w.file,
    line: max6(0)(w.line),
    lineText: w.lineText,
    severity: severityOf(w.severity),
    category: categoryOf(w.category),
    topic: w.topic,
    title: w.title,
    text: w.text,
    condition: w.condition,
    origin: w.origin,
    commit: w.commit,
    at: w.at,
    status: fromMaybe(Open.value)(statusOf(w.status)),
    statusAt: w.statusAt,
    statusBy: w.statusBy,
    statusNote: w.statusNote,
    isPinned: w.isPinned && (w.status !== "dismissed" && w.status !== "resolved")
  };
};
var fromWire = function(w) {
  var kept2 = nubByEq(function(a) {
    return function(b) {
      return a.id === b.id;
    };
  })(filter(function(f) {
    return f.id > 0 && (f.file !== "" && f.text !== "");
  })(map4(findingFromWire)(w.findings)));
  var top3 = fromMaybe(0)(maximum2(map4(function(v) {
    return v.id;
  })(kept2)));
  return pruned({
    nextId: max6(w.nextId)(top3 + 1 | 0),
    findings: kept2,
    coverage: w.coverage
  });
};
var ledgerAskedWire = function(files) {
  return function(ledger) {
    var v = fromWire(ledger);
    var isAsked = function(f) {
      return $$null(files) || elem1(f.file)(files);
    };
    return {
      open: map4(function(v1) {
        return v1.id;
      })(sortBy(rankOrder)(filter(function(f) {
        return isOpen(f) && isAsked(f);
      })(v.findings))),
      dismissed: map4(function(v1) {
        return v1.id;
      })(filter(function(f) {
        return eq23(f.status)(Dismissed.value) && isAsked(f);
      })(v.findings))
    };
  };
};
var ledgerCoveredWire = function(coverage) {
  return function(ledger) {
    var v = fromWire(ledger);
    return toWire({
      nextId: v.nextId,
      findings: v.findings,
      coverage
    });
  };
};
var ledgerNormalWire = function($145) {
  return toWire(fromWire($145));
};
var ledgerPersonWire = function(action) {
  return function(id) {
    return function(at) {
      return function(ledger) {
        var change = function(f) {
          if (f.id !== id) {
            return f;
          }
          ;
          if (otherwise) {
            if (action === "dismiss" && notEq22(f.status)(Dismissed.value)) {
              return {
                id: f.id,
                at: f.at,
                category: f.category,
                commit: f.commit,
                condition: f.condition,
                file: f.file,
                line: f.line,
                lineText: f.lineText,
                origin: f.origin,
                severity: f.severity,
                text: f.text,
                title: f.title,
                topic: f.topic,
                status: Dismissed.value,
                statusAt: at,
                statusBy: "person",
                statusNote: "",
                isPinned: false
              };
            }
            ;
            if (action === "restore" && eq23(f.status)(Dismissed.value)) {
              return {
                id: f.id,
                isPinned: f.isPinned,
                at: f.at,
                category: f.category,
                commit: f.commit,
                condition: f.condition,
                file: f.file,
                line: f.line,
                lineText: f.lineText,
                origin: f.origin,
                severity: f.severity,
                text: f.text,
                title: f.title,
                topic: f.topic,
                status: Open.value,
                statusAt: at,
                statusBy: "person",
                statusNote: ""
              };
            }
            ;
            if (action === "pin" && isOpen(f)) {
              return {
                at: f.at,
                category: f.category,
                commit: f.commit,
                condition: f.condition,
                file: f.file,
                id: f.id,
                line: f.line,
                lineText: f.lineText,
                origin: f.origin,
                severity: f.severity,
                status: f.status,
                statusAt: f.statusAt,
                statusBy: f.statusBy,
                statusNote: f.statusNote,
                text: f.text,
                title: f.title,
                topic: f.topic,
                isPinned: true
              };
            }
            ;
            if (action === "unpin") {
              return {
                at: f.at,
                category: f.category,
                commit: f.commit,
                condition: f.condition,
                file: f.file,
                id: f.id,
                line: f.line,
                lineText: f.lineText,
                origin: f.origin,
                severity: f.severity,
                status: f.status,
                statusAt: f.statusAt,
                statusBy: f.statusBy,
                statusNote: f.statusNote,
                text: f.text,
                title: f.title,
                topic: f.topic,
                isPinned: false
              };
            }
            ;
            return f;
          }
          ;
          throw new Error("Failed pattern match at Kernel.Ledger (line 447, column 3 - line 454, column 15): " + [f.constructor.name]);
        };
        var v = fromWire(ledger);
        return toWire(pruned({
          nextId: v.nextId,
          coverage: v.coverage,
          findings: map4(change)(v.findings)
        }));
      };
    };
  };
};
var ledgerViewsWire = function(facts) {
  return function(ledger) {
    var v = fromWire(ledger);
    var opened = sortBy(rankOrder)(filter(isOpen)(v.findings));
    var isSerious = function(f) {
      return eq33(f.severity)(Critical.value) || eq33(f.severity)(High.value);
    };
    var isNearby = function(f) {
      return elem1(f.file)(facts.savedFiles);
    };
    var wanted = append1(filter(function(v1) {
      return v1.isPinned;
    })(opened))(filter(function(f) {
      return !f.isPinned && (isSerious(f) && isNearby(f));
    })(opened));
    var play = map4(function(v1) {
      return v1.id;
    })(take(max6(0)(facts.cap))(wanted));
    var count = function(severity) {
      return length(filter(function(f) {
        return eq33(f.severity)(severity);
      })(opened));
    };
    var closed = sortBy(function(a) {
      return function(b) {
        return append3(compare3(b.statusAt)(a.statusAt))(compare12(b.id)(a.id));
      };
    })(filter(function($146) {
      return !isOpen($146);
    })(v.findings));
    return {
      ranked: map4(function(v1) {
        return v1.id;
      })(filter(function(f) {
        return notEq3(f.severity)(Low.value);
      })(opened)),
      folded: map4(function(v1) {
        return v1.id;
      })(filter(function(f) {
        return eq33(f.severity)(Low.value);
      })(opened)),
      closed: map4(function(v1) {
        return v1.id;
      })(closed),
      counts: {
        critical: count(Critical.value),
        high: count(High.value),
        medium: count(Medium.value),
        low: count(Low.value)
      },
      serious: count(Critical.value) + count(High.value) | 0,
      play,
      playMore: length(filter(function(f) {
        return (f.isPinned || isNearby(f)) && notElem3(f.id)(play);
      })(opened))
    };
  };
};
var actorWord = function(v) {
  if (v instanceof Person) {
    return "person";
  }
  ;
  if (v instanceof Review) {
    return "review";
  }
  ;
  if (v instanceof Look) {
    return "look";
  }
  ;
  throw new Error("Failed pattern match at Kernel.Ledger (line 246, column 13 - line 249, column 17): " + [v.constructor.name]);
};
var freshFinding = function(actor) {
  return function(at) {
    return function(origin) {
      return function(commit) {
        return function(candidate) {
          return function(id) {
            return {
              id,
              file: candidate.file,
              line: max6(0)(candidate.line),
              lineText: candidate.lineText,
              severity: severityOf(candidate.severity),
              category: categoryOf(candidate.category),
              topic: candidate.topic,
              title: candidate.title,
              text: candidate.text,
              condition: candidate.condition,
              origin,
              commit,
              at,
              status: Open.value,
              statusAt: at,
              statusBy: actorWord(actor),
              statusNote: "",
              isPinned: false
            };
          };
        };
      };
    };
  };
};
var raisedAgain = function(actor) {
  return function(at) {
    return function(candidate) {
      return function(finding) {
        var isBack = eq23(finding.status)(Resolved.value);
        return {
          id: finding.id,
          file: finding.file,
          topic: finding.topic,
          origin: finding.origin,
          commit: finding.commit,
          at: finding.at,
          isPinned: finding.isPinned,
          line: candidate.line,
          lineText: candidate.lineText,
          severity: severityOf(candidate.severity),
          category: categoryOf(candidate.category),
          title: candidate.title,
          text: candidate.text,
          condition: candidate.condition,
          status: (function() {
            if (isBack) {
              return Open.value;
            }
            ;
            return finding.status;
          })(),
          statusAt: (function() {
            if (isBack) {
              return at;
            }
            ;
            return finding.statusAt;
          })(),
          statusBy: (function() {
            if (isBack) {
              return actorWord(actor);
            }
            ;
            return finding.statusBy;
          })(),
          statusNote: (function() {
            if (isBack) {
              return "";
            }
            ;
            return finding.statusNote;
          })()
        };
      };
    };
  };
};
var foundStep = function(actor) {
  return function(at) {
    return function(origin) {
      return function(commit) {
        return function(acc) {
          return function(v) {
            var $130 = notEq4(actor)(Review.value) || (v.candidate.file === "" || v.candidate.text === "");
            if ($130) {
              return {
                ledger: acc.ledger,
                added: acc.added,
                matched: acc.matched,
                refused: snoc(acc.refused)(v.index)
              };
            }
            ;
            var v1 = find2(isSame(v.candidate))(acc.ledger.findings);
            if (v1 instanceof Just) {
              if (eq23(v1.value0.status)(Dismissed.value)) {
                return {
                  ledger: acc.ledger,
                  added: acc.added,
                  matched: acc.matched,
                  refused: snoc(acc.refused)(v.index)
                };
              }
              ;
              if (otherwise) {
                return {
                  added: acc.added,
                  refused: acc.refused,
                  ledger: {
                    nextId: acc.ledger.nextId,
                    coverage: acc.ledger.coverage,
                    findings: map4(function(f) {
                      var $132 = f.id === v1.value0.id;
                      if ($132) {
                        return raisedAgain(actor)(at)(v.candidate)(f);
                      }
                      ;
                      return f;
                    })(acc.ledger.findings)
                  },
                  matched: snoc(acc.matched)(v1.value0.id)
                };
              }
              ;
            }
            ;
            if (v1 instanceof Nothing) {
              return {
                matched: acc.matched,
                refused: acc.refused,
                ledger: {
                  coverage: acc.ledger.coverage,
                  nextId: acc.ledger.nextId + 1 | 0,
                  findings: snoc(acc.ledger.findings)(freshFinding(actor)(at)(origin)(commit)(v.candidate)(acc.ledger.nextId))
                },
                added: snoc(acc.added)(acc.ledger.nextId)
              };
            }
            ;
            throw new Error("Failed pattern match at Kernel.Ledger (line 379, column 12 - line 391, column 14): " + [v1.constructor.name]);
          };
        };
      };
    };
  };
};
var ruledStep = function(actor) {
  return function(at) {
    return function(acc) {
      return function(ruling) {
        var v = find2(function(f) {
          return f.id === ruling.id;
        })(acc.ledger.findings);
        var v1 = statusOf(ruling.status);
        if (v1 instanceof Just && (v instanceof Just && mayRule(actor)(v.value0.status)(v1.value0))) {
          var changed2 = {
            at: v.value0.at,
            category: v.value0.category,
            commit: v.value0.commit,
            condition: v.value0.condition,
            file: v.value0.file,
            id: v.value0.id,
            line: v.value0.line,
            lineText: v.value0.lineText,
            origin: v.value0.origin,
            text: v.value0.text,
            title: v.value0.title,
            topic: v.value0.topic,
            status: v1.value0,
            statusAt: at,
            statusBy: actorWord(actor),
            statusNote: ruling.note,
            severity: (function() {
              var $139 = eq4(actor)(Review.value) && ruling.severity !== "";
              if ($139) {
                return severityOf(ruling.severity);
              }
              ;
              return v.value0.severity;
            })(),
            isPinned: v.value0.isPinned && (notEq22(v1.value0)(Dismissed.value) && notEq22(v1.value0)(Resolved.value))
          };
          return {
            refused: acc.refused,
            ledger: {
              nextId: acc.ledger.nextId,
              coverage: acc.ledger.coverage,
              findings: map4(function(f) {
                var $140 = f.id === ruling.id;
                if ($140) {
                  return changed2;
                }
                ;
                return f;
              })(acc.ledger.findings)
            },
            applied: snoc(acc.applied)(ruling.id)
          };
        }
        ;
        return {
          ledger: acc.ledger,
          applied: acc.applied,
          refused: snoc(acc.refused)(ruling.id)
        };
      };
    };
  };
};
var actorOf = function(v) {
  if (v === "person") {
    return Person.value;
  }
  ;
  if (v === "review") {
    return Review.value;
  }
  ;
  return Look.value;
};
var ledgerFoundWire = function(actor) {
  return function(at) {
    return function(origin) {
      return function(commit) {
        return function(candidates) {
          return function(ledger) {
            var done = foldl2(foundStep(actorOf(actor))(at)(origin)(commit))({
              ledger: fromWire(ledger),
              added: [],
              matched: [],
              refused: []
            })(mapWithIndex2(function(index2) {
              return function(candidate) {
                return {
                  index: index2,
                  candidate
                };
              };
            })(candidates));
            return {
              ledger: toWire(pruned(done.ledger)),
              added: done.added,
              matched: done.matched,
              refused: done.refused
            };
          };
        };
      };
    };
  };
};
var ledgerRuledWire = function(actor) {
  return function(at) {
    return function(rulings) {
      return function(ledger) {
        var done = foldl2(ruledStep(actorOf(actor))(at))({
          ledger: fromWire(ledger),
          applied: [],
          refused: []
        })(rulings);
        return {
          ledger: toWire(pruned(done.ledger)),
          applied: done.applied,
          refused: done.refused
        };
      };
    };
  };
};

// output/Kernel.License/index.js
var max7 = /* @__PURE__ */ max(ordNumber);
var Unchosen = /* @__PURE__ */ (function() {
  function Unchosen2() {
  }
  ;
  Unchosen2.value = new Unchosen2();
  return Unchosen2;
})();
var Personal = /* @__PURE__ */ (function() {
  function Personal2() {
  }
  ;
  Personal2.value = new Personal2();
  return Personal2;
})();
var Commercial = /* @__PURE__ */ (function() {
  function Commercial2() {
  }
  ;
  Commercial2.value = new Commercial2();
  return Commercial2;
})();
var Unchosen$prime = /* @__PURE__ */ (function() {
  function Unchosen$prime2() {
  }
  ;
  Unchosen$prime2.value = new Unchosen$prime2();
  return Unchosen$prime2;
})();
var Personal$prime = /* @__PURE__ */ (function() {
  function Personal$prime2() {
  }
  ;
  Personal$prime2.value = new Personal$prime2();
  return Personal$prime2;
})();
var Licensed = /* @__PURE__ */ (function() {
  function Licensed2() {
  }
  ;
  Licensed2.value = new Licensed2();
  return Licensed2;
})();
var NeedsKey = /* @__PURE__ */ (function() {
  function NeedsKey2() {
  }
  ;
  NeedsKey2.value = new NeedsKey2();
  return NeedsKey2;
})();
var BadKey = /* @__PURE__ */ (function() {
  function BadKey2() {
  }
  ;
  BadKey2.value = new BadKey2();
  return BadKey2;
})();
var Expired = /* @__PURE__ */ (function() {
  function Expired2() {
  }
  ;
  Expired2.value = new Expired2();
  return Expired2;
})();
var Withdrawn = /* @__PURE__ */ (function() {
  function Withdrawn2() {
  }
  ;
  Withdrawn2.value = new Withdrawn2();
  return Withdrawn2;
})();
var Unchecked = /* @__PURE__ */ (function() {
  function Unchecked2() {
  }
  ;
  Unchecked2.value = new Unchecked2();
  return Unchecked2;
})();
var NoKey = /* @__PURE__ */ (function() {
  function NoKey2() {
  }
  ;
  NoKey2.value = new NoKey2();
  return NoKey2;
})();
var Malformed = /* @__PURE__ */ (function() {
  function Malformed2() {
  }
  ;
  Malformed2.value = new Malformed2();
  return Malformed2;
})();
var Forged = /* @__PURE__ */ (function() {
  function Forged2() {
  }
  ;
  Forged2.value = new Forged2();
  return Forged2;
})();
var Unverified = /* @__PURE__ */ (function() {
  function Unverified2() {
  }
  ;
  Unverified2.value = new Unverified2();
  return Unverified2;
})();
var Valid = /* @__PURE__ */ (function() {
  function Valid2() {
  }
  ;
  Valid2.value = new Valid2();
  return Valid2;
})();
var NoAnswer = /* @__PURE__ */ (function() {
  function NoAnswer2() {
  }
  ;
  NoAnswer2.value = new NoAnswer2();
  return NoAnswer2;
})();
var Active = /* @__PURE__ */ (function() {
  function Active2() {
  }
  ;
  Active2.value = new Active2();
  return Active2;
})();
var Revoked = /* @__PURE__ */ (function() {
  function Revoked2() {
  }
  ;
  Revoked2.value = new Revoked2();
  return Revoked2;
})();
var Unknown = /* @__PURE__ */ (function() {
  function Unknown2() {
  }
  ;
  Unknown2.value = new Unknown2();
  return Unknown2;
})();
var standingText = function(v) {
  if (v instanceof Unchosen$prime) {
    return "unchosen";
  }
  ;
  if (v instanceof Personal$prime) {
    return "personal";
  }
  ;
  if (v instanceof Licensed) {
    return "licensed";
  }
  ;
  if (v instanceof NeedsKey) {
    return "needs-key";
  }
  ;
  if (v instanceof BadKey) {
    return "bad-key";
  }
  ;
  if (v instanceof Expired) {
    return "expired";
  }
  ;
  if (v instanceof Withdrawn) {
    return "withdrawn";
  }
  ;
  if (v instanceof Unchecked) {
    return "unchecked";
  }
  ;
  throw new Error("Failed pattern match at Kernel.License (line 161, column 16 - line 169, column 27): " + [v.constructor.name]);
};
var fromWire2 = function(w) {
  var useOf = function(v) {
    if (v === "personal") {
      return Personal.value;
    }
    ;
    if (v === "commercial") {
      return Commercial.value;
    }
    ;
    return Unchosen.value;
  };
  var keyOf = function(v) {
    if (v === "malformed") {
      return Malformed.value;
    }
    ;
    if (v === "forged") {
      return Forged.value;
    }
    ;
    if (v === "unverified") {
      return Unverified.value;
    }
    ;
    if (v === "valid") {
      return Valid.value;
    }
    ;
    return NoKey.value;
  };
  var answerOf = function(v) {
    if (v === "active") {
      return Active.value;
    }
    ;
    if (v === "revoked") {
      return Revoked.value;
    }
    ;
    if (v === "unknown") {
      return Unknown.value;
    }
    ;
    return NoAnswer.value;
  };
  return {
    use: useOf(w.use),
    key: keyOf(w.key),
    expiresAt: w.expiresAt,
    keySince: w.keySince,
    hasServer: w.hasServer,
    answer: answerOf(w.answer),
    answeredAt: w.answeredAt,
    triedAt: w.triedAt,
    now: w.now
  };
};
var eqKeyState = {
  eq: function(x) {
    return function(y) {
      if (x instanceof NoKey && y instanceof NoKey) {
        return true;
      }
      ;
      if (x instanceof Malformed && y instanceof Malformed) {
        return true;
      }
      ;
      if (x instanceof Forged && y instanceof Forged) {
        return true;
      }
      ;
      if (x instanceof Unverified && y instanceof Unverified) {
        return true;
      }
      ;
      if (x instanceof Valid && y instanceof Valid) {
        return true;
      }
      ;
      return false;
    };
  }
};
var eq13 = /* @__PURE__ */ eq(eqKeyState);
var notEq5 = /* @__PURE__ */ notEq(eqKeyState);
var eqAnswer = {
  eq: function(x) {
    return function(y) {
      if (x instanceof NoAnswer && y instanceof NoAnswer) {
        return true;
      }
      ;
      if (x instanceof Active && y instanceof Active) {
        return true;
      }
      ;
      if (x instanceof Revoked && y instanceof Revoked) {
        return true;
      }
      ;
      if (x instanceof Unknown && y instanceof Unknown) {
        return true;
      }
      ;
      return false;
    };
  }
};
var eq24 = /* @__PURE__ */ eq(eqAnswer);
var dayMs = 864e5;
var everyMs = /* @__PURE__ */ (function() {
  return 7 * dayMs;
})();
var quietMs = /* @__PURE__ */ (function() {
  return 30 * dayMs;
})();
var standingOf = function(facts) {
  if (facts.use instanceof Unchosen) {
    return Unchosen$prime.value;
  }
  ;
  if (facts.use instanceof Personal) {
    return Personal$prime.value;
  }
  ;
  if (facts.use instanceof Commercial) {
    if (eq13(facts.key)(NoKey.value)) {
      return NeedsKey.value;
    }
    ;
    if (eq13(facts.key)(Malformed.value) || eq13(facts.key)(Forged.value)) {
      return BadKey.value;
    }
    ;
    if (facts.expiresAt > 0 && facts.now >= facts.expiresAt) {
      return Expired.value;
    }
    ;
    if (eq24(facts.answer)(Revoked.value)) {
      return Withdrawn.value;
    }
    ;
    if (facts.hasServer && facts.now - max7(facts.answeredAt)(facts.keySince) >= quietMs) {
      return Unchecked.value;
    }
    ;
    if (otherwise) {
      return Licensed.value;
    }
    ;
  }
  ;
  throw new Error("Failed pattern match at Kernel.License (line 94, column 20 - line 103, column 28): " + [facts.use.constructor.name]);
};
var licenseStandingWire = function($34) {
  return standingText(standingOf(fromWire2($34)));
};
var retryMs = dayMs;
var nextCheckAt = function(facts) {
  if (facts.use instanceof Commercial && (facts.hasServer && (notEq5(facts.key)(NoKey.value) && (notEq5(facts.key)(Malformed.value) && notEq5(facts.key)(Forged.value))))) {
    var $32 = facts.triedAt === 0;
    if ($32) {
      return facts.now;
    }
    ;
    var $33 = facts.answeredAt < facts.triedAt;
    if ($33) {
      return facts.triedAt + retryMs;
    }
    ;
    return facts.answeredAt + everyMs;
  }
  ;
  return 0;
};
var licenseNextCheckWire = function($35) {
  return nextCheckAt(fromWire2($35));
};

// output/Kernel.Pace/index.js
var max8 = /* @__PURE__ */ max(ordNumber);
var min6 = /* @__PURE__ */ min(ordNumber);
var slowedGapMs = function(minGapMs) {
  return function(factor) {
    if (factor === 1) {
      return minGapMs;
    }
    ;
    if (otherwise) {
      return max8(minGapMs)(6e4) * factor;
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
    return min6(6e5)(3e4 * pow(2)(toNumber(failures - 1 | 0)));
  }
  ;
  throw new Error("Failed pattern match at Kernel.Pace (line 66, column 1 - line 66, column 27): " + [failures.constructor.name]);
};

// output/Kernel.Play/index.js
var max9 = /* @__PURE__ */ max(ordNumber);
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
        return max9(facts.lastChangeAt.value0 + facts.quietMs)(facts.lastLookAt.value0 + slowedGapMs(facts.minGapMs)(gapFactor(facts.pressure.percent)) + backoffMs(facts.failures));
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
            until: new Just(max9(facts.health.value0.until)(dueAt)),
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
var max10 = /* @__PURE__ */ max(ordInt);
var map5 = /* @__PURE__ */ map(functorMaybe);
var max13 = /* @__PURE__ */ max(ordNumber);
var map12 = /* @__PURE__ */ map(functorArray);
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
var retryMs2 = function(attempts) {
  return retryBaseMs * pow(2)(toNumber(max10(0)(attempts - 1 | 0)));
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
    return fromMaybe(0)(map5(function(v1) {
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
            return notAnswering(health.value0.detail)("at " + clock(max13(health.value0.until)(fromMaybe(0)(retryAt))));
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
var fromWire3 = /* @__PURE__ */ (function() {
  var $76 = map12(waitingFromWire);
  return function($77) {
    return fromCommits($76($77));
  };
})();
var isSpentWire = function(commits) {
  return function(hash) {
    return isSpent(hash)(fromWire3(commits));
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
var eq14 = /* @__PURE__ */ eq(eqStage);
var isPastReview = function(wanted) {
  return function(commit) {
    return eq14(commit.stage)(ToAssess.value) || !wanted.wantsReview;
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
      return map12(function(v1) {
        return v1.hash;
      })(filter(isPastReview(wanted))(v));
    }
    ;
    throw new Error("Failed pattern match at Kernel.Queue (line 186, column 1 - line 186, column 45): " + [wanted.constructor.name, v.constructor.name]);
  };
};
var settledInWire = function(commits) {
  return function(wanted) {
    return settledIn(wanted)(fromWire3(commits));
  };
};
var nextToReview = function(wanted) {
  return function(v) {
    if (wanted.wantsReview) {
      return find2(function(commit) {
        return eq14(commit.stage)(ToReview.value);
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
    isReviewed: eq14(w.stage)(ToAssess.value),
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
    return nextToWire(nextToAssess(wanted)(fromWire3(commits)));
  };
};
var nextToReviewWire = function(commits) {
  return function(wanted) {
    return nextToWire(nextToReview(wanted)(fromWire3(commits)));
  };
};
var toWire2 = /* @__PURE__ */ (function() {
  var $78 = map12(waitingToWire);
  return function($79) {
    return $78(toCommits($79));
  };
})();
var through = function(change) {
  return function($80) {
    return toWire2(change(fromWire3($80)));
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
      return map12(function(commit) {
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
var min7 = /* @__PURE__ */ min(ordNumber);
var map6 = /* @__PURE__ */ map(functorArray);
var sortWith2 = /* @__PURE__ */ sortWith(ordNumber);
var max11 = /* @__PURE__ */ max(ordNumber);
var eq15 = /* @__PURE__ */ eq(/* @__PURE__ */ eqMaybe(eqNumber));
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
        return new Just(min7(v.value0)(v1.at));
      }
      ;
      throw new Error("Failed pattern match at Kernel.Schedule (line 54, column 3 - line 54, column 44): " + [v.constructor.name, v1.constructor.name]);
    };
  };
  return foldl2(first)(Nothing.value);
})();
var dueNow = function(now) {
  var $32 = map6(function(v) {
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
    return max11(0)(at - now);
  };
};
var delayMsWire = delayMs;
var arming = function(armedFor) {
  return function(deadlines) {
    var v = earliest(deadlines);
    if (eq15(v)(armedFor)) {
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
var min8 = /* @__PURE__ */ min(ordNumber);
var max14 = /* @__PURE__ */ max(ordNumber);
var slowScanWaitMs = 2e3;
var slowScanStepMs = 250;
var scanMs = 2e3;
var pushedScanMs = 3e4;
var longestScanGapMs = 32e3;
var longestFocusGapMs = 2e3;
var pushedFocusMs = longestFocusGapMs;
var idleScanMs = 5e3;
var idleAfterMs = 6e5;
var hotScanMs = 1e3;
var hotForMs = 6e4;
var scanGapMs = function(facts) {
  var slowness = floor(facts.lastScanMs / slowScanStepMs) * slowScanWaitMs;
  var base = (function() {
    if (facts.isPushed) {
      return pushedScanMs;
    }
    ;
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
    throw new Error("Failed pattern match at Kernel.Sensor (line 100, column 10 - line 106, column 28): " + [facts.activeAt.constructor.name]);
  })();
  return min8(longestScanGapMs)(base + slowness);
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
    lastScanMs: w.lastScanMs,
    isPushed: w.isPushed
  });
};
var focusScanMs = 100;
var focusGapMs = function(facts) {
  if (facts.isPushed) {
    return pushedFocusMs;
  }
  ;
  if (otherwise) {
    return min8(longestFocusGapMs)(max14(focusScanMs)(facts.tookMs * 4));
  }
  ;
  throw new Error("Failed pattern match at Kernel.Sensor (line 134, column 1 - line 134, column 35): " + [facts.constructor.name]);
};

// output/Kernel.Sessions/index.js
var max15 = /* @__PURE__ */ max(ordNumber);
var map7 = /* @__PURE__ */ map(functorArray);
var sortWith3 = /* @__PURE__ */ sortWith(ordNumber);
var Drawn = /* @__PURE__ */ (function() {
  function Drawn2() {
  }
  ;
  Drawn2.value = new Drawn2();
  return Drawn2;
})();
var Unsure = /* @__PURE__ */ (function() {
  function Unsure2() {
  }
  ;
  Unsure2.value = new Unsure2();
  return Unsure2;
})();
var Gone = /* @__PURE__ */ (function() {
  function Gone2() {
  }
  ;
  Gone2.value = new Gone2();
  return Gone2;
})();
var withdrawn = function(entries) {
  return function(session) {
    return filter(function(entry) {
      return entry.session !== session;
    })(entries);
  };
};
var sayEveryMs = 3e5;
var recheckMs = 2e3;
var keepMs = 864e5;
var kept = function(entries) {
  return function(now) {
    return filter(function(entry) {
      return now - max15(entry.at)(entry.leftAt) <= keepMs;
    })(entries);
  };
};
var left = function(entries) {
  return function(session) {
    return function(now) {
      var mark = function(entry) {
        if (entry.session === session && entry.leftAt === 0) {
          return {
            session: entry.session,
            at: entry.at,
            born: entry.born,
            cwd: entry.cwd,
            mode: entry.mode,
            leftAt: now
          };
        }
        ;
        if (otherwise) {
          return entry;
        }
        ;
        throw new Error("Failed pattern match at Kernel.Sessions (line 136, column 3 - line 138, column 24): " + [entry.constructor.name]);
      };
      return kept(map7(mark)(entries))(now);
    };
  };
};
var said = function(entries) {
  return function(entry) {
    return snoc(filter(function(other) {
      return other.session !== entry.session;
    })(kept(entries)(entry.at)))(entry);
  };
};
var isSayDue = function(saidAt) {
  return function(now) {
    return now - saidAt >= sayEveryMs;
  };
};
var hasTutorOn = function(entry) {
  return entry.mode === "on" || entry.mode === "paused";
};
var handoffMs = 6e4;
var checkEveryMs = 1e4;
var boundOf = function(drawing) {
  if (!drawing.isTerminal) {
    return Drawn.value;
  }
  ;
  if (drawing.surfaces > 0) {
    return Drawn.value;
  }
  ;
  if (drawing.wasUnsure) {
    return Gone.value;
  }
  ;
  if (otherwise) {
    return Unsure.value;
  }
  ;
  throw new Error("Failed pattern match at Kernel.Sessions (line 166, column 1 - line 166, column 28): " + [drawing.constructor.name]);
};
var boundWire = function(drawing) {
  var v = boundOf(drawing);
  if (v instanceof Drawn) {
    return "drawn";
  }
  ;
  if (v instanceof Unsure) {
    return "unsure";
  }
  ;
  if (v instanceof Gone) {
    return "gone";
  }
  ;
  throw new Error("Failed pattern match at Kernel.Sessions (line 174, column 21 - line 177, column 17): " + [v.constructor.name]);
};
var aliveMs = 66e4;
var isCurrent = function(entry) {
  return function(now) {
    if (entry.leftAt > 0) {
      return now - entry.leftAt <= handoffMs;
    }
    ;
    if (otherwise) {
      return now - entry.at <= aliveMs;
    }
    ;
    throw new Error("Failed pattern match at Kernel.Sessions (line 98, column 1 - line 98, column 40): " + [entry.constructor.name, now.constructor.name]);
  };
};
var carriedFrom = function(entries) {
  return function(asking) {
    var counts = function(entry) {
      return entry.born === asking.born && (entry.cwd === asking.cwd && (hasTutorOn(entry) && isCurrent(entry)(asking.now)));
    };
    var v = last(sortWith3(function(v1) {
      return v1.at;
    })(filter(counts)(entries)));
    if (v instanceof Just) {
      return {
        isFound: true,
        session: v.value0.session,
        mode: v.value0.mode
      };
    }
    ;
    if (v instanceof Nothing) {
      return {
        isFound: false,
        session: "",
        mode: "off"
      };
    }
    ;
    throw new Error("Failed pattern match at Kernel.Sessions (line 108, column 3 - line 110, column 60): " + [v.constructor.name]);
  };
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
var append12 = /* @__PURE__ */ append(semigroupArray);
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
  if (v instanceof Following) {
    return "following";
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
      return "Paused. /backseat resume to continue.";
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
        return ["Keeps failing: " + (joinWith(", ")(facts.failing) + ". /backseat debug dump saves the details.")];
      }
      ;
      throw new Error("Failed pattern match at Kernel.Status (line 109, column 3 - line 111, column 118): ");
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
    return joinWith(" ")(append12(service)(append12(slowGit)(keepsFailing)));
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
var sessionsWithdrawn = withdrawn;
var sessionsSayEveryMs = sayEveryMs;
var sessionsSaid = said;
var sessionsRecheckMs = recheckMs;
var sessionsLeft = left;
var sessionsKeepMs = keepMs;
var sessionsIsSayDue = isSayDue;
var sessionsHandoffMs = handoffMs;
var sessionsCheckEveryMs = checkEveryMs;
var sessionsCarriedFrom = carriedFrom;
var sessionsBound = boundWire;
var sessionsAliveMs = aliveMs;
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
  growthWire,
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
  ledgerAskedWire,
  ledgerCoveredWire,
  ledgerFoundWire,
  ledgerMaxClosed,
  ledgerNearLines,
  ledgerNormalWire,
  ledgerPersonWire,
  ledgerRuledWire,
  ledgerViewsWire,
  licenseNextCheckWire,
  licenseStandingWire,
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
  pushedFocusMs,
  pushedScanMs,
  readRetryMs,
  readTries,
  retryBaseMs,
  retryDelayMsWire,
  retryMs2 as retryMs,
  reviewedWire,
  scanGapMsWire,
  scanMs,
  sessionsAliveMs,
  sessionsBound,
  sessionsCarriedFrom,
  sessionsCheckEveryMs,
  sessionsHandoffMs,
  sessionsIsSayDue,
  sessionsKeepMs,
  sessionsLeft,
  sessionsRecheckMs,
  sessionsSaid,
  sessionsSayEveryMs,
  sessionsWithdrawn,
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
