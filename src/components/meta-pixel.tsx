'use client';

import {useEffect,useRef,useState} from 'react';
import Script from 'next/script';
import {usePathname} from 'next/navigation';

const pixelId='1137213785581868';

export function trackCompleteRegistration(){
 if(typeof window==='undefined')return;
 try{window.fbq?.('track','CompleteRegistration');}catch{/* Analytics must never affect registration. */}
}

export function MetaPixel(){
 const pathname=usePathname();
 const previousPath=useRef<string|null>(null);
 const [enabled,setEnabled]=useState(false);

 useEffect(()=>{
  setEnabled(['tradingdata.tech','www.tradingdata.tech'].includes(window.location.hostname));
 },[]);

 useEffect(()=>{
  if(!enabled||!pathname)return;
  if(previousPath.current===null){previousPath.current=pathname;return;}
  if(previousPath.current===pathname)return;
  previousPath.current=pathname;
  window.fbq?.('track','PageView');
 },[enabled,pathname]);

 if(!enabled)return null;
 return <>
  <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}</Script>
  <noscript><img height="1" width="1" style={{display:'none'}} src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} alt=""/></noscript>
 </>;
}

declare global {interface Window {fbq?:((...args:unknown[])=>void)&{callMethod?:unknown;queue?:unknown[];loaded?:boolean;version?:string;push?:Window['fbq']}}}
