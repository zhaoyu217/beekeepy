import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const android = path.join(root, 'android');
const app = path.join(android, 'app');

async function read(p){ return fs.readFile(p, 'utf8'); }
async function write(p,s){ await fs.writeFile(p,s,'utf8'); }
async function ensureDir(p){ await fs.mkdir(p,{recursive:true}); }

const pluginSrc = path.join(root,'mobile','native','android','OfflineAsrPlugin.kt');
const pluginDst = path.join(app,'src','main','java','app','hivefield','mobile','OfflineAsrPlugin.kt');
await ensureDir(path.dirname(pluginDst));
await fs.copyFile(pluginSrc, pluginDst);

const mainPath = path.join(app,'src','main','java','app','hivefield','mobile','MainActivity.java');
let main = await read(mainPath);
main = `package app.hivefield.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OfflineAsrPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;
await write(mainPath, main);

const manifestPath = path.join(app,'src','main','AndroidManifest.xml');
let manifest = await read(manifestPath);
if(!manifest.includes('android.permission.RECORD_AUDIO')){
  manifest = manifest.replace(
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.RECORD_AUDIO" />'
  );
}
await write(manifestPath, manifest);

const topGradlePath = path.join(android,'build.gradle');
let topGradle = await read(topGradlePath);
if(!topGradle.includes('org.jetbrains.kotlin:kotlin-gradle-plugin')){
  topGradle = topGradle.replace(
    "classpath 'com.android.tools.build:gradle:8.13.0'",
    "classpath 'com.android.tools.build:gradle:8.13.0'\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.20'"
  );
}
await write(topGradlePath, topGradle);

const appGradlePath = path.join(app,'build.gradle');
let appGradle = await read(appGradlePath);
if(!appGradle.includes("apply plugin: 'org.jetbrains.kotlin.android'")){
  appGradle = appGradle.replace(
    "apply plugin: 'com.android.application'",
    "apply plugin: 'com.android.application'\napply plugin: 'org.jetbrains.kotlin.android'"
  );
}
if(!appGradle.includes("sherpa-onnx-1.13.8.aar")){
  appGradle = appGradle.replace(
    'dependencies {',
    `dependencies {
    implementation files('libs/sherpa-onnx-1.13.8.aar')
    implementation 'org.jetbrains.kotlin:kotlin-stdlib:2.1.20'`
  );
}
if(!appGradle.includes("noCompress += ['onnx', 'txt']")){
  appGradle = appGradle.replace(
    'android {',
    `android {
    androidResources {
        noCompress += ['onnx', 'txt']
    }`
  );
}
if(!appGradle.includes('applicationIdSuffix ".fix"')){
  appGradle = appGradle.replace(
    'buildTypes {',
    `buildTypes {
        debug {
            applicationIdSuffix ".fix"
            versionNameSuffix "-fix"
        }`
  );
}
if(!appGradle.includes('kotlinOptions {')){
  appGradle = appGradle.replace(
    /\n}\n\nrepositories \{/,
    `
    kotlinOptions {
        jvmTarget = '21'
    }
}

repositories {`
  );
}
await write(appGradlePath, appGradle);

const stringsPath = path.join(app,'src','main','res','values','strings.xml');
let strings = await read(stringsPath);
strings = strings
  .replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">Hive FIX</string>')
  .replace(/<string name="title_activity_main">[^<]*<\/string>/, '<string name="title_activity_main">Hive FIX</string>');
await write(stringsPath, strings);

console.log('Android native offline ASR integration configured.');
console.log('Plugin:', pluginDst);
console.log('Manifest permission: RECORD_AUDIO');
console.log('Sherpa AAR: android/app/libs/sherpa-onnx-1.13.8.aar');
console.log('Debug package: app.hivefield.mobile.fix');
console.log('Debug app label: Hive FIX');
