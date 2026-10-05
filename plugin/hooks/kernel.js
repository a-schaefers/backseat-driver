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
var findIndexImpl = function(just, nothing, f, xs) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (f(xs[i])) return just(i);
  }
  return nothing;
};

// output/Data.Boolean/index.js
var otherwise = true;

// output/Data.Function/index.js
var $$const = function(a) {
  return function(v) {
    return a;
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

// output/Data.Function.Uncurried/foreign.js
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
var findIndex = /* @__PURE__ */ (function() {
  return runFn4(findIndexImpl)(Just.create)(Nothing.value);
})();
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

// output/Data.Int/foreign.js
var toNumber = function(n) {
  return n;
};

// output/Data.Number/foreign.js
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
  function Waiting2(value0) {
    this.value0 = value0;
  }
  ;
  Waiting2.create = function(value0) {
    return new Waiting2(value0);
  };
  return Waiting2;
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
export {
  mayAskWire,
  outcomeOfErrorWire,
  outcomeOfWire,
  retryDelayMsWire,
  stepWire,
  troubleOfWire
};
