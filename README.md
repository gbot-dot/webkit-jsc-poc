# WebKit / JavaScriptCore Security Research PoC

Controlled, non-weaponized regression and behavioral test harness for JavaScriptCore (JSC) and WebKit on ARM64 / iOS.

## Purpose

This project implements deterministic, executable test cases that exercise common vulnerability classes in JavaScriptCore and WebKit:

- Type confusion via speculative optimization and object shape transitions
- JIT compiler correctness (interpreter vs optimized code paths)
- Garbage collector lifetime and reachability checks
- Object representation inconsistencies (JSValue tagging, butterfly layout, array modes)
- Boundary checks that can be run from both browser and native JSC contexts

**No claim of a vulnerability is made.** The tests distinguish expected correct behavior from anomalies. If an anomaly is observed on a real target, it is logged with exact inputs and outputs for further analysis. Memory addresses, offsets, and engine internals are never invented.

## Target Environment Notes

Supplied user-agent:
```
Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0.1 Mobile/15E148 Safari/604.1
```

User-agent strings are **not** proof of the exact WebKit or JavaScriptCore build. They can be spoofed and do not uniquely identify the engine revision, compiler flags, or whether JIT is enabled. Actual verification requires:

- Reading `navigator.userAgent` and comparing it
- Querying JSC version via native APIs or known feature probes
- Measuring JIT status through timing and optimization heuristics
- Running the same tests under both the browser and the native harness

Target architecture: ARM64 / ARM64e  
Target platform: iOS 18.7 (WebKit / JavaScriptCore)

## Architecture

```
index.html          Browser-side interface (loads poc.js + verify.js)
poc.js              Core vulnerability-class reproducers (pure JS)
verify.js           Automated assertions and regression checks
harness.mm          Native Objective-C++ JSC host (JSContext)
results.md          Observed behavior template + verification notes
```

## Prerequisites

### Browser path
Any modern WebKit-based browser (Safari on iOS, or WebKitGTK / Safari Technology Preview on desktop for development).

### Native harness (macOS / iOS)
- Xcode 15+ or equivalent
- JavaScriptCore framework (present on macOS and iOS)
- For iOS device testing: provisioning profile and signed build

The native harness is provided as source. It is not compiled in this environment.

## Build and Execution

### Browser
1. Serve the directory or open `index.html` directly.
2. The page reports UA, attempts JSC version/JIT probes, and runs all tests.
3. Results are displayed and can be copied.

### Native harness (macOS example)
```bash
# From a machine with Xcode
clang++ -std=c++17 -framework JavaScriptCore -framework Foundation \
        harness.mm -o jsc-harness
./jsc-harness
```

On iOS the same source can be compiled into an app or used via the JavaScriptCore framework in a test target.

## What Is Verified vs Assumed

- **Verified here**: JavaScript logic, assertion structure, deterministic inputs, and the shape of the probes.
- **Requires target**: Actual JSC version string, JIT enablement, object representation layout, GC timing, and any deviation from expected results.
- **Not claimed**: Arbitrary code execution, memory corruption, or a concrete vulnerability.

## Files

All source files are complete and executable as written. See `results.md` for the observation template.