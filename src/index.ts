type FuncBase = (...args:any)=>any;
type Promisified<Func extends FuncBase> = (...args:Parameters<Func>)=>Promise<ReturnType<Func>>;
export function makeSimpleWebWorker<Func extends FuncBase>(fn:Func):Promisified<Func> {
    const blob = new Blob([
        `
var _main = (${fn.toString()});
onmessage = function(e){
    try {
        postMessage({id: e.data.id, value:_main.apply(null, e.data.args)});
    }
    catch(e) {
        postMessage({id: e.data.id, error: err.message});
    }
};`
    ]);

    const blobURL = window.URL.createObjectURL(blob);

    const worker = new Worker(blobURL);
    let nextId = 0;

    return (...args:any[])=>new Promise((resolve, reject)=>{
        const id = nextId++;
        function handleMessage(e:MessageEvent) {
            if(e.data.id !== id) return;
            worker.removeEventListener("message", handleMessage);
            if(e.data.error) {
                reject(new Error(e.data.error));
                return;
            }
            resolve(e.data.value);
        }
        worker.addEventListener("message", handleMessage);
        worker.postMessage(id, args);
    })

}
export function makeBatchedWebWorkers<F0 extends FuncBase>(factory:()=>[F0])
    :[Promisified<F0>];
export function makeBatchedWebWorkers<F0 extends FuncBase, F1 extends FuncBase>(factory:()=>[F0, F1])
    :[Promisified<F0>, Promisified<F1>];
export function makeBatchedWebWorkers<F0 extends FuncBase, F1 extends FuncBase, F2 extends FuncBase>(factory:()=>[F0, F1, F2])
    :[Promisified<F0>, Promisified<F1>, Promisified<F2>];
export function makeBatchedWebWorkers
<F0 extends FuncBase, F1 extends FuncBase, F2 extends FuncBase, F3 extends FuncBase>
(factory:()=>[F0, F1, F2, F3])
    :[Promisified<F0>, Promisified<F1>, Promisified<F2>, Promisified<F3>];
export function makeBatchedWebWorkers
<F0 extends FuncBase, F1 extends FuncBase, F2 extends FuncBase, F3 extends FuncBase, F4 extends FuncBase>
(factory:()=>[F0, F1, F2, F3, F4])
    :[Promisified<F0>, Promisified<F1>, Promisified<F2>, Promisified<F3>, Promisified<F4>];
export function makeBatchedWebWorkers
<F0 extends FuncBase, F1 extends FuncBase, F2 extends FuncBase, F3 extends FuncBase, F4 extends FuncBase, F5 extends FuncBase>
(factory:()=>[F0, F1, F2, F3, F4, F5])
    :[Promisified<F0>, Promisified<F1>, Promisified<F2>, Promisified<F3>, Promisified<F4>, Promisified<F5>];
export function makeBatchedWebWorkers
<F0 extends FuncBase, F1 extends FuncBase, F2 extends FuncBase, F3 extends FuncBase,
    F4 extends FuncBase, F5 extends FuncBase, F6 extends FuncBase>
(factory:()=>[F0, F1, F2, F3, F4, F5, F6])
    :[Promisified<F0>, Promisified<F1>, Promisified<F2>, Promisified<F3>, Promisified<F4>,
    Promisified<F5>, Promisified<F6>];
export function makeBatchedWebWorkers
<F0 extends FuncBase, F1 extends FuncBase, F2 extends FuncBase, F3 extends FuncBase,
    F4 extends FuncBase, F5 extends FuncBase, F6 extends FuncBase, F7 extends FuncBase>
(factory:()=>[F0, F1, F2, F3, F4, F5, F6, F7])
    :[Promisified<F0>, Promisified<F1>, Promisified<F2>, Promisified<F3>, Promisified<F4>,
    Promisified<F5>, Promisified<F6>, Promisified<F7>];

export function makeBatchedWebWorkers(factory:()=>FuncBase[]):Promisified<FuncBase>[] {
    const blob = new Blob([
        `
var _funcs = (${factory.toString()})();
onmessage = function(e) {
    try {
        postMessage({id: e.data.id, value:_funcs[e.data.index].apply(null, e.data.args)});
    }
    catch(err) {
        postMessage({id: e.data.id, error: err.message});
    }
};`
    ]);

    const blobURL = window.URL.createObjectURL(blob);

    const worker = new Worker(blobURL);
    let nextId = 0;

    return Array.from(Array(16).keys()).map(index=>(...args:any[])=>new Promise((resolve, reject)=>{
        const id = nextId++;
        function handleMessage(e:MessageEvent) {
            if(e.data.id !== id) return;
            worker.removeEventListener("message", handleMessage);
            if(e.data.error) {
                reject(new Error(e.data.error));
                return;
            }
            resolve(e.data.value);
        }

        worker.addEventListener("message", handleMessage);

        worker.postMessage({id, index, args});
    }));
}
