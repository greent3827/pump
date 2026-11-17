import fs from 'node:fs';import {build} from 'esbuild';
fs.mkdirSync('dist',{recursive:true});const assets=Object.fromEntries(['index.html','style.css','app.js','billing.js','auth-ui.js','privacy.html','learn.html','learn.css','advertising.js','ads.txt','robots.txt'].map(f=>['/'+f,fs.readFileSync('web/'+f,'utf8')]));
fs.writeFileSync('worker/assets.generated.mjs','export const assets='+JSON.stringify(assets)+';');
await build({entryPoints:['worker/index.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/worker.mjs',minify:true,conditions:['workerd','browser'],external:['node:*']});console.log('Built customer Cloudflare Worker');
