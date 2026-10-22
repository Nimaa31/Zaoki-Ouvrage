const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
http.createServer((req,res)=>{
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch {res.writeHead(400);return res.end();}
  const file = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
  if (!file.startsWith(root + path.sep)) {res.writeHead(403);return res.end();}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404);return res.end('Introuvable');}
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-cache');
    res.end(data);
  });
}).listen(port,'127.0.0.1',()=>console.log(`L’Ouvrage de Zaoki : http://127.0.0.1:${port}`));
