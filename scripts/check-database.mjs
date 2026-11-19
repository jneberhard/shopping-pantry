import pg from 'pg';
if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL in .env first.');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000});
try{
  await db.connect();
  const result=await db.query("SELECT to_regclass('public.households') IS NOT NULL AS migrated");
  if(!result.rows[0].migrated)throw new Error('Connected, but migrations are missing. Run pnpm db:migrate.');
  console.log('Database connected. Kitchen tables are ready.');
}catch{console.error('Database check failed. Check the Neon connection string and run pnpm db:migrate.');process.exitCode=1;}finally{await db.end();}
