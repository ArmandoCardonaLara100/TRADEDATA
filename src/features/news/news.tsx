'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,ArrowUpRight,Clock3,ImageOff,Newspaper,RefreshCw,Search} from 'lucide-react';
import {Button,Empty,PageHeading,Panel} from '@/components/ui';
import {useLanguage,type MessageKey} from '@/lib/i18n';
import type {MarketNewsArticle,MarketNewsResponse,NewsCategory} from '@/types/news';
import {trackAnalytics,useAnalyticsView} from '@/lib/analytics/client';

const categories:NewsCategory[]=['latest','stocks','forex','crypto'];
const REFRESH_COOLDOWN_MS=30_000;
const quoteKeys=['news.quote.discipline','news.quote.patience','news.quote.risk','news.quote.consistency','news.quote.fomo','news.quote.losses','news.quote.plan','news.quote.probability'] as const;

function NewsImage({article}:{article:MarketNewsArticle}){
 const [failed,setFailed]=useState(false);
 if(!article.imageUrl||failed)return <div className="news-image-fallback" aria-hidden="true"><ImageOff size={24}/></div>;
 return <img src={article.imageUrl} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>;
}

function QuoteTicker(){
 const {t}=useLanguage(),quotes=quoteKeys.map(key=>t(key));
 return <section className="quote-ticker" aria-label={t('news.quoteLabel')}><Newspaper size={16}/><div className="quote-ticker-viewport"><div className="quote-ticker-track"><div className="quote-ticker-group">{quotes.map(quote=><span key={quote}>{quote}</span>)}</div><div className="quote-ticker-group" aria-hidden="true">{quotes.map(quote=><span key={quote}>{quote}</span>)}</div></div></div></section>;
}

