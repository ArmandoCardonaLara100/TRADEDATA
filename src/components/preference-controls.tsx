'use client';
import {Languages,Monitor,Moon,Sun} from 'lucide-react';
import {useTheme} from 'next-themes';
import {useEffect,useState} from 'react';
import {useLanguage,type Language} from '@/lib/i18n';

export function LanguageSelect({compact=false}:{compact?:boolean}){const {language,setLanguage}=useLanguage();return <label className={compact?'preference-select compact':'preference-select'}><Languages size={15}/><span className="sr-only">Language</span><select aria-label="Language" value={language} onChange={event=>setLanguage(event.target.value as Language)}><option value="en">EN</option><option value="es">ES</option></select></label>}
export function ThemeSelect({compact=false}:{compact?:boolean}){const {theme,setTheme}=useTheme();const {t}=useLanguage();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const current=mounted?(theme||'system'):'system';return <label className={compact?'preference-select compact':'preference-select'}>{current==='dark'?<Moon size={15}/>:current==='light'?<Sun size={15}/>:<Monitor size={15}/>}<span className="sr-only">{t('settings.colorTheme')}</span><select aria-label={t('settings.colorTheme')} value={current} onChange={event=>setTheme(event.target.value)}><option value="system">{compact?'SYS':t('settings.system')}</option><option value="light">{compact?'LIGHT':t('settings.light')}</option><option value="dark">{compact?'DARK':t('settings.dark')}</option></select></label>}
