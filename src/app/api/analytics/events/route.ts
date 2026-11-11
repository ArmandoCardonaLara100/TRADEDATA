import {z} from 'zod';
import {handle,readJson,requireUser,verifyOrigin} from '@/lib/server/http';
import {recordAnalyticsEvent} from '@/lib/server/analytics';

const schema=z.object({
 feature:z.enum(['overview','trading_journal','statistics','calendar','monte_carlo','funded_accounts','news','review','trade_sharing']),
 eventName:z.enum(['overview_viewed','pdf_exported','journal_viewed','trade_created','trade_updated','trade_deleted','instrument_saved','statistics_viewed','statistics_filter_changed','statistics_pdf_exported','calendar_viewed','calendar_day_opened','monte_carlo_viewed','simulation_run','funded_accounts_viewed','news_viewed','news_filter_changed','news_article_opened','review_viewed','review_submitted','trade_share_created','trade_share_revoked']),
 metadata:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).default({}),
});

export const POST=(request:Request)=>handle(async()=>{
 verifyOrigin(request);await requireUser();const event=schema.parse(await readJson(request));
 await recordAnalyticsEvent(event.feature,event.eventName,event.metadata);
 return new Response(null,{status:204,headers:{'Cache-Control':'private, no-store'}});
});
