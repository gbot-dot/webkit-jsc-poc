// poc.js — executable vulnerability-class reproducers
// Pure JavaScript. Runs in browser or native JSC.
// Does not invent addresses or claim memory corruption.

(function (global) {
  'use strict';

  const results = {
    typeConfusion: [],
    jitCorrectness: [],
    gcLifetime: [],
    objectRep: [],
    anomalies: [],
  };

  function record(category, name, expected, actual, meta = {}) {
    const entry = { name, expected, actual, ok: Object.is(expected, actual), meta, ts: Date.now() };
    results[category].push(entry);
    if (!entry.ok) results.anomalies.push(entry);
    return entry;
  }

  // ---------------------------------------------------------------------------
  // 1. Type confusion / speculative optimization patterns
  // ---------------------------------------------------------------------------
  function testSpeculativeTypeConfusion() {
    // Force a monomorphic call site, then change the type
    function add(a, b) { return a + b; }

    // Warm with numbers
    for (let i = 0; i < 10000; i++) add(1, 2);

    // Now pass strings — should still be correct (or throw if strict)
    const r1 = add('a', 'b');
    record('typeConfusion', 'string after number monomorphic', 'ab', r1);

    // Object shape transition under speculation
    function getX(o) { return o.x; }
    const proto = { x: 42 };
    const o1 = Object.create(proto);
    for (let i = 0; i < 5000; i++) getX(o1);

    const o2 = { x: 'changed' };
    const r2 = getX(o2);
    record('typeConfusion', 'shape transition after warm', 'changed', r2);

    // Array mode change
    const arr = [1, 2, 3];
    function sum(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; }
    for (let i = 0; i < 2000; i++) sum(arr);
    arr.push('4');
    const r3 = sum(arr);
    record('typeConfusion', 'array mode after push string', '64', r3); // 0+1+2+3+'4' => '64'
  }

  // ---------------------------------------------------------------------------
  // 2. JIT correctness (interpreter vs optimized)
  // ---------------------------------------------------------------------------
  function testJitCorrectness() {
    function compute(n) {
      let acc = 0;
      for (let i = 0; i < n; i++) {
        acc = (acc + i) | 0; // force int32
      }
      return acc;
    }

    const small = compute(10);
    // Force optimization by repeated calls
    for (let i = 0; i < 100000; i++) compute(100);
    const large = compute(1000);

    // Expected values are deterministic
    const expectedSmall = 45; // sum 0..9
    let expectedLarge = 0;
    for (let i = 0; i < 1000; i++) expectedLarge = (expectedLarge + i) | 0;

    record('jitCorrectness', 'small loop', expectedSmall, small);
    record('jitCorrectness', 'large loop after warm', expectedLarge, large);

    // Side-effect order
    let side = 0;
    function withSide(x) { side++; return x; }
    function use(a, b) { return withSide(a) + withSide(b); }
    for (let i = 0; i < 1000; i++) use(1, 2);
    side = 0;
    const r = use(3, 4);
    record('jitCorrectness', 'side effect count', 2, side);
    record('jitCorrectness', 'side effect result', 7, r);
  }

  // ---------------------------------------------------------------------------
  // 3. GC lifetime / reachability
  // ---------------------------------------------------------------------------
  function testGcLifetime() {
    const held = [];
    function createAndDrop() {
      const obj = { value: Math.random(), data: new Array(1000).fill(0) };
      held.push(new WeakRef(obj));
      return obj.value;
    }

    const values = [];
    for (let i = 0; i < 100; i++) values.push(createAndDrop());

    // Encourage collection
    if (typeof gc === 'function') {
      gc();
    } else {
      // Browser: allocate pressure
      const pressure = [];
      for (let i = 0; i < 1000; i++) pressure.push(new Array(10000));
    }

    let alive = 0;
    for (const wr of held) {
      if (wr.deref() !== undefined) alive++;
    }

    // We do not assert a specific alive count — only that the mechanism works
    // and that previously returned values are still numbers.
    const allNumbers = values.every(v => typeof v === 'number');
    record('gcLifetime', 'returned values remain numbers', true, allNumbers, { alive, total: held.length });
    record('gcLifetime', 'WeakRef mechanism present', true, typeof WeakRef === 'function');
  }

  // ---------------------------------------------------------------------------
  // 4. Object representation consistency
  // ---------------------------------------------------------------------------
  function testObjectRepresentation() {
    // Dense vs sparse
    const dense = [1, 2, 3, 4];
    const sparse = [];
    sparse[0] = 1;
    sparse[100] = 2;

    function sumDense(a) { return a.reduce((s, v) => s + (v | 0), 0); }
    record('objectRep', 'dense array sum', 10, sumDense(dense));
    record('objectRep', 'sparse array length', 101, sparse.length);
    record('objectRep', 'sparse hole', undefined, sparse[50]);

    // Prototype chain
    const base = { a: 1 };
    const child = Object.create(base);
    child.b = 2;
    record('objectRep', 'proto lookup', 1, child.a);
    record('objectRep', 'own property', 2, child.b);

    // Typed array
    const ta = new Uint32Array([0xffffffff, 1]);
    record('objectRep', 'uint32 wrap', 0xffffffff, ta[0]);
    record('objectRep', 'uint32 next', 1, ta[1]);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  async function runPocTests(logger = console.log) {
    logger('Running type confusion probes...');
    testSpeculativeTypeConfusion();
    logger('Running JIT correctness probes...');
    testJitCorrectness();
    logger('Running GC lifetime probes...');
    testGcLifetime();
    logger('Running object representation probes...');
    testObjectRepresentation();

    logger(`Anomalies observed: ${results.anomalies.length}`);
    return results;
  }

  global.runPocTests = runPocTests;
  global.getPocResults = () => results;
})(typeof window !== 'undefined' ? window : globalThis);
