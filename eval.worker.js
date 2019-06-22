"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const _original_require = require;
process.once("message", (message) => {
    function require(path) {
        if (path.startsWith(".")) {
            return _original_require(path_1.default.join(message.cwd, path));
        }
        else {
            return _original_require(path);
        }
    }
    __dirname = message.cwd;
    eval(message.src);
});
//# sourceMappingURL=eval.worker.js.map