# Results — WebKit / JSC Security Research PoC

## Test Environment (this workspace)

- Host: Linux x86_64 (sandbox)
- Node.js: v20.20.2 (used only for syntax validation of the JS files)
- JavaScriptCore: not present
- WebKit: not present
- Target UA supplied but not executable here

**No native JSC or iOS Safari was available in the generation environment.** All claims below are limited to what the source implements and what can be statically verified.

## What Was Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| poc.js | Complete | Four vulnerability-class probes with deterministic expected values |
| verify.js | Complete | Assertion suite over the probe results |
| index.html | Complete | Browser runner with UA + JIT timing heuristic |
| harness.mm | Complete source | Objective-C++ JSContext host; requires macOS/iOS + JavaScriptCore to compile |
| README.md | Complete | Architecture, build steps, UA vs real version distinction |

## Expected Behavior on a Correct Engine

The following outcomes are the correct, non-vulnerable results. Any deviation on a real target is an anomaly worth investigation; it is **not** automatically a vulnerability.

- `add("a", "b")` after numeric warm-up returns `"ab"`
- Shape transition after monomorphic warm-up returns the new property value
- Integer loop sums match the closed-form / iterative expectation
- Side-effect counters fire exactly once per call
- Dense array reduce produces the arithmetic sum
- Uint32Array stores the full 32-bit value
- WeakRef (when present) and returned primitive values remain consistent under allocation pressure

## Observed in Generation Environment

- JavaScript syntax of poc.js and verify.js is valid (Node parse check).
- No runtime execution against JavaScriptCore occurred.
- No memory corruption, type confusion exploit, or arbitrary code execution was demonstrated or claimed.

## How to Record Real Results

On a machine with the target Safari / WebKit or a built JavaScriptCore:

1. Open `index.html` in the target browser.
2. Click “Run all tests”.
3. Copy the full log into this file under a new heading with date, exact UA, and device.
4. For the native path, compile `harness.mm` and run it; append its stdout.

## Missing for Full Verification on the Specified UA

- An actual iOS 18.7 device or simulator with the matching WebKit build.
- Ability to read the precise JavaScriptCore version string (via private APIs or a debug build).
- Confirmation that the JIT is enabled for the test functions (the timing heuristic is only a hint).
- ARM64 / ARM64e pointer authentication and PAC behavior (not observable from pure JS).

Until those are available, the artifact remains a complete, executable regression harness for the named vulnerability classes, not a confirmed exploit.