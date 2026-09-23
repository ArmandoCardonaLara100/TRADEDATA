process.env.RUN_MIGRATIONS='1';
export {};
const {connection}=await import('../src/lib/database/index');
const c=connection();await c.ready;await c.close();console.log('Database migrations applied.');
