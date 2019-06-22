"use strict";

if (typeof window === 'undefined') {
    console.error("inline-webworker-functional: you are requiring the browser version but nodejs environment is detected");
}
const activeStatefulWorkers = new WeakMap();
function makeStatefulWorkerFromSrc(factorySrc, captures) {
    return new Promise((resolve, reject) => {
        const blob = new Blob([
            `
var _main = (${factorySrc});
var _funcs = undefined;
onmessage = async function(e){
    var message = e.data;
    if(message.action === "invoke") {
        try {
            postMessage({action:"respond", id: message.id, value: (await _funcs[message.name].apply(null, message.args))});
        }
        catch(err) {
            postMessage({action:"respond", id: message.id, error: err.message});
        }
    }
    else if(message.action === "capture-value") {
        self[message.name] = message.value;
    }
    else if(message.action === "capture-function") {
        self[message.name] = (...args)=>{
            postMessage({action: "invoke-function", name: message.name, args})
        }
    }
    else if(message.action === "invoke-factory") {
        _funcs = _main();
        if(_funcs == null) _funcs = {};
        postMessage({action: "list-functions", names: Object.keys(self._funcs)})
    }
    else { console.error('unknown message action', message.action) }
};`
        ]);
        const blobURL = window.URL.createObjectURL(blob);
        const worker = new Worker(blobURL);
        let nextId = 0;
        if (captures != null) {
            for (const name of Object.keys(captures)) {
                const value = captures[name];
                if (typeof value === 'function') {
                    worker.postMessage({
                        action: "capture-function",
                        name,
                    });
                }
                else {
                    worker.postMessage({
                        action: "capture-value",
                        name,
                        value
                    });
                }
            }
            worker.addEventListener("message", (e) => {
                const message = e.data;
                if (message.action === "invoke-function") {
                    if (!captures.hasOwnProperty(message.name))
                        return;
                    const ret = captures[message.name].apply(null, message.args);
                    if (ret != null)
                        console.warn(`Web worker can only capture functions that return void. Value returned by function ${message.name} is discarded.`);
                }
            });
        }
        worker.postMessage({ action: "invoke-factory" });
        function handleListFunctions(e) {
            const message = e.data;
            if (message.action !== 'list-functions')
                return;
            const ret = {};
            for (const name of message.names) {
                ret[name] = (...args) => new Promise((resolve, reject) => {
                    const id = nextId++;
                    function handleMessage(e) {
                        const message = e.data;
                        if (message.id !== id)
                            return;
                        worker.removeEventListener("message", handleMessage);
                        if (message.error) {
                            reject(new Error(message.error));
                            return;
                        }
                        resolve(message.value);
                    }
                    worker.addEventListener("message", handleMessage);
                    worker.postMessage({ action: "invoke", id, name, args });
                });
            }
            worker.removeEventListener("message", handleListFunctions);
            activeStatefulWorkers.set(ret, worker);
            resolve(ret);
        }
        worker.addEventListener("message", handleListFunctions);
    });
}
function makeStatefulWorker(factory, captures) {
    return makeStatefulWorkerFromSrc(factory.toString(), captures);
}

function terminateStatefulWorker(worker) {
    const nativeWorker = activeStatefulWorkers.get(worker);
    if (nativeWorker != null)
        nativeWorker.terminate();
}

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
