import {drizzle as drizzlePg,type NodePgDatabase} from 'drizzle-orm/node-postgres';
import {drizzle as drizzleLocal} from 'drizzle-orm/pglite';
import {migrate as migratePg} from 'drizzle-orm/node-postgres/migrator';
import {migrate as migrateLocal} from 'drizzle-orm/pglite/migrator';
import {PGlite} from '@electric-sql/pglite';
import {Pool} from 'pg';
import path from 'node:path';
import {mkdirSync} from 'node:fs';
import * as schema from './schema';

type Connection={db:NodePgDatabase<typeof schema>;ready:Promise<void>;close:()=>Promise<void>};
const globalDatabase=globalThis as unknown as {tradedataConnection?:Connection};
export function connection():Connection{
 if(globalDatabase.tradedataConnection)return globalDatabase.tradedataConnection;
 const migrationsFolder=path.join(process.cwd(),'drizzle');
 if(process.env.DATABASE_URL){
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:10});
  const db=drizzlePg(pool,{schema});
  // Production migrations are explicit; no schema changes from web requests.
  const ready=process.env.RUN_MIGRATIONS==='1'?migratePg(db,{migrationsFolder}):Promise.resolve();
  return globalDatabase.tradedataConnection={db,ready,close:()=>pool.end()};
 }
 if(process.env.NODE_ENV==='production'&&process.env.ALLOW_LOCAL_DATABASE!=='1')throw new Error('DATABASE_URL is required in production.');
 const directory=process.env.PGLITE_DATA_DIR||path.join(process.cwd(),'.data/postgres');
 mkdirSync(path.dirname(directory),{recursive:true,mode:0o700});
 const local=new PGlite(directory);
 const localDb=drizzleLocal(local,{schema});
 // Both drivers implement the same PostgreSQL query contract and schema.
 return globalDatabase.tradedataConnection={db:localDb as unknown as NodePgDatabase<typeof schema>,ready:migrateLocal(localDb,{migrationsFolder}),close:()=>local.close()};
}
export async function database(){const c=connection();await c.ready;return c.db;}
