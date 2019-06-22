if(typeof window === 'undefined') {
    console.error("inline-webworker-functional: you are requiring the browser version but nodejs environment is detected");
}

type FuncBase = (...args:any)=>any;
type Promisified<Func extends FuncBase> = (...args:Parameters<Func>)=>Promise<ReturnType<Func>>;
type CapturableFunction = (...args:any)=>void;

type ToWorkerMessage =  {
    action: "invoke"
    id: number, // a ID of this message, use this to establish a two-way communication
    name: string,
    args: any,
} | {
    action: "capture-value",
    name: number,
    value: any
} | {
    action: "capture-function",
    name: string
} | {
    action: "invoke-factory"
}

type ToHostMessage = {
    action: "respond",
    id: string // the ID of the message to respond
    value: any
} | {
    action: "respond",
    id: string // the ID of the message to respond
    error: string
} | {
    action: "invoke-function",
    name: string,
    args: any
} | {
    action: "list-functions",
    names: []
}

type FuncBaseDict = Record<string, FuncBase>;

type PromisifyAllInObj<T extends FuncBaseDict> = {
    [K in keyof T]: Promisified<T[K]>
}

const activeStatefulWorkers = new WeakMap<PromisifyAllInObj<FuncBaseDict>, Worker>();

function makeStatefulWorkerFromSrc(factorySrc: string, captures?:Record<string, any>):Promise<PromisifyAllInObj<FuncBaseDict>> {
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

        if(captures != null) {
            for (const name of Object.keys(captures)) {
                const value = captures[name];
                if (typeof value === 'function') {
                    worker.postMessage({
                        action: "capture-function",
                        name,
                    })
                } else {
                    worker.postMessage({
                        action: "capture-value",
                        name,
                        value
                    })
                }
            }

            worker.addEventListener("message", (e:MessageEvent) => {
                const message : ToHostMessage = e.data;
                if(message.action === "invoke-function") {
                    if(!captures.hasOwnProperty(message.name)) return;
                    const ret = captures[message.name].apply(null, message.args);
                    if(ret != null) console.warn(`Web worker can only capture functions that return void. Value returned by function ${message.name} is discarded.`);
                }
            });
        }

        worker.postMessage({action:"invoke-factory"});

        function handleListFunctions(e:any) {
            const message = e.data;
            if(message.action !== 'list-functions') return;
            const ret:any = {};
            for(const name of message.names) {
                ret[name] = (...args:any[])=>new Promise((resolve, reject)=>{
                    const id = nextId++;
                    function handleMessage(e:MessageEvent) {
                        const message = e.data;
                        if(message.id !== id) return;
                        worker.removeEventListener("message", handleMessage);
                        if(message.error) {
                            reject(new Error(message.error));
                            return;
                        }
                        resolve(message.value);
                    }

                    worker.addEventListener("message", handleMessage);

                    worker.postMessage({action: "invoke", id, name, args});
                })
            }
            worker.removeEventListener("message", handleListFunctions);
            activeStatefulWorkers.set(ret, worker);
            resolve(ret);
        }
        worker.addEventListener("message", handleListFunctions);
    });
}

export function makeStatefulWorker<FuncDict extends FuncBaseDict>(factory:()=>FuncDict, captures?:Record<string, CapturableFunction>):Promise< PromisifyAllInObj<FuncDict>>;
export function makeStatefulWorker(factory:()=>void, captures?:Record<string, CapturableFunction>):Promise<{}>;
export function makeStatefulWorker(factory:()=>any, captures?:Record<string, any>):Promise<any> {
    return makeStatefulWorkerFromSrc(factory.toString(), captures);
}

export function terminateStatefulWorker(worker:PromisifyAllInObj<FuncBaseDict>) {
    const nativeWorker = activeStatefulWorkers.get(worker);
    if(nativeWorker != null) nativeWorker.terminate();
}

export function makeSimpleWorker<Func extends FuncBase>(fn:Func):Promisified<Func> {
    return async function(...args:any):Promise<any> {
        const worker = await makeStatefulWorkerFromSrc(`()=>({
            fn: (${fn.toString()})
        })`);
        const ret = await worker.fn(...args);
        terminateStatefulWorker(worker);
        return ret;
    }
}

