'use client';

import {Quote} from 'lucide-react';
import {memo} from 'react';
import {useLanguage,type MessageKey} from '@/lib/i18n';

const quoteKeys=[
 'news.quote.discipline',
 'news.quote.patience',
 'news.quote.risk',
 'news.quote.consistency',
 'news.quote.emotions',
 'news.quote.probability',
 'news.quote.plan',
 'news.quote.fomo',
 'news.quote.revenge',
 'news.quote.losses',
 'news.quote.setups',
 'news.quote.capital',
] as const satisfies readonly MessageKey[];

/** One lightweight, layout-level ticker shared by every non-admin workspace route. */
export const QuoteTicker=memo(function QuoteTicker(){
 const {t}=useLanguage();
 return <section className="quote-ticker" aria-label={t('news.quoteLabel')}>
  <Quote size={16} aria-hidden="true"/>
  <div className="quote-ticker-viewport">
   <div className="quote-ticker-track">
    <div className="quote-ticker-group">{quoteKeys.map(key=><span key={key}>{t(key)}</span>)}</div>
    <div className="quote-ticker-group" aria-hidden="true">{quoteKeys.map(key=><span key={key}>{t(key)}</span>)}</div>
   </div>
  </div>
 </section>;
});
