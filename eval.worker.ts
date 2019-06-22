import Path from "path"

interface ToWorkerMessage {
    cwd: string,
    src: string
}

const _original_require = require;

process.once("message", (message:ToWorkerMessage)=>{
    function require(path:string) {
        if(path.startsWith(".")) {
            return _original_require(Path.join(message.cwd, path));
        }
        else {
            return _original_require(path);
        }
    }
    __dirname = message.cwd;
    eval(message.src);
});
