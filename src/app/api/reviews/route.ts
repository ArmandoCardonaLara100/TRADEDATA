import {after} from 'next/server';
import {handle,requireUser,verifyOrigin,readJson} from '@/lib/server/http';
import {getReviewWorkspace,submitReview} from '@/lib/server/repository';
import {recordAnalyticsEvent} from '@/lib/server/analytics';

export const GET=()=>handle(async()=>{const user=await requireUser();return Response.json(await getReviewWorkspace(user.id),{headers:{'Cache-Control':'private, no-store'}});});
export const POST=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const review=await submitReview(user.id,await readJson(request));after(()=>recordAnalyticsEvent('review','review_submitted'));return Response.json(review,{status:201});});
