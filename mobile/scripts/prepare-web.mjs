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

// Only in the bundled Android copy: V77's superseded inspection-save stub
// collides with the current inspection-save declaration in strict JS parsing.
// Never edit the authoritative source v45.js or either handler's implementation.
const packagedV45 = path.join(out, 'v45.js');
const rawV45 = await fs.readFile(packagedV45, 'utf8');
const oldV77Header = 'function vSaveInspection(id){const s=v45s(),h=hive(s,id);';
const retiredV77Header = 'function v77RetiredSaveInspection(id){const s=v45s(),h=hive(s,id);';
if (rawV45.split(oldV77Header).length !== 2 ||
    !rawV45.includes('function vSaveInspection(id){\n  const s=v45s()')) {
  throw new Error('Native V77 save collision guard failed; investigate upstream v45.js');
}
await fs.writeFile(packagedV45, rawV45.replace(oldV77Header, retiredV77Header), 'utf8');


await fs.copyFile(path.join(root,'mobile','five-gaps.js'), path.join(out,'mobile-five-gaps.js'));
await fs.copyFile(path.join(root,'mobile','five-gaps.css'), path.join(out,'mobile-five-gaps.css'));
await fs.copyFile(path.join(root,'mobile','system-safe-area.css'), path.join(out,'mobile-system-safe-area.css'));
await fs.copyFile(path.join(root,'mobile','native-voice-shim.js'), path.join(out,'mobile-native-voice-shim.js'));
await fs.copyFile(path.join(root,'mobile','android-runtime-fixes.js'), path.join(out,'mobile-android-runtime-fixes.js'));

const indexPath = path.join(out,'index.html');
let html = await fs.readFile(indexPath,'utf8');

// Native builds must not depend on a runtime CDN for Supabase. The pinned UMD
// bundle is downloaded during the cloud build into mobile/dist/vendor/.
html = html.replace(
  /<script\s+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2["']><\/script>\s*<script>[\s\S]*?window\.__HIVEDASH_SUPABASE_CDN_FALLBACK__\s*=\s*true;\s*<\/script>/i,
  '<script src="vendor/supabase.min.js"></script>\n  <script>window.__HIVEDASH_SUPABASE_BUNDLED__=true;<\/script>'
);

// Native speech shim must exist before inspection-voice.js evaluates SpeechRecognition.
html = html.replace(
  /<script\s+src=["']inspection-voice\.js([^"']*)["']><\/script>/i,
  '<script src="mobile-native-voice-shim.js"></script>\n  <script src="inspection-voice.js$1"></script>'
);

if (!html.includes('mobile-five-gaps.css')) {
  html = html.replace('</head>', '  <link rel="stylesheet" href="mobile-five-gaps.css">\n</head>');
}
// Last stylesheet in the APK only; preserve all frozen web theme/layout assets.
if (!html.includes('mobile-system-safe-area.css')) {
  html = html.replace('</head>', '  <link rel="stylesheet" href="mobile-system-safe-area.css">\n</head>');
}
if (!html.includes('mobile-five-gaps.js')) {
  html = html.replace('</body>', '  <script src="mobile-five-gaps.js"></script>\n</body>');
}
if (!html.includes('mobile-android-runtime-fixes.js')) {
  html = html.replace('</body>', '  <script src="mobile-android-runtime-fixes.js"></script>\n</body>');
}

// Service workers are unnecessary in a bundled native app and can preserve stale web code.
html = html.replace(
  /navigator\.serviceWorker\.register\(([^)]*)\)/g,
  'Promise.resolve({ scope: "native-bundled" })'
);

await fs.writeFile(indexPath, html, 'utf8');
console.log('Prepared Capacitor bundle at mobile/dist');
