import pg from "pg"; export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL||"postgresql://kutara:Kutara2014!@127.0.0.1:5432/kutara",max:20,idleTimeoutMillis:30000});
