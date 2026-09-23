import Link from 'next/link';
export default function NotFound(){return <main className="empty-state"><h1>This page isn’t here</h1><p>Return to your workspace to continue.</p><Link href="/dashboard" className="button primary">Open overview</Link></main>;}
