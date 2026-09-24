import {NextResponse, type NextRequest} from 'next/server';
import {supabaseServer} from '@/lib/supabase/server';
import {ensureProfile} from '@/lib/supabase/profile';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const client = await supabaseServer();
    const {data,error} = await client.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try { await ensureProfile(client,data.user); }
      catch { return NextResponse.redirect(new URL('/login?confirmation=failed',request.url)); }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
  return NextResponse.redirect(new URL('/login?confirmation=failed', request.url));
}
