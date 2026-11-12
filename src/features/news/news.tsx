'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,ArrowUpRight,Newspaper,RefreshCw,Search} from 'lucide-react';
import {Button,Empty,PageHeading,Panel} from '@/components/ui';
import {useLanguage,type MessageKey} from '@/lib/i18n';
import type {MarketNewsArticle,MarketNewsResponse,NewsCategory} from '@/types/news';
import {trackAnalytics,useAnalyticsView} from '@/lib/analytics/client';

const categories:NewsCategory[]=['latest','stocks','forex','crypto'];
const REFRESH_COOLDOWN_MS=30_000;

function localDayKey(value:string){
 const date=new Date(value);
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function ArticleTickers({article}:{article:MarketNewsArticle}){
 if(!article.tickers.length)return null;
 return <div className="news-article-tickers">{article.tickers.slice(0,3).map(ticker=><span key={ticker}>{ticker}</span>)}</div>;
}

export function News(){
 useAnalyticsView('news','news_viewed');
 const {t,language}=useLanguage(),locale=language==='es'?'es-MX':'en-US';
 const [category,setCategory]=useState<NewsCategory>('latest'),[articles,setArticles]=useState<MarketNewsArticle[]>([]),[available,setAvailable]=useState<NewsCategory[]>(['latest']);
 const [page,setPage]=useState(0),[hasMore,setHasMore]=useState(false),[status,setStatus]=useState<'ok'|'stale'>('ok'),[checkedAt,setCheckedAt]=useState('');
 const [loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false),[error,setError]=useState(false),[search,setSearch]=useState(''),[revision,setRevision]=useState(0),[cooldown,setCooldown]=useState(false);
 const initial=useRef(true),cooldownTimer=useRef<number|undefined>(undefined);
 useEffect(()=>()=>window.clearTimeout(cooldownTimer.current),[]);
 useEffect(()=>{
  const controller=new AbortController();let active=true;setLoading(true);setError(false);
  fetch(`/api/news?category=${category}&page=0&r=${revision}`,{signal:controller.signal,headers:{Accept:'application/json'}})
   .then(async response=>{if(!response.ok)throw new Error('unavailable');return response.json() as Promise<MarketNewsResponse>;})
   .then(result=>{if(!active)return;setArticles(result.articles);setAvailable(result.availableCategories);setPage(0);setHasMore(result.hasMore);setStatus(result.status);setCheckedAt(result.checkedAt);})
   .catch(cause=>{if(!active||cause instanceof DOMException&&cause.name==='AbortError')return;setArticles([]);setError(true);})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;controller.abort();};
 },[category,revision]);
 useEffect(()=>{if(initial.current){initial.current=false;return;}trackAnalytics('news','news_filter_changed',{filter_name:'category'});},[category]);
 const filtered=useMemo(()=>{const query=search.trim().toLocaleLowerCase(locale);if(!query)return articles;return articles.filter(article=>[article.title,article.description,article.source,...article.tickers].some(value=>value.toLocaleLowerCase(locale).includes(query)));},[articles,locale,search]);
 const timelineGroups=useMemo(()=>{
  const groups=new Map<string,{label:string;articles:MarketNewsArticle[]}>();
  const dayLabel=new Intl.DateTimeFormat(locale,{weekday:'long',month:'long',day:'numeric'});
  for(const article of filtered.slice(1)){
   const key=localDayKey(article.publishedAt),existing=groups.get(key);
   if(existing)existing.articles.push(article);
   else groups.set(key,{label:dayLabel.format(new Date(article.publishedAt)),articles:[article]});
  }
  return [...groups.entries()].map(([key,value])=>({key,...value}));
 },[filtered,locale]);
 const featured=filtered[0];
 const selectCategory=(value:NewsCategory)=>{setSearch('');setCategory(value);};
 const refresh=()=>{if(cooldown)return;setCooldown(true);setRevision(value=>value+1);cooldownTimer.current=window.setTimeout(()=>setCooldown(false),REFRESH_COOLDOWN_MS);};
 async function loadMore(){
  const next=page+1;setLoadingMore(true);setError(false);
  try{const response=await fetch(`/api/news?category=${category}&page=${next}`,{headers:{Accept:'application/json'}});if(!response.ok)throw new Error('unavailable');const result=await response.json() as MarketNewsResponse;setArticles(current=>[...current,...result.articles.filter(article=>!current.some(existing=>existing.articleUrl===article.articleUrl))]);setPage(next);setHasMore(result.hasMore);setStatus(result.status);setCheckedAt(result.checkedAt);}
  catch{setError(true);}finally{setLoadingMore(false);}
 }
 const openArticle=(article:MarketNewsArticle)=>trackAnalytics('news','news_article_opened',{category:article.category});
 return <>
  <PageHeading eyebrow={t('news.eyebrow')} title={t('news.title')} description={t('news.description')} actions={<Button variant="secondary" disabled={loading||cooldown} onClick={refresh}><RefreshCw size={15} className={loading?'spin':''}/>{cooldown?t('news.refreshWait'):t('news.refresh')}</Button>}/>
  <div className="news-feed-status" aria-live="polite">
   <span className={`news-feed-state ${status}`}><i/>{status==='ok'?t('news.live'):t('news.cached')}</span>
   <span className="news-feed-provider">FINANCIAL MODELING PREP</span>
   {checkedAt&&<span>{t('news.checked').replace('{time}',new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(checkedAt)))}</span>}
  </div>
  <Panel className="news-control-panel"><div className="news-category-tabs" role="tablist" aria-label={t('news.categories')}>{categories.filter(value=>available.includes(value)).map(value=><button key={value} type="button" role="tab" aria-selected={category===value} className={category===value?'active':''} onClick={()=>selectCategory(value)}>{t(`news.category.${value}` as MessageKey)}</button>)}</div><label className="news-search"><span className="sr-only">{t('news.search')}</span><Search size={16}/><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder={t('news.searchPlaceholder')} maxLength={100}/></label></Panel>
  {status==='stale'&&!loading&&<div className="news-stale" role="status"><AlertTriangle size={17}/><div><strong>{t('news.stale')}</strong><span>{t('news.staleText')}</span></div></div>}
  {loading?<NewsSkeleton label={t('common.loading')}/>:error&&!articles.length?<Panel className="news-state-panel"><Empty icon={<AlertTriangle size={28}/>} title={t('news.unavailable')} description={t('news.unavailableText')}/></Panel>:articles.length===0?<Panel className="news-state-panel"><Empty icon={<Newspaper size={28}/>} title={t('news.noArticles')} description={t('news.noArticlesText')}/></Panel>:featured?<section className="market-news-board" aria-label={t('news.articlesLabel')}>
   <article className="news-briefing">
    <div className="news-briefing-label"><span>{t('news.latestBriefing')}</span><ArticleTickers article={featured}/></div>
    <div className="news-briefing-grid">
     <div className="news-briefing-copy"><div className="market-news-meta"><span>{featured.source}</span><span>{t(`news.category.${featured.category}` as MessageKey)}</span></div><h2>{featured.title}</h2>{featured.description&&<p>{featured.description}</p>}<a href={featured.articleUrl} target="_blank" rel="noopener noreferrer" onClick={()=>openArticle(featured)}>{t('news.readArticle')}<ArrowUpRight size={15}/><span className="sr-only">: {featured.title}</span></a></div>
     <time className="news-briefing-time" dateTime={featured.publishedAt}><strong>{new Intl.DateTimeFormat(locale,{hour:'numeric',minute:'2-digit'}).format(new Date(featured.publishedAt))}</strong><span>{new Intl.DateTimeFormat(locale,{weekday:'short',month:'short',day:'numeric'}).format(new Date(featured.publishedAt))}</span></time>
    </div>
   </article>
   {timelineGroups.length>0&&<div className="news-timeline">{timelineGroups.map(group=><section className="news-day-group" key={group.key}><h2>{group.label}</h2><div className="news-day-list">{group.articles.map(article=><article className="news-timeline-row" key={article.id}>
    <time dateTime={article.publishedAt}>{new Intl.DateTimeFormat(locale,{hour:'numeric',minute:'2-digit'}).format(new Date(article.publishedAt))}</time>
    <div className="news-row-identity"><ArticleTickers article={article}/><span>{t(`news.category.${article.category}` as MessageKey)}</span></div>
    <div className="news-row-story"><span>{article.source}</span><h3><a href={article.articleUrl} target="_blank" rel="noopener noreferrer" onClick={()=>openArticle(article)}>{article.title}<ArrowUpRight size={13}/><span className="sr-only"> · {t('news.readArticle')}</span></a></h3>{article.description&&<p>{article.description}</p>}</div>
   </article>)}</div></section>)}</div>}
  </section>:<Panel className="news-state-panel"><Empty icon={<Search size={28}/>} title={t('news.empty')} description={t('news.emptyText')}/></Panel>}
  {!loading&&articles.length>0&&<div className="news-footer-actions">{hasMore&&<Button variant="secondary" loading={loadingMore} onClick={()=>void loadMore()}>{t('news.loadMore')}</Button>}<div className="news-source"><a href="https://financialmodelingprep.com/" target="_blank" rel="noopener noreferrer">{t('news.source')}</a>{checkedAt&&<span>{t('news.checked').replace('{time}',new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(checkedAt)))}</span>}</div></div>}
 </>;
}

function NewsSkeleton({label}:{label:string}){return <div className="market-news-board news-board-skeleton" aria-live="polite" aria-label={label}><div className="news-briefing news-card-skeleton"><i/><i/><i/></div><div className="news-timeline">{Array.from({length:2},(_,group)=><section className="news-day-group" key={group}><i/>{Array.from({length:3},(_,index)=><div className="news-timeline-row news-card-skeleton" key={index}><i/><i/><i/></div>)}</section>)}</div></div>;}
