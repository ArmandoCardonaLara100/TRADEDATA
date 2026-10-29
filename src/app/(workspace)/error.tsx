'use client';
import {Button} from '@/components/ui';
import {useLanguage} from '@/lib/i18n';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){const {t}=useLanguage();return <div className="empty-state"><h1>{t('runtime.errorTitle')}</h1><p>{t('runtime.errorText')}</p><Button onClick={reset}>{t('runtime.retry')}</Button></div>;}
