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
import { createProvider } from './providers.js';
var ReviewExecutor = /** @class */ (function () {
    function ReviewExecutor(config, tracker) {
        this.providers = new Map();
        this.config = config;
        this.tracker = tracker;
        this.initializeProviders();
    }
    ReviewExecutor.prototype.initializeProviders = function () {
        for (var _i = 0, _a = this.config.reviewers; _i < _a.length; _i++) {
            var reviewer = _a[_i];
            var envKey = "".concat(reviewer.provider.toUpperCase(), "_API_KEY");
            var apiKey = process.env[envKey];
            if (!apiKey) {
                throw new Error("Missing API key for ".concat(reviewer.id, ": ").concat(envKey));
            }
            var provider = createProvider(reviewer, apiKey);
            this.providers.set(reviewer.id, provider);
        }
    };
    ReviewExecutor.prototype.execute = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, responses, promises, strategy, totalInputTokens, totalOutputTokens, totalCost, _i, responses_1, _a, id, response, modelCost, executionTimeMs;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        responses = new Map();
                        promises = Array.from(this.providers.entries()).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var response, error_1;
                            var id = _b[0], provider = _b[1];
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, provider.sendRequest(request.content, '')];
                                    case 1:
                                        response = _c.sent();
                                        responses.set(id, response);
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_1 = _c.sent();
                                        responses.set(id, {
                                            modelId: id,
                                            content: '',
                                            inputTokens: 0,
                                            outputTokens: 0,
                                            finishReason: 'error',
                                            error: String(error_1),
                                            executionTimeMs: Date.now() - startTime,
                                        });
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        strategy = request.strategy || this.config.execution.strategy;
                        if (!(strategy === 'wait_all')) return [3 /*break*/, 2];
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 2:
                        if (!(strategy === 'fastest_2')) return [3 /*break*/, 4];
                        return [4 /*yield*/, Promise.race(promises)];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        totalInputTokens = 0;
                        totalOutputTokens = 0;
                        totalCost = 0;
                        for (_i = 0, responses_1 = responses; _i < responses_1.length; _i++) {
                            _a = responses_1[_i], id = _a[0], response = _a[1];
                            totalInputTokens += response.inputTokens;
                            totalOutputTokens += response.outputTokens;
                            modelCost = this.config.costs.models[response.modelId];
                            if (modelCost) {
                                totalCost += (response.inputTokens / 1000000) * modelCost.input_per_1m;
                                totalCost += (response.outputTokens / 1000000) * modelCost.output_per_1m;
                            }
                        }
                        executionTimeMs = Date.now() - startTime;
                        // Log review
                        this.tracker.logReview({
                            timestamp: new Date().toISOString(),
                            content_hash: request.contentHash || '',
                            execution_strategy: strategy,
                            total_cost_usd: totalCost,
                            models: Array.from(responses.keys()),
                        });
                        return [2 /*return*/, {
                                reviews: Object.fromEntries(responses),
                                consensus: {
                                    agreements: [],
                                    disagreements: {},
                                },
                                executionTimeMs: executionTimeMs,
                                totalCost: totalCost,
                            }];
                }
            });
        });
    };
    return ReviewExecutor;
}());
export { ReviewExecutor };
