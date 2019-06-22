declare type FuncBase = (...args: any) => any;
declare type Promisified<Func extends FuncBase> = (...args: Parameters<Func>) => Promise<ReturnType<Func>>;
declare type CapturableFunction = (...args: any) => void;
declare type FuncBaseDict = Record<string, FuncBase>;
declare type PromisifyAllInObj<T extends FuncBaseDict> = {
    [K in keyof T]: Promisified<T[K]>;
};
export declare function makeStatefulWorker<FuncDict extends FuncBaseDict>(factory: () => FuncDict, captures?: Record<string, CapturableFunction>): Promise<PromisifyAllInObj<FuncDict>>;
export declare function makeStatefulWorker(factory: () => void, captures?: Record<string, CapturableFunction>): Promise<{}>;
export declare function terminateStatefulWorker(worker: PromisifyAllInObj<FuncBaseDict>): void;
export declare function makeSimpleWorker<Func extends FuncBase>(fn: Func): Promisified<Func>;
export {};
