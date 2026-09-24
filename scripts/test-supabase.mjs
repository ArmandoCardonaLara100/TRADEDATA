// Test-only administrative access. Keys stay in process memory and are never logged or saved.
import {execFileSync, spawnSync} from 'node:child_process';
import {loadEnvFile} from 'node:process';
try { loadEnvFile('.env.local'); } catch { /* CI provides environment variables. */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL before running integration tests.');
let key = process.env.SUPABASE_TEST_SECRET_KEY;
if (!key) {
  const ref = new URL(url).hostname.split('.')[0];
  const result = JSON.parse(execFileSync('supabase', ['projects','api-keys','--project-ref',ref,'--reveal','--output','json'], {encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  const keys = Array.isArray(result) ? result : result.keys;
  key = keys.find(item => item.type === 'secret' || item.api_key?.startsWith('sb_secret_'))?.api_key;
  if (!key) key = keys.find(item => item.name === 'service_role')?.api_key;
}
if (!key) throw new Error('No test administration key available. Authenticate the Supabase CLI or set SUPABASE_TEST_SECRET_KEY.');
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)], {
  stdio:'inherit', env:{...process.env,SUPABASE_TEST_SECRET_KEY:key},
});
process.exitCode = result.status ?? 1;
