'use client';
import Link from 'next/link';
import {useLanguage} from '@/lib/i18n';
export default function NotFound(){const {t}=useLanguage();return <main className="empty-state"><h1>{t('runtime.notFoundTitle')}</h1><p>{t('runtime.notFoundText')}</p><Link href="/dashboard" className="button primary">{t('runtime.notFoundAction')}</Link></main>}
