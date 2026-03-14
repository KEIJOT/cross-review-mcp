// src/tracking.ts - Token and cost tracking
import * as fs from 'fs';
var TokenTracker = /** @class */ (function () {
    function TokenTracker(logFile) {
        if (logFile === void 0) { logFile = '.llmapi_usage.json'; }
        this.logFile = '.llmapi_usage.json';
        this.logFile = logFile;
        if (!fs.existsSync(logFile)) {
            fs.writeFileSync(logFile, '', 'utf-8');
        }
    }
    TokenTracker.prototype.logReview = function (review) {
        fs.appendFileSync(this.logFile, JSON.stringify(review) + '\n', 'utf-8');
    };
    return TokenTracker;
}());
export { TokenTracker };