export function News(){
 useAnalyticsView('news','news_viewed');
 const {t,language}=useLanguage(),locale=language==='es'?'es-MX':'en-US';
 const [category,setCategory]=useState<NewsCategory>('latest'),[articles,setArticles]=useState<MarketNewsArticle[]>([]),[available,setAvailable]=useState<NewsCategory[]>(['latest']);
 const [page,setPage]=useState(0),[hasMore,setHasMore]=useState(false),[status,setStatus]=useState<'ok'|'stale'>('ok'),[checkedAt,setCheckedAt]=useState('');
 const [loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false),[error,setError]=useState(false),[search,setSearch]=useState(''),[revision,setRevision]=useState(0),[cooldown,setCooldown]=useState(false);
 const initial=useRef(true);
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
 const selectCategory=(value:NewsCategory)=>{setSearch('');setCategory(value);};
 const refresh=()=>{if(cooldown)return;setCooldown(true);setRevision(value=>value+1);window.setTimeout(()=>setCooldown(false),REFRESH_COOLDOWN_MS);};
 async function loadMore(){
  const next=page+1;setLoadingMore(true);setError(false);
  try{const response=await fetch(`/api/news?category=${category}&page=${next}`,{headers:{Accept:'application/json'}});if(!response.ok)throw new Error('unavailable');const result=await response.json() as MarketNewsResponse;setArticles(current=>[...current,...result.articles.filter(article=>!current.some(existing=>existing.articleUrl===article.articleUrl))]);setPage(next);setHasMore(result.hasMore);setStatus(result.status);setCheckedAt(result.checkedAt);}
  catch{setError(true);}finally{setLoadingMore(false);}
 }
 return <>
  <PageHeading eyebrow={t('news.eyebrow')} title={t('news.title')} description={t('news.description')} actions={<Button variant="secondary" disabled={loading||cooldown} onClick={refresh}><RefreshCw size={15} className={loading?'spin':''}/>{cooldown?t('news.refreshWait'):t('news.refresh')}</Button>}/>
  <QuoteTicker/>
  <Panel className="news-control-panel"><div className="news-category-tabs" role="tablist" aria-label={t('news.categories')}>{categories.filter(value=>available.includes(value)).map(value=><button key={value} type="button" role="tab" aria-selected={category===value} className={category===value?'active':''} onClick={()=>selectCategory(value)}>{t(`news.category.${value}` as MessageKey)}</button>)}</div><label className="news-search"><span className="sr-only">{t('news.search')}</span><Search size={16}/><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder={t('news.searchPlaceholder')} maxLength={100}/></label></Panel>
  {status==='stale'&&!loading&&<div className="news-stale" role="status"><AlertTriangle size={17}/><div><strong>{t('news.stale')}</strong><span>{t('news.staleText')}</span></div></div>}
  {loading?<NewsSkeleton label={t('common.loading')}/>:error&&!articles.length?<Panel><Empty icon={<AlertTriangle size={28}/>} title={t('news.unavailable')} description={t('news.unavailableText')}/></Panel>:articles.length===0?<Panel><Empty icon={<Search size={28}/>} title={t('news.noArticles')} description={t('news.noArticlesText')}/></Panel>:filtered.length?<section className="market-news-layout" aria-label={t('news.articlesLabel')}><article className="market-news-lead"><div className="market-news-lead-image"><NewsImage article={filtered[0]}/>{filtered[0].tickers.length>0&&<div className="market-news-tickers">{filtered[0].tickers.slice(0,3).map(ticker=><span key={ticker}>{ticker}</span>)}</div>}</div><div className="market-news-lead-body"><span className="eyebrow">{t('news.featured')}</span><div className="market-news-meta"><span>{filtered[0].source}</span><time dateTime={filtered[0].publishedAt}><Clock3 size={12}/>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(filtered[0].publishedAt))}</time></div><h2>{filtered[0].title}</h2>{filtered[0].description&&<p>{filtered[0].description}</p>}<a href={filtered[0].articleUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('news','news_article_opened',{category:filtered[0].category})}>{t('news.readArticle')}<ArrowUpRight size={15}/><span className="sr-only">: {filtered[0].title}</span></a></div></article>{filtered.length>1&&<div className="market-news-stream"><header><span className="eyebrow">{t('news.timeline')}</span><h2>{t('news.latestUpdates')}</h2></header>{filtered.slice(1).map(article=><article className="market-news-row" key={article.id}><div className="market-news-row-image"><NewsImage article={article}/></div><div><div className="market-news-meta"><span>{article.source}</span><time dateTime={article.publishedAt}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(article.publishedAt))}</time></div><h3><a href={article.articleUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('news','news_article_opened',{category:article.category})}>{article.title}<ArrowUpRight size={13}/></a></h3>{article.description&&<p>{article.description}</p>}{article.tickers.length>0&&<div className="market-news-inline-tickers">{article.tickers.slice(0,3).map(ticker=><span key={ticker}>{ticker}</span>)}</div>}</div></article>)}</div>}</section>:<Panel><Empty icon={<Search size={28}/>} title={t('news.empty')} description={t('news.emptyText')}/></Panel>}
  {!loading&&articles.length>0&&<div className="news-footer-actions">{hasMore&&<Button variant="secondary" loading={loadingMore} onClick={()=>void loadMore()}>{t('news.loadMore')}</Button>}<div className="news-source"><a href="https://financialmodelingprep.com/" target="_blank" rel="noopener noreferrer">{t('news.source')}</a>{checkedAt&&<span>{t('news.checked').replace('{time}',new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(checkedAt)))}</span>}</div></div>}
 </>;
}

function NewsSkeleton({label}:{label:string}){return <div className="market-news-layout news-layout-skeleton" aria-live="polite" aria-label={label}><div className="market-news-lead news-card-skeleton"><div className="market-news-lead-image"/><div className="market-news-lead-body"><i/><i/><i/></div></div><div className="market-news-stream">{Array.from({length:4},(_,index)=><div className="market-news-row news-card-skeleton" key={index}><div className="market-news-row-image"/><div><i/><i/><i/></div></div>)}</div></div>;}
