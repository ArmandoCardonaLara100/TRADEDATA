import {auth} from '@/lib/auth';
import {database} from '@/lib/database';
export const runtime='nodejs';
async function handler(request:Request){await database();return auth().handler(request);}
export {handler as GET,handler as POST};
