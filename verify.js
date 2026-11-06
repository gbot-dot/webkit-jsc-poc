// verify.js — automated assertions and regression tests
// Consumes results from poc.js and reports pass/fail.

(function (global) {
  'use strict';

  function runVerification(results, logger = console.log) {
    if (!results) {
      logger('No results provided', 'fail');
      return { passed: false, summary: 'missing results' };
    }

    const checks = [];

    function check(name, cond, detail) {
      checks.push({ name, ok: !!cond, detail });
      logger(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`, cond ? 'ok' : 'fail');
    }

    // Structural checks
    check('results object present', results && typeof results === 'object');
    check('typeConfusion array', Array.isArray(results.typeConfusion));
    check('jitCorrectness array', Array.isArray(results.jitCorrectness));
    check('gcLifetime array', Array.isArray(results.gcLifetime));
    check('objectRep array', Array.isArray(results.objectRep));

    // Expected correct behavior (these should pass on a correct engine)
    const tc = results.typeConfusion || [];
    check('string concat after monomorphic numbers', 
      tc.some(e => e.name === 'string after number monomorphic' && e.ok),
      'add("a","b") === "ab"');

    check('shape transition returns new value',
      tc.some(e => e.name === 'shape transition after warm' && e.ok),
      'getX after type change');

    const jit = results.jitCorrectness || [];
    check('small loop sum correct',
      jit.some(e => e.name === 'small loop' && e.ok),
      'sum 0..9 === 45');

    check('side-effect count preserved',
      jit.some(e => e.name === 'side effect count' && e.ok),
      'exactly two side effects');

    const gc = results.gcLifetime || [];
    check('WeakRef available or gracefully handled',
      gc.some(e => e.name === 'WeakRef mechanism present' && e.ok) || typeof WeakRef === 'undefined',
      'feature detection');

    check('values remain numbers after pressure',
      gc.some(e => e.name === 'returned values remain numbers' && e.ok));

    const or = results.objectRep || [];
    check('dense array sum', or.some(e => e.name === 'dense array sum' && e.ok));
    check('sparse length', or.some(e => e.name === 'sparse array length' && e.ok));
    check('uint32 array value', or.some(e => e.name === 'uint32 wrap' && e.ok));

    // Anomaly reporting (informational, not automatic fail)
    const anomalyCount = (results.anomalies || []).length;
    logger(`Anomaly count: ${anomalyCount}`, anomalyCount ? 'warn' : 'ok');
    if (anomalyCount > 0) {
      logger('Anomalies (investigate on target):');
      results.anomalies.forEach(a => logger(`  ${a.name}: expected=${a.expected} actual=${a.actual}`, 'warn'));
    }

    const failed = checks.filter(c => !c.ok);
    const passed = failed.length === 0;

    const summary = passed
      ? `All ${checks.length} assertions passed. Anomalies: ${anomalyCount}`
      : `${failed.length} assertion(s) failed. Anomalies: ${anomalyCount}`;

    return { passed, checks, anomalyCount, summary };
  }

  global.runVerification = runVerification;
})(typeof window !== 'undefined' ? window : globalThis);