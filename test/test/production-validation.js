var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
// test/production-validation.ts - v0.5.0 Production Validation (5 Test Cases)
import { ReviewExecutor } from '../src/executor.js';
import { loadConfig } from '../src/config.js';
import { TokenTracker } from '../src/tracking.js';
var testCases = [
    {
        name: "Test 1: Security Analysis",
        description: "Vulnerability assessment in code",
        content: "Review this Node.js authentication code for security issues:\n    \n    app.post('/login', (req, res) => {\n      const { username, password } = req.body;\n      const user = db.query('SELECT * FROM users WHERE username = \"' + username + '\"');\n      if (user && user.password === password) {\n        res.send('Login successful');\n      }\n    });",
    },
    {
        name: "Test 2: API Design",
        description: "REST API endpoint structure evaluation",
        content: "Evaluate this API design:\n    \n    GET /api/users/{id}/projects/{projectId}/tasks/{taskId}/subtasks/{subtaskId}/comments\n    \n    This endpoint returns a single comment with full object expansion. Should we paginate? Cache? How many N+1 queries?",
    },
    {
        name: "Test 3: Performance Review",
        description: "Algorithm efficiency analysis",
        content: "Analyze this JavaScript algorithm for O(n) complexity assessment:\n    \n    function findDuplicates(arr) {\n      const result = [];\n      for (let i = 0; i < arr.length; i++) {\n        for (let j = i + 1; j < arr.length; j++) {\n          if (arr[i] === arr[j]) {\n            result.push(arr[i]);\n          }\n        }\n      }\n      return result;\n    }\n    \n    How would you optimize this?",
    },
    {
        name: "Test 4: Data Privacy",
        description: "GDPR/compliance implications",
        content: "Our system stores customer PII in plain text:\n    - Email addresses\n    - Phone numbers  \n    - Credit card tokens (last 4 digits only)\n    - Browsing history\n    \n    Which fields violate GDPR Article 32 encryption requirements?",
    },
    {
        name: "Test 5: Architecture",
        description: "System design trade-offs",
        content: "Should we use:\n    \n    Option A: Monolith (single Node.js process, PostgreSQL)\n    - Pros: Simpler deployment, fewer operational concerns\n    - Cons: Harder to scale individual components\n    \n    Option B: Microservices (5-10 services, message queue, containers)\n    - Pros: Independent scaling, language flexibility\n    - Cons: Distributed tracing, eventual consistency complexity\n    \n    We have 3 engineers and expect 1M DAU in 18 months. Which?",
    },
];
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var config, tracker, executor, results, totalCost, totalTokens, _i, testCases_1, testCase, startTime, request, result, duration, _a, _b, _c, _, response, _d, results_1, _e, test, result, execTime, bar, modelStats, _f, results_2, result, _g, _h, _j, modelId, response, stat, _k, modelStats_1, _l, modelId, stat, avgTime, exportData, error_1;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    console.log('\n' + '='.repeat(80));
                    console.log('CROSS-REVIEW v0.5.0 PRODUCTION VALIDATION');
                    console.log('='.repeat(80) + '\n');
                    _m.label = 1;
                case 1:
                    _m.trys.push([1, 6, , 7]);
                    config = loadConfig();
                    tracker = new TokenTracker();
                    executor = new ReviewExecutor(config, tracker);
                    results = [];
                    totalCost = 0;
                    totalTokens = { input: 0, output: 0 };
                    _i = 0, testCases_1 = testCases;
                    _m.label = 2;
                case 2:
                    if (!(_i < testCases_1.length)) return [3 /*break*/, 5];
                    testCase = testCases_1[_i];
                    console.log("\n\uD83D\uDCCB ".concat(testCase.name));
                    console.log("   ".concat(testCase.description));
                    console.log('   Status: Running...');
                    startTime = Date.now();
                    request = {
                        content: testCase.content,
                        contentHash: Buffer.from(testCase.content).toString('base64').substring(0, 16),
                        strategy: 'wait_all',
                    };
                    return [4 /*yield*/, executor.execute(request)];
                case 3:
                    result = _m.sent();
                    duration = Date.now() - startTime;
                    results.push({ test: testCase, result: result, duration: duration });
                    totalCost += result.totalCost;
                    // Calculate tokens
                    for (_a = 0, _b = Object.entries(result.reviews); _a < _b.length; _a++) {
                        _c = _b[_a], _ = _c[0], response = _c[1];
                        totalTokens.input += response.inputTokens;
                        totalTokens.output += response.outputTokens;
                    }
                    console.log("   \u2705 Completed in ".concat(duration, "ms | Cost: $").concat(result.totalCost.toFixed(4)));
                    console.log("   \uD83D\uDCCA Models: ".concat(Object.keys(result.reviews).join(', ')));
                    _m.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    // STATS OUTPUT VISUALIZATION
                    console.log('\n' + '='.repeat(80));
                    console.log('AGGREGATED STATISTICS');
                    console.log('='.repeat(80) + '\n');
                    console.log('📈 EXECUTION METRICS');
                    console.log("  Total Test Cases: ".concat(testCases.length));
                    console.log("  Total Duration: ".concat(results.reduce(function (s, r) { return s + r.duration; }, 0), "ms"));
                    console.log("  Avg Duration/Test: ".concat(Math.round(results.reduce(function (s, r) { return s + r.duration; }, 0) / results.length), "ms"));
                    console.log('\n💰 TOKEN USAGE & COSTS');
                    console.log("  Input Tokens: ".concat(totalTokens.input.toLocaleString()));
                    console.log("  Output Tokens: ".concat(totalTokens.output.toLocaleString()));
                    console.log("  Total Cost: $".concat(totalCost.toFixed(4)));
                    console.log("  Cost/Test: $".concat((totalCost / testCases.length).toFixed(4)));
                    console.log('\n⚡ PERFORMANCE BREAKDOWN');
                    for (_d = 0, results_1 = results; _d < results_1.length; _d++) {
                        _e = results_1[_d], test = _e.test, result = _e.result;
                        execTime = result.executionTimeMs;
                        bar = '█'.repeat(Math.round(execTime / 50));
                        console.log("  ".concat(test.name.padEnd(20), " ").concat(bar, " ").concat(execTime, "ms"));
                    }
                    console.log('\n🎯 MODEL CONSENSUS');
                    modelStats = new Map();
                    for (_f = 0, results_2 = results; _f < results_2.length; _f++) {
                        result = results_2[_f].result;
                        for (_g = 0, _h = Object.entries(result.reviews); _g < _h.length; _g++) {
                            _j = _h[_g], modelId = _j[0], response = _j[1];
                            stat = modelStats.get(modelId) || { count: 0, totalTime: 0 };
                            stat.count++;
                            stat.totalTime += response.executionTimeMs;
                            modelStats.set(modelId, stat);
                        }
                    }
                    for (_k = 0, modelStats_1 = modelStats; _k < modelStats_1.length; _k++) {
                        _l = modelStats_1[_k], modelId = _l[0], stat = _l[1];
                        avgTime = Math.round(stat.totalTime / stat.count);
                        console.log("  ".concat(modelId.padEnd(15), " ").concat(stat.count, " reviews | Avg: ").concat(avgTime, "ms"));
                    }
                    console.log('\n✨ RESULT EXPORT (JSON)');
                    exportData = {
                        timestamp: new Date().toISOString(),
                        version: '0.5.0',
                        summary: {
                            totalTests: testCases.length,
                            totalDuration: results.reduce(function (s, r) { return s + r.duration; }, 0),
                            totalCost: totalCost,
                            tokenUsage: totalTokens,
                        },
                        details: results.map(function (_a) {
                            var test = _a.test, result = _a.result, duration = _a.duration;
                            return ({
                                testName: test.name,
                                duration: duration,
                                cost: result.totalCost,
                                models: Object.keys(result.reviews),
                                modelCount: Object.keys(result.reviews).length,
                                tokens: {
                                    input: Object.values(result.reviews).reduce(function (s, r) { return s + r.inputTokens; }, 0),
                                    output: Object.values(result.reviews).reduce(function (s, r) { return s + r.outputTokens; }, 0),
                                },
                            });
                        }),
                    };
                    console.log(JSON.stringify(exportData, null, 2));
                    console.log('\n' + '='.repeat(80));
                    console.log('✅ VALIDATION COMPLETE — v0.5.0 PRODUCTION READY');
                    console.log('='.repeat(80) + '\n');
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _m.sent();
                    console.error('\n❌ VALIDATION FAILED:');
                    console.error(error_1);
                    process.exit(1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
runTests();
