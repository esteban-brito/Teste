const http=require("http");
const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const port=Number(process.env.PORT||5173);
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".webp":"image/webp",".avif":"image/avif",".jpg":"image/jpeg",".jpeg":"image/jpeg",".txt":"text/plain; charset=utf-8",".md":"text/markdown; charset=utf-8",".woff2":"font/woff2"};

http.createServer((req,res)=>{
  let urlPath;
  try{
    urlPath=decodeURIComponent((req.url||"/").split("?")[0]);
  }catch{
    res.writeHead(400);res.end("bad request");return;
  }
  const rel=urlPath==="/"?"/index.html":urlPath;
  const file=path.resolve(root,"."+rel);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end("forbidden");return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);res.end("not found");return;}
    res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream"});
    res.end(data);
  });
}).listen(port,"127.0.0.1",()=>console.log(`http://127.0.0.1:${port}/sandbox.html`));
