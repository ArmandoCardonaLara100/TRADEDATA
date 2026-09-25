'use client';
import {ThemeProvider} from 'next-themes';
import type {ReactNode} from 'react';
import {LanguageProvider} from '@/lib/i18n';
export function Providers({children}:{children:ReactNode}){return <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange><LanguageProvider>{children}</LanguageProvider></ThemeProvider>;}
