import type {Metadata} from 'next';
import {Providers} from '@/components/providers';
import {MetaPixel} from '@/components/meta-pixel';
import './globals.css';
export const metadata:Metadata={metadataBase:new URL(process.env.NEXT_PUBLIC_APP_URL||'https://tradingdata.tech'),title:{default:'TRADEDATA — Trading analytics',template:'%s · TRADEDATA'},description:'A private trading journal, statistical workbench, and probability simulator.',robots:{index:false,follow:false},other:{'facebook-domain-verification':'uyffa8uhhos8sf9a0ntajdury5oj6c'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es" suppressHydrationWarning><body><MetaPixel/><Providers>{children}</Providers></body></html>;}
