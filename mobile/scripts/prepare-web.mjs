import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'mobile', 'dist');

const skip = new Set([
  '.git','node_modules','mobile','api','.vercel'
]);
const allowed = new Set([
  '.html','.js','.css','.json','.png','.jpg','.jpeg','.webp','.svg','.ico','.woff','.woff2'
]);

await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });

async function copyTree(srcDir, rel='') {
  for (const entry of await fs.readdir(srcDir, { withFileTypes: true })) {
    if (!rel && skip.has(entry.name)) continue;
    const src = path.join(srcDir, entry.name);
    const nextRel = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      await copyTree(src, nextRel);
      continue;
    }
    if (!allowed.has(path.extname(entry.name).toLowerCase())) continue;
    const dst = path.join(out, nextRel);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
  }
}

await copyTree(root);

await fs.copyFile(path.join(root,'mobile','five-gaps.js'), path.join(out,'mobile-five-gaps.js'));
await fs.copyFile(path.join(root,'mobile','five-gaps.css'), path.join(out,'mobile-five-gaps.css'));
await fs.copyFile(path.join(root,'mobile','native-voice-shim.js'), path.join(out,'mobile-native-voice-shim.js'));

const indexPath = path.join(out,'index.html');
let html = await fs.readFile(indexPath,'utf8');

// Native speech shim must exist before inspection-voice.js evaluates SpeechRecognition.
html = html.replace(
  /<script\s+src=["']inspection-voice\.js([^"']*)["']><\/script>/i,
  '<script src="mobile-native-voice-shim.js"></script>\n  <script src="inspection-voice.js$1"></script>'
);

if (!html.includes('mobile-five-gaps.css')) {
  html = html.replace('</head>', '  <link rel="stylesheet" href="mobile-five-gaps.css">\n</head>');
}
if (!html.includes('mobile-five-gaps.js')) {
  html = html.replace('</body>', '  <script src="mobile-five-gaps.js"></script>\n</body>');
}

// Service workers are unnecessary in a bundled native app and can preserve stale web code.
html = html.replace(
  /navigator\.serviceWorker\.register\(([^)]*)\)/g,
  'Promise.resolve({ scope: "native-bundled" })'
);

await fs.writeFile(indexPath, html, 'utf8');
console.log('Prepared Capacitor bundle at mobile/dist');
