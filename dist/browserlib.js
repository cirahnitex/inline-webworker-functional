"use strict";

function makeSimpleWebWorker(fn) {
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return new Promise(function (resolve, reject) {
            var blob = new Blob([
                "\nvar _main = (" + fn.toString() + ");\nonmessage = function(e){\n    postMessage(_main.apply(null, e.data));\n};"
            ]);
            var blobURL = window.URL.createObjectURL(blob);
            var worker = new Worker(blobURL);
            worker.onmessage = function (e) {
                resolve(e.data);
            };
            worker.onerror = function (e) {
                reject(e);
            };
            worker.postMessage(args); // Start the worker.
        });
    };
}

function makeBatchedWebWorkers(factory) {
    var blob = new Blob([
        "\nvar _funcs = (" + factory.toString() + ")();\nonmessage = function(e) {\n    try {\n        postMessage({id: e.data.id, value:_funcs[e.data.index].apply(null, e.data.args)});\n    }\n    catch(err) {\n        postMessage({id: e.data.id, error: err.message});\n    }\n};"
    ]);
    var blobURL = window.URL.createObjectURL(blob);
    var worker = new Worker(blobURL);
    var nextId = 0;
    return factory().map(function (_, index) { return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return new Promise(function (resolve, reject) {
            var id = nextId++;
            function handleMessage(e) {
                if (e.data.id !== id)
                    return;
                if (e.data.error) {
                    reject(new Error(e.data.error));
                    return;
                }
                resolve(e.data.value);
                worker.removeEventListener("message", handleMessage);
            }
            worker.addEventListener("message", handleMessage);
            worker.postMessage({ id: id, index: index, args: args }); // Start the worker.
        });
    }; });
}
