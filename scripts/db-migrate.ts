import {migrate,closeDatabase,execute} from '../src/lib/db/client';
import {CONTACT_SCHEMA} from '../src/lib/contact/store';
async function main(){
try{await migrate();await execute(CONTACT_SCHEMA);await execute('CREATE TABLE IF NOT EXISTS routing_usage_daily(day text PRIMARY KEY,requests integer NOT NULL DEFAULT 0)');console.log('Database and inquiry schemas ready.');}finally{await closeDatabase();}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
