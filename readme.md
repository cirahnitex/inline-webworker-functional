# inline-webworker-functional
Execute your time consuming JS functions asynchronously in the background, works with both NodeJS and browser environment. When in browser, it creates inline web worker under the hood; When in NodeJS, it creates child process under the hood.

## Motivation
Call your functions asynchronously, without worrying anything about the underlying web worker API or child process API at all, like creating separate JS file, message passing etc.

## Installation
### NodeJS Environment
install from NPM
```
npm install inline-webworker-functional
```
import to your JS file
```javascript
const {makeSimpleWorker, makeStatefulWorker, terminateStatefulWorker} = require("inline-webworker-functional/node")
```
### Webpack Environment
install from NPM
```
npm install inline-webworker-functional
```
import to your JS file
```javascript
const {makeSimpleWorker, makeStatefulWorker, terminateStatefulWorker} = require("inline-webworker-functional/browser")
```
### Use Directly in Browser
```html
<script src="https://unpkg.com/inline-webworker-functional/browserlib.js"></script>
```

## Usage

### Basic usage
Make a function asynchronous:
```javascript
function lotsOfWork(x, y) {
    let s = 0;
    for (let i = 0; i < x; ++i) {
        for (let j = 1; j < y; ++j) {
            s += i / j;
        }
    }
    return s;
}

(async()=>{
    // create a asynchronous version of your function
    const lotsOfWorkAsync = makeSimpleWorker(lotsOfWork);
    
    // execute your function in the background
    const result = await lotsOfWorkAsync(1e4, 1e4);
    console.log(result); 
})();
```

Due the to the limitation of web worker, the job function (the function to convert) must be completely self-contained, without any reference to external variables/functions/classes. If your job function requires other helper functions/classes as subroutines, please inline those dependencies into your function, like this:
```javascript
function complexWork(x) {
    class Circle {
        constructor(r) {
            this.r = r;
        }
        getArea() {
            return Math.PI * this.r * this.r;
        }
    }
    return new Circle(x).getArea();
}
(async()=>{
    const complexWorkAsync = makeSimpleWorker(complexWork);
    const result = await complexWorkAsync(2);
	console.log(result); // prints 12.566370614359172
})();
```

And also, the worker task function cannot take parameters of arbitrary type. The parameters must be compatible with the [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).

### Advanced usage: keeping internal state
the async function returned by `makeSimpleWorker` does the following things: When invoked, this async function creates a worker, executes it, and then destroys it. It works well in most cases. But in some scenarios, you may want more fine controls, like:
* you want to keep some internal states in your worker
* you simply don't want your worker to be automatically destroyed

In these cases, you will need to call `makeStatefulWorker` instead.

First, you need to have a worker task factory function that returns a dictionary of worker tasks. 
```javascript
function createStatefulWorkerTasks() {

    let balance = 0;

    function save(x) {
        balance += x;
        return balance;
    }

    function withdraw(x) {
        if(balance < x) throw new Error("insufficient balance");
        balance -= x;
        return balance;
    }

    return {save, withdraw};
}
```

Then, call `makeStatefulWorker` on your factory function. It asynchronously returns a worker object.
```javascript
(async()=>{
    const worker = await makeStatefulWorker(createStatefulWorkerTasks);
})();
```

Now the worker object contains `save` and `withdraw` attribute, those are asynchronous versions of the corresponding worker tasks.
```javascript
(async()=>{
    const worker = await makeStatefulWorker(createStatefulWorkerTasks);
    console.log(await worker.save(200)); // prints 200
    console.log(await worker.withdraw(300)); // throws an error with message "insufficient balance"
})();
```

A stateful worker doesn't automatically destroy itself. You need to manually destroy it by calling `terminateStatefulWorker`
```javascript
terminateStatefulWorker(worker) // where "worker" is the object return by "makeStatefulWorker"
```

### Advanced usage: invoking host functions from worker
So far, the worker is passively communicating with the host. In other words, the host need to first request something to trigger the workers response. But in some scenarios, the worker need to actively communicate with the host, even though the host is not invoking any worker task at all. For example, this is what you want:
```javascript
function foo(msg) {
    console.log('worker says:', msg);
}

function workerTask() {
    setInterval(()=>{
        foo("hello");
    }, 500);
    return {};
}

(async ()=>{
    const worker = await makeStatefulWorker(workerTask);
})();
```

However, when you execute this, you will get an error because `foo` is a function defined only in the host but not in the worker. You need to explicit specify that you want the worker to be able to trigger `foo` function on the host, by passing `foo` to `makeStatefulWorker` in the second parameter. Here is how you can do it:
```javascript
function foo(msg) {
    console.log('worker says:', msg);
}

function workerTask() {
    setInterval(()=>{
        foo("hello");
    }, 500);
    return {};
}

(async ()=>{
    const worker = await makeStatefulWorker(workerTask, {foo});
})();
```

In this way the worker can trigger the `foo` function on the host. However there are certain limitations on the functions to trigger:
* it's parameters must be compatible with structured clone algorithm
* it must not have any return value


### Advanced usage: importing libraries in worker
#### Browser and Webpack environment
In browser or Webpack environment, there is currently not supported. The worker must work entirely on its own, without importing any libraries.

#### NodeJS environment
In NodeJS environment, the worker can import other libraries. But you have to put the import statement within the worker task function. However, the `import` keyword refuses to appear within function body, it must sits at the top of the JS/TS file. But that's fixable, you can use the old `require` semantics instead, like this:
```javascript
function workerTask() {
    const fs = require("fs");
    
    // fs library can be used in worker now
}

makeSimpleWorker(workerTask);
```
