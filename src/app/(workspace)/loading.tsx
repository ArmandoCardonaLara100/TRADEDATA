'use client';
import {useLanguage} from '@/lib/i18n';
export default function Loading(){const {t}=useLanguage();return <div className="loading-content" role="status"><div className="skeleton skeleton-title"/><div className="metric-grid">{[0,1,2,3].map(index=><div className="skeleton skeleton-card" key={index}/>)}</div><div className="skeleton skeleton-chart"/><span className="sr-only">{t('runtime.loadingWorkspace')}</span></div>}
