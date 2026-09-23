'use client';
import {Button} from '@/components/ui';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <div className="empty-state"><h1>Your workspace couldn’t load</h1><p>Check your connection and try again. Your saved records are unchanged.</p><Button onClick={reset}>Try again</Button></div>;}
