const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const dist = path.join(root,'dist');
fs.mkdirSync(dist,{recursive:true});
for (const entry of ['index.html','styles','js','content','assets']) {
  fs.cpSync(path.join(root,entry),path.join(dist,entry),{recursive:true,filter:source=>! /\.blend\d?$|\.stats\.json$/.test(source)});
}
console.log('Version statique prête dans dist/');
