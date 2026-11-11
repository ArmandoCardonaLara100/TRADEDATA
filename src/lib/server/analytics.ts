import type {Json} from '@/lib/supabase/types';
import {supabaseServer} from '@/lib/supabase/server';

export type AnalyticsFeature='overview'|'trading_journal'|'statistics'|'calendar'|'monte_carlo'|'funded_accounts'|'news'|'review'|'trade_sharing';
export type AnalyticsEvent='overview_viewed'|'pdf_exported'|'journal_viewed'|'trade_created'|'trade_updated'|'trade_deleted'|'instrument_saved'|'statistics_viewed'|'statistics_filter_changed'|'statistics_pdf_exported'|'calendar_viewed'|'calendar_day_opened'|'monte_carlo_viewed'|'simulation_run'|'funded_accounts_viewed'|'news_viewed'|'news_filter_changed'|'news_article_opened'|'review_viewed'|'review_submitted'|'trade_share_created'|'trade_share_revoked';

// Analytics is deliberately best-effort: a telemetry failure must never block
// the user's journal, sharing, export, or moderation workflow.
export async function recordAnalyticsEvent(feature:AnalyticsFeature,eventName:AnalyticsEvent,metadata:Record<string,Json>={}){
 try{
  const db=await supabaseServer();
  const {error}=await db.rpc('record_analytics_event',{p_feature:feature,p_event_name:eventName,p_metadata:metadata});
  if(error)console.warn('Analytics event was not recorded:',error.code);
 }catch(error){console.warn('Analytics event was not recorded:',error instanceof Error?error.message:'unknown error');}
}
