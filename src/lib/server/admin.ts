import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {check} from './repository';
import {HttpError} from './http';
import type {AdminDashboardData,AdminRange,AdminReviewStatus} from '@/types/admin';

const dashboardSchema=z.object({
 range:z.enum(['7d','30d','90d','all']),generatedAt:z.string(),analyticsEnabledAt:z.string().nullable(),
 kpis:z.object({totalUsers:z.number(),activeUsers:z.number(),newUsers:z.number(),dailyActiveUsers:z.number(),weeklyActiveUsers:z.number(),monthlyActiveUsers:z.number(),tradingAccounts:z.number(),trades:z.number(),tradesToday:z.number(),tradesThisWeek:z.number(),tradesThisMonth:z.number(),pendingReviews:z.number()}),
 userGrowth:z.array(z.object({date:z.string(),newUsers:z.number(),activeUsers:z.number()})),
 featureTimeline:z.array(z.object({date:z.string(),feature:z.string(),actualUses:z.number()})),
 features:z.array(z.object({feature:z.string(),total_events:z.number(),page_views:z.number(),actual_uses:z.number(),distinct_users:z.number(),adoption_percent:z.number(),trend_percent:z.number().nullable()})),
 users:z.object({page:z.number(),pageSize:z.number(),total:z.number(),items:z.array(z.object({name:z.string(),createdAt:z.string(),role:z.enum(['user','review_admin','admin']),lastActivity:z.string().nullable(),accountCount:z.number(),tradeCount:z.number(),status:z.enum(['active','inactive','blocked'])}))}),
 reviews:z.object({page:z.number(),pageSize:z.number(),total:z.number(),status:z.enum(['all','pending','approved','rejected']),items:z.array(z.object({id:z.string().uuid(),reviewerName:z.string(),reviewText:z.string(),status:z.enum(['pending','approved','rejected']),submittedAt:z.string(),approvedAt:z.string().nullable(),isOwn:z.boolean()}))}),
});

export async function userRole(userId:string){
 const db=await supabaseServer(),result=await db.from('user_roles').select('role').eq('user_id',userId).maybeSingle();
 check(result.error);return result.data?.role==='admin'?'admin':result.data?.role==='review_admin'?'review_admin':'user';
}
export async function isFullAdmin(userId:string){return (await userRole(userId))==='admin';}
export async function requireFullAdmin(userId:string){if(!await isFullAdmin(userId))throw new HttpError(403,'Administrator access required.');}

export async function getAdminDashboard(range:AdminRange='30d',userPage=1,reviewStatus:AdminReviewStatus='pending',reviewPage=1):Promise<AdminDashboardData>{
 const db=await supabaseServer();
 const result=await db.rpc('get_admin_dashboard',{p_range:range,p_user_page:userPage,p_review_status:reviewStatus,p_review_page:reviewPage});
 check(result.error);return dashboardSchema.parse(result.data) as AdminDashboardData;
}
