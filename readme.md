# inline-webworker-functional
Execute your function asynchronously in a separate thread by creating inline web workers under the hood.

## Motivation
Call your functions asynchronously, without worrying anything about the underlying web worker API at all, like creating separate JS file, postmessage, onmessage etc.

## Installation
### webpack
install from NPM
```
npm install inline-webworker-functional
```
import to your JS file
```javascript
const {makeSimpleWebWorker, makeBatchedWebWorkers} = require("inline-webworker-functional")
```
### browser
to be released

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

const lotsOfWorkAsync = makeSimpleWebWorker(lotsOfWork);

lotsOfWorkAsync(1e4, 1e4).then(result => console.log(result)); // prints 489326364.2720191
```

Due the to the limitation of web worker, the function to convert must be completely self-contained, without any reference to external variables/functions/classes. If your function to convert requires other helper functions/classes as subroutine, please inline those dependencies into your function, like this:
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

const complexWorkAsync = makeSimpleWebWorker(complexWork);

complexWorkAsync(2).then(result => console.log(result)); // prints 12.566370614359172
```

### Advanced usage
If you want to make multiple related functions asynchronous together, the batched API can be used. This is extremely useful when those functions have some shared variables.
```javascript
function batchedWorkerJobs() {

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

    return [save, withdraw];
}

const [saveAsync, withdrawAsync] = makeBatchedWebWorkers(batchedWorkerJobs);
(async()=>{
    console.log(await saveAsync(200)); // prints 200
    console.log(await withdrawAsync(300)); // throws an error with message "insufficient balance"
})();
```

#### Note for Typescript users
Due to the type widening feature for function return types, the return type of the job function need to be explicitly specified as tuple when using Batched API.
```typescript
function batchedWorkerJobs() {

    let balance = 0;

    function save(x: number) {
        balance += x;
        return balance;
    }

    function withdraw(x: number) {
        if(balance < x) throw new Error("insufficient balance");
        balance -= x;
        return balance;
    }

    // explicitly specify return type as tuple
    return [save, withdraw] as [typeof save, typeof withdraw];
}

const [saveAsync, withdrawAsync] = makeBatchedWebWorkers(batchedWorkerJobs);
(async()=>{
    console.log(await saveAsync(200)); // prints 200
    console.log(await withdrawAsync(300)); // throws an error with message "insufficient balance"
})();
```