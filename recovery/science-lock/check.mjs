/**
 * Beekeepy recovery science integrity gate.
 * READ-ONLY: this script never opens any original file for writing.
 * Reference hashes are from a user-uploaded 2026-11-10 snapshot, NOT 2026-11-23.
 */
import {createHash} from 'node:crypto';
import {readFileSync, existsSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const defaultRoot=path.resolve(here,'../..');
export function inspect({root=defaultRoot,manifestPath=path.join(here,'original-20261110.json'),profile='science'}={}){
  if(profile!=='science'&&profile!=='observed-20261121') throw new Error('Unsupported profile');
  const base=realpathSync(root);
  const lock=JSON.parse(readFileSync(manifestPath,'utf8'));
  const expected=profile==='science'?lock.scienceFiles:lock.laterObservedSha256?.['2026-11-21'];
  if(!expected||!Object.keys(expected).length)throw new Error('Empty or missing trusted hash manifest');
  let ok=0;
  const errors=[];
  for(const [rel,want] of Object.entries(expected)){
    if(!/^[a-f0-9]{64}$/.test(want)||path.isAbsolute(rel)||rel.startsWith('..')||rel.includes('\\')){
      throw new Error('Malformed manifest entry: '+rel);
    }
    const candidate=path.join(base,rel);
    if(!existsSync(candidate)){errors.push({path:rel,status:'MISSING'});continue;}
    const actualPath=realpathSync(candidate);
    if(!(actualPath===base||actualPath.startsWith(base+path.sep))){errors.push({path:rel,status:'SYMLINK_ESCAPES_ROOT'});continue;}
    const got=createHash('sha256').update(readFileSync(actualPath)).digest('hex');
    if(got!==want){errors.push({path:rel,status:'SHA256_MISMATCH',expected:want,actual:got});continue;}
    ok++;
  }
  return {profile,root:base,referenceDate:profile==='science'?'2026-11-10':'2026-11-21',
    historicalStatus:'NOT_VERIFIED_AS_2026-11-23',checked:Object.keys(expected).length,matched:ok,
    errors,passed:errors.length===0};
}

if(process.argv[1]&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))){
  const args=new Set(process.argv.slice(2));
  const profile=args.has('--20261121')?'observed-20261121':'science';
  const report=inspect({profile});
  console.log(JSON.stringify(report,null,2));
  if(args.has('--strict')&&!report.passed)process.exitCode=1;
}
