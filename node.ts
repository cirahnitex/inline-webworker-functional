import callsite from "callsite";
import Path from "path";
import {fork, ChildProcess} from "child_process";

if(typeof window !== 'undefined') {
    console.error("inline-webworker-functional: you are requiring the nodejs version but browser environment is detected");
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
    id: number // the ID of the message to respond
    value: any
} | {
    action: "respond",
    id: number // the ID of the message to respond
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

const activeStatefulWorkers = new WeakMap<PromisifyAllInObj<FuncBaseDict>, ChildProcess>();

function makeStatefulWorkerFromSrc(factorySrc: string, captures?:Record<string, any>):Promise<PromisifyAllInObj<FuncBaseDict>> {
    const stack = callsite();
    const cwd = Path.dirname(stack[1].getFileName());
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

        const worker = fork(Path.join(__dirname, "eval.worker"));
        worker.send({cwd, src});
        let nextId = 0;

        if(captures != null) {
            for (const name of Object.keys(captures)) {
                const value = captures[name];
                if (typeof value === 'function') {
                    worker.send({
                        action: "capture-function",
                        name,
                    })
                } else {
                    worker.send({
                        action: "capture-value",
                        name,
                        value
                    })
                }
            }

            worker.on("message", (message:ToHostMessage) => {
                if(message.action === "invoke-function") {
                    if(!captures.hasOwnProperty(message.name)) return;
                    const ret = captures[message.name].apply(null, message.args);
                    if(ret != null) console.warn(`Web worker can only capture functions that return void. Value returned by function ${message.name} is discarded.`);
                }
            });
        }

        worker.send({action:"invoke-factory"});

        function handleListFunctions(message:ToHostMessage) {
            if(message.action !== 'list-functions') return;
            const ret:any = {};
            for(const name of message.names) {
                ret[name] = (...args:any[])=>new Promise((resolve, reject)=>{
                    const id = nextId++;
                    function handleMessage(message:any) {
                        if(message.action !== "respond") return;
                        if(message.id !== id) return;
                        worker.removeListener("message", handleMessage);
                        if(message.error) {
                            reject(new Error(message.error));
                            return;
                        }
                        resolve(message.value);
                    }

                    worker.addListener("message", handleMessage);

                    worker.send({action: "invoke", id, name, args});
                })
            }
            worker.removeListener("message", handleListFunctions);
            activeStatefulWorkers.set(ret, worker);
            resolve(ret);
        }
        worker.addListener("message", handleListFunctions);
    });
}

export function makeStatefulWorker<FuncDict extends FuncBaseDict>(factory:()=>FuncDict, captures?:Record<string, CapturableFunction>):Promise< PromisifyAllInObj<FuncDict>>;
export function makeStatefulWorker(factory:()=>void, captures?:Record<string, CapturableFunction>):Promise<{}>;
export function makeStatefulWorker(factory:()=>any, captures?:Record<string, any>):Promise<any> {
    return makeStatefulWorkerFromSrc(factory.toString(), captures);
}

export function terminateStatefulWorker(worker:PromisifyAllInObj<FuncBaseDict>) {
    const nativeWorker = activeStatefulWorkers.get(worker);
    if(nativeWorker != null) nativeWorker.kill();
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
