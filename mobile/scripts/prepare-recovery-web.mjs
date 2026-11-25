/** Android QA rebuild: wraps original, byte-preserved prepare-web.mjs. */
import './prepare-web.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const dist=path.join(root,'mobile','dist');
await fs.copyFile(path.join(root,'commercial','client','verified-account.mjs'),path.join(dist,'mobile-commercial-verified-client.mjs'));
await fs.copyFile(path.join(root,'mobile','commercial-account-bootstrap.mjs'),path.join(dist,'mobile-commercial-account-bootstrap.mjs'));
const indexPath=path.join(dist,'index.html');const html=await fs.readFile(indexPath,'utf8');
const snippet='  <script type="module" src="mobile-commercial-account-bootstrap.mjs"></script>\n';
if(html.includes(snippet))throw Error('Duplicate commercial QA bootstrap');
if(!html.includes('</body>'))throw Error('Missing bundle closing tag');
await fs.writeFile(indexPath,html.replace('</body>',snippet+'</body>'));
const publicRoot=path.join(root,'android','app','src','main','assets','public');
// This is a new recovery source tree, never a user data directory or historical backup.
await fs.mkdir(publicRoot,{recursive:true});
await fs.cp(dist,publicRoot,{recursive:true,force:true});
console.log('Prepared standalone recovery QA Android WebView assets (commercial disabled until configured).');
