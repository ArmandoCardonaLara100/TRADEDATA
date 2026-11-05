import {z} from 'zod';
import {getAdminDashboard,requireFullAdmin} from '@/lib/server/admin';
import {handle,requireUser} from '@/lib/server/http';

const querySchema=z.object({
 range:z.enum(['7d','30d','90d','all']).default('30d'),
 userPage:z.coerce.number().int().min(1).max(100000).default(1),
 reviewStatus:z.enum(['all','pending','approved','rejected']).default('pending'),
 reviewPage:z.coerce.number().int().min(1).max(100000).default(1),
});

export const GET=(request:Request)=>handle(async()=>{
 const user=await requireUser();await requireFullAdmin(user.id);
 const params=Object.fromEntries(new URL(request.url).searchParams),query=querySchema.parse(params);
 return Response.json(await getAdminDashboard(query.range,query.userPage,query.reviewStatus,query.reviewPage),{headers:{'Cache-Control':'private, no-store'}});
});
