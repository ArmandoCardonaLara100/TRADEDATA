import type {Metadata} from 'next';
import {Providers} from '@/components/providers';
import './globals.css';
export const metadata:Metadata={metadataBase:new URL(process.env.NEXT_PUBLIC_APP_URL||'https://tradingdata.tech'),title:{default:'TRADEDATA — Trading analytics',template:'%s · TRADEDATA'},description:'A private trading journal, statistical workbench, and probability simulator.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;}
