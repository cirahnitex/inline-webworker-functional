"use strict";

function makeSimpleWebWorker(fn) {
    var blob = new Blob([
        "\nvar _main = (" + fn.toString() + ");\nonmessage = function(e){\n    try {\n        postMessage({id: e.data.id, value:_main.apply(null, e.data.args)});\n    }\n    catch(e) {\n        postMessage({id: e.data.id, error: err.message});\n    }\n};"
    ]);
    var blobURL = window.URL.createObjectURL(blob);
    var worker = new Worker(blobURL);
    var nextId = 0;
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return new Promise(function (resolve, reject) {
            var id = nextId++;
            function handleMessage(e) {
                if (e.data.id !== id)
                    return;
                worker.removeEventListener("message", handleMessage);
                if (e.data.error) {
                    reject(new Error(e.data.error));
                    return;
                }
                resolve(e.data.value);
            }
            worker.addEventListener("message", handleMessage);
            worker.postMessage(id, args);
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
    return Array.from(Array(16).keys()).map(function (index) { return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return new Promise(function (resolve, reject) {
            var id = nextId++;
            function handleMessage(e) {
                if (e.data.id !== id)
                    return;
                worker.removeEventListener("message", handleMessage);
                if (e.data.error) {
                    reject(new Error(e.data.error));
                    return;
                }
                resolve(e.data.value);
            }
            worker.addEventListener("message", handleMessage);
            worker.postMessage({ id: id, index: index, args: args });
        });
    }; });
}
