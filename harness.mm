// harness.mm — native Objective-C++ JavaScriptCore harness
// Compile on macOS:
//   clang++ -std=c++17 -framework JavaScriptCore -framework Foundation harness.mm -o jsc-harness
//
// This host embeds the same tests that run in the browser and additionally
// inspects JSValue types where the C API permits. It does not invent offsets.

#import <Foundation/Foundation.h>
#import <JavaScriptCore/JavaScriptCore.h>
#include <string>
#include <vector>
#include <iostream>

static void log(const std::string& s) {
    std::cout << s << std::endl;
}

static NSString* readFile(NSString* path) {
    NSError* err = nil;
    NSString* content = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:&err];
    if (err) {
        log(std::string("Failed to read ") + [path UTF8String] + ": " + [[err localizedDescription] UTF8String]);
        return nil;
    }
    return content;
}

int main(int argc, const char* argv[]) {
    @autoreleasepool {
        log("=== Native JavaScriptCore Harness ===");

        JSContext* ctx = [[JSContext alloc] init];
        if (!ctx) {
            log("Failed to create JSContext");
            return 1;
        }

        // Capture exceptions
        ctx.exceptionHandler = ^(JSContext* context, JSValue* exception) {
            log(std::string("JS Exception: ") + [[exception toString] UTF8String]);
        };

        // Load poc.js and verify.js (assume they sit next to the binary or pass paths)
        NSString* base = [[NSFileManager defaultManager] currentDirectoryPath];
        NSString* pocPath = [base stringByAppendingPathComponent:@"poc.js"];
        NSString* verPath = [base stringByAppendingPathComponent:@"verify.js"];

        NSString* pocSrc = readFile(pocPath);
        NSString* verSrc = readFile(verPath);
        if (!pocSrc || !verSrc) {
            log("Place poc.js and verify.js in the working directory.");
            return 1;
        }

        [ctx evaluateScript:pocSrc];
        [ctx evaluateScript:verSrc];

        // Environment probes available from native side
        JSValue* versionProbe = [ctx evaluateScript:
            @"(function(){"
            "  const ua = (typeof navigator !== 'undefined') ? navigator.userAgent : 'native-jsc';"
            "  return { ua: ua, hasWeakRef: typeof WeakRef !== 'undefined' };"
            "})()"];
        log(std::string("Probe: ") + [[versionProbe toString] UTF8String]);

        // Run the tests
        JSValue* runFn = ctx[@"runPocTests"];
        if ([runFn isUndefined] || [runFn isNull]) {
            log("runPocTests not found");
            return 1;
        }

        // Minimal logger
        ctx[@"nativeLog"] = ^(NSString* msg) {
            log([msg UTF8String]);
        };
        [ctx evaluateScript:@"function log(m){ if (typeof nativeLog === 'function') nativeLog(String(m)); else console.log(m); }"];

        JSValue* results = [runFn callWithArguments:@[]];
        if (ctx.exception) {
            log("Exception during runPocTests");
            return 1;
        }

        // Run verification
        JSValue* verifyFn = ctx[@"runVerification"];
        JSValue* report = [verifyFn callWithArguments:@[results]];
        log(std::string("Verification: ") + [[report toString] UTF8String]);

        // Additional native-side type inspection example
        JSValue* sample = [ctx evaluateScript:@"({n: 42, s: 'hi', a: [1,2,3]})"];
        log(std::string("Sample isObject: ") + ([sample isObject] ? "yes" : "no"));
        log(std::string("Sample.n isNumber: ") + ([[sample valueForProperty:@"n"] isNumber] ? "yes" : "no"));

        log("=== Harness finished ===");
        return 0;
    }
}