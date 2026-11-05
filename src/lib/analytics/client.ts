'use client';
import {useEffect} from 'react';
import type {AnalyticsEvent,AnalyticsFeature} from '@/lib/server/analytics';

const recentViews=new Map<string,number>();
const VIEW_DEDUPE_MS=2000;

export function trackAnalytics(feature:AnalyticsFeature,eventName:AnalyticsEvent,metadata:Record<string,string|number|boolean>={}){
 try{
  void fetch('/api/analytics/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({feature,eventName,metadata}),keepalive:true}).catch(()=>{});
 }catch{/* Analytics never interrupts product actions. */}
}

export function useAnalyticsView(feature:AnalyticsFeature,eventName:AnalyticsEvent){
 useEffect(()=>{const key=`${feature}:${eventName}`,now=Date.now();if(now-(recentViews.get(key)||0)<VIEW_DEDUPE_MS)return;recentViews.set(key,now);trackAnalytics(feature,eventName);},[feature,eventName]);
}
