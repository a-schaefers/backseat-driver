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
    throw new Error("Failed pattern match at Kernel.Pace (line 40, column 1 - line 40, column 42): " + [minGapMs.constructor.name, factor.constructor.name]);
  };
};
var slowFromPercent = 80;
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
  throw new Error("Failed pattern match at Kernel.Pace (line 32, column 1 - line 32, column 30): " + [percent.constructor.name]);
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
  throw new Error("Failed pattern match at Kernel.Pace (line 47, column 1 - line 47, column 27): " + [failures.constructor.name]);
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
      throw new Error("Failed pattern match at Kernel.Play (line 247, column 22 - line 252, column 63): " + [why.constructor.name]);
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
      throw new Error("Failed pattern match at Kernel.Play (line 244, column 26 - line 246, column 20): " + [until.constructor.name]);
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
    throw new Error("Failed pattern match at Kernel.Play (line 233, column 14 - line 242, column 67): " + [v.constructor.name]);
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
      throw new Error("Failed pattern match at Kernel.Play (line 101, column 7 - line 104, column 110): " + [facts.lastLookAt.constructor.name]);
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
      throw new Error("Failed pattern match at Kernel.Play (line 135, column 18 - line 137, column 21): " + [facts.lastChangeAt.constructor.name]);
    };
    var failed = (function() {
      var $45 = facts.failures > 0;
      if ($45) {
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
        throw new Error("Failed pattern match at Kernel.Play (line 132, column 30 - line 134, column 40): " + [failed.constructor.name]);
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
        throw new Error("Failed pattern match at Kernel.Play (line 129, column 14 - line 131, column 65): " + [failed.constructor.name]);
      }
      ;
      throw new Error("Failed pattern match at Kernel.Play (line 121, column 3 - line 131, column 65): " + [dueAt.constructor.name]);
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
    throw new Error("Failed pattern match at Kernel.Play (line 116, column 17 - line 118, column 31): " + [v.constructor.name]);
  }
  ;
  throw new Error("Failed pattern match at Kernel.Play (line 108, column 1 - line 108, column 24): " + [facts.constructor.name]);
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
    pressure: {
      isHeld: w.pressure.level === "held",
      percent: w.pressure.percent,
      window: w.pressure.window,
      resetsAt: (function() {
        if (w.pressure.hasResetsAt) {
          return new Just(w.pressure.resetsAt);
        }
        ;
        return Nothing.value;
      })()
    },
    jobBlock: w.jobBlock
  };
};
var isLookDueWire = function($77) {
  return isLookDue(factsFromWire($77));
};
var playOfWire = function($78) {
  return playToWire(playOf(factsFromWire($78)));
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
  throw new Error("Failed pattern match at Kernel.Play (line 259, column 20 - line 261, column 37): " + [v.constructor.name]);
};

// output/Kernel.Sensor/index.js
var min6 = /* @__PURE__ */ min(ordNumber);
var max7 = /* @__PURE__ */ max(ordNumber);
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
  return min6(longestScanGapMs)(base + slowness);
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
  return min6(longestFocusGapMs)(max7(focusScanMs)(tookMs * 4));
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
  backoffMs,
  focusGapMs,
  focusScanMs,
  gapFactor,
  hotForMs,
  hotScanMs,
  idleAfterMs,
  idleScanMs,
  isHeldAt,
  isLookDueWire,
  leaseBeatMs,
  leaseClaimed,
  leaseIsHeld,
  leaseNextCheck,
  leaseReleased,
  leaseSlackMs,
  leaseTtlMs,
  longestFocusGapMs,
  longestScanGapMs,
  mayAskWire,
  outcomeOfErrorWire,
  outcomeOfWire,
  playOfWire,
  retryDelayMsWire,
  scanGapMsWire,
  scanMs,
  slowedGapMs,
  stepWire,
  troubleOfWire,
  wakeAtWire
};
