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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var OpenAICompatibleProvider = /** @class */ (function () {
    function OpenAICompatibleProvider(config, apiKey) {
        this.id = config.id;
        this.name = config.name || config.id;
        this.model = config.model;
        this.apiKey = apiKey;
        this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    }
    OpenAICompatibleProvider.prototype.sendRequest = function (content, system) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, response, data, executionTimeMs, choice, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch("".concat(this.baseUrl, "/chat/completions"), {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': "Bearer ".concat(this.apiKey),
                                },
                                body: JSON.stringify({
                                    model: this.model,
                                    messages: __spreadArray(__spreadArray([], (system ? [{ role: 'system', content: system }] : []), true), [
                                        { role: 'user', content: content },
                                    ], false),
                                    temperature: 0.7,
                                    max_tokens: 2000,
                                }),
                            })];
                    case 2:
                        response = _b.sent();
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _b.sent();
                        executionTimeMs = Date.now() - startTime;
                        if (!response.ok) {
                            return [2 /*return*/, {
                                    modelId: this.id,
                                    content: '',
                                    inputTokens: 0,
                                    outputTokens: 0,
                                    finishReason: 'error',
                                    error: ((_a = data.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown API error',
                                    executionTimeMs: executionTimeMs,
                                }];
                        }
                        choice = data.choices[0];
                        return [2 /*return*/, {
                                modelId: this.id,
                                content: choice.message.content,
                                inputTokens: data.usage.prompt_tokens,
                                outputTokens: data.usage.completion_tokens,
                                finishReason: 'stop',
                                executionTimeMs: executionTimeMs,
                            }];
                    case 4:
                        error_1 = _b.sent();
                        return [2 /*return*/, {
                                modelId: this.id,
                                content: '',
                                inputTokens: 0,
                                outputTokens: 0,
                                finishReason: 'error',
                                error: String(error_1),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return OpenAICompatibleProvider;
}());
export { OpenAICompatibleProvider };
var GeminiProvider = /** @class */ (function () {
    function GeminiProvider(config, apiKey) {
        this.id = config.id;
        this.name = config.name || config.id;
        this.model = config.model;
        this.apiKey = apiKey;
    }
    GeminiProvider.prototype.sendRequest = function (content, system) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, response, data, executionTimeMs, part, usage, error_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch("https://generativelanguage.googleapis.com/v1beta/models/".concat(this.model, ":generateContent?key=").concat(this.apiKey), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    system_instruction: system,
                                    contents: [{ parts: [{ text: content }] }],
                                    generationConfig: {
                                        temperature: 0.7,
                                        maxOutputTokens: 2000,
                                    },
                                }),
                            })];
                    case 2:
                        response = _b.sent();
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _b.sent();
                        executionTimeMs = Date.now() - startTime;
                        if (!response.ok) {
                            return [2 /*return*/, {
                                    modelId: this.id,
                                    content: '',
                                    inputTokens: 0,
                                    outputTokens: 0,
                                    finishReason: 'error',
                                    error: ((_a = data.error) === null || _a === void 0 ? void 0 : _a.message) || 'Gemini API error',
                                    executionTimeMs: executionTimeMs,
                                }];
                        }
                        part = data.candidates[0].content.parts[0];
                        usage = data.usageMetadata;
                        return [2 /*return*/, {
                                modelId: this.id,
                                content: part.text,
                                inputTokens: usage.promptTokenCount,
                                outputTokens: usage.candidatesTokenCount,
                                finishReason: 'stop',
                                executionTimeMs: executionTimeMs,
                            }];
                    case 4:
                        error_2 = _b.sent();
                        return [2 /*return*/, {
                                modelId: this.id,
                                content: '',
                                inputTokens: 0,
                                outputTokens: 0,
                                finishReason: 'error',
                                error: String(error_2),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return GeminiProvider;
}());
export { GeminiProvider };
export function createProvider(config, apiKey) {
    switch (config.provider) {
        case 'openai':
        case 'openai-compatible':
            return new OpenAICompatibleProvider(config, apiKey);
        case 'gemini':
            return new GeminiProvider(config, apiKey);
        default:
            throw new Error("Unknown provider: ".concat(config.provider));
    }
}
