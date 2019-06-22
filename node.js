"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const callsite_1 = __importDefault(require("callsite"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
if (typeof window !== 'undefined') {
    console.error("inline-webworker-functional: you are requiring the nodejs version but browser environment is detected");
}
const activeStatefulWorkers = new WeakMap();
function makeStatefulWorkerFromSrc(factorySrc, captures) {
    const stack = callsite_1.default();
    const cwd = path_1.default.dirname(stack[1].getFileName());
    return new Promise((resolve, reject) => {
        const src = `
var _main = (${factorySrc});
var _funcs = undefined;
process.on('message', async function(message){
    if(message.action === "invoke") {
        try {
            process.send({action:"respond", id: message.id, value: (await _funcs[message.name].apply(null, message.args))});
        }
        catch(err) {
            process.send({action:"respond", id: message.id, error: err.message});
        }
    }
    else if(message.action === "capture-value") {
        global[message.name] = message.value;
    }
    else if(message.action === "capture-function") {
        global[message.name] = (...args)=>{
            process.send({action: "invoke-function", name: message.name, args})
        }
    }
    else if(message.action === "invoke-factory") {
        _funcs = _main();
        if(_funcs == null) _funcs = {};
        process.send({action: "list-functions", names: Object.keys(_funcs)})
    }
    else { console.error('unknown message action', message.action) }
});`;
        const worker = child_process_1.fork(path_1.default.join(__dirname, "eval.worker"));
        worker.send({ cwd, src });
        let nextId = 0;
        if (captures != null) {
            for (const name of Object.keys(captures)) {
                const value = captures[name];
                if (typeof value === 'function') {
                    worker.send({
                        action: "capture-function",
                        name,
                    });
                }
                else {
                    worker.send({
                        action: "capture-value",
                        name,
                        value
                    });
                }
            }
            worker.on("message", (message) => {
                if (message.action === "invoke-function") {
                    if (!captures.hasOwnProperty(message.name))
                        return;
                    const ret = captures[message.name].apply(null, message.args);
                    if (ret != null)
                        console.warn(`Web worker can only capture functions that return void. Value returned by function ${message.name} is discarded.`);
                }
            });
        }
        worker.send({ action: "invoke-factory" });
        function handleListFunctions(message) {
            if (message.action !== 'list-functions')
                return;
            const ret = {};
            for (const name of message.names) {
                ret[name] = (...args) => new Promise((resolve, reject) => {
                    const id = nextId++;
                    function handleMessage(message) {
                        if (message.action !== "respond")
                            return;
                        if (message.id !== id)
                            return;
                        worker.removeListener("message", handleMessage);
                        if (message.error) {
                            reject(new Error(message.error));
                            return;
                        }
                        resolve(message.value);
                    }
                    worker.addListener("message", handleMessage);
                    worker.send({ action: "invoke", id, name, args });
                });
            }
            worker.removeListener("message", handleListFunctions);
            activeStatefulWorkers.set(ret, worker);
            resolve(ret);
        }
        worker.addListener("message", handleListFunctions);
    });
}
function makeStatefulWorker(factory, captures) {
    return makeStatefulWorkerFromSrc(factory.toString(), captures);
}
exports.makeStatefulWorker = makeStatefulWorker;
function terminateStatefulWorker(worker) {
    const nativeWorker = activeStatefulWorkers.get(worker);
    if (nativeWorker != null)
        nativeWorker.kill();
}
exports.terminateStatefulWorker = terminateStatefulWorker;
function makeSimpleWorker(fn) {
    return async function (...args) {
        const worker = await makeStatefulWorkerFromSrc(`()=>({
            fn: (${fn.toString()})
        })`);
        const ret = await worker.fn(...args);
        terminateStatefulWorker(worker);
        return ret;
    };
}
exports.makeSimpleWorker = makeSimpleWorker;
//# sourceMappingURL=node.js.map