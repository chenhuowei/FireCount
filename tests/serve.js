const http=require('http'),fs=require('fs'),path=require('path');
const root=require('path').resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));
  if(fs.statSync(p,{throwIfNoEntry:false})?.isDirectory())p=path.join(p,'index.html');
  fs.readFile(p,(e,d)=>{
    if(e){res.writeHead(404);res.end('404');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});
    res.end(d);
  });
}).listen(8765,()=>console.log('serving D:/workspace/rea/firecount on http://127.0.0.1:8765'));
