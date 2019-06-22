import {makeSimpleWorker} from "./node";

function complexWork(x:number) {
    class Circle {
        r:number
        constructor(r:number) {
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