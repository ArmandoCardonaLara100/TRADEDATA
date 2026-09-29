import {NextResponse, type NextRequest} from 'next/server';
import {supabaseServer} from '@/lib/supabase/server';
import {ensureProfile} from '@/lib/supabase/profile';
import {appUrl} from '@/lib/server/app-url';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const failure = request.nextUrl.searchParams.get('flow') === 'google' ? 'oauth' : 'confirmation';
  const redirectUrl = (path: string) => new URL(path,appUrl());
  if (code) {
    const client = await supabaseServer();
    const {data,error} = await client.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try { await ensureProfile(client,data.user); }
      catch { return NextResponse.redirect(redirectUrl(`/login?authError=${failure}`)); }
      return NextResponse.redirect(redirectUrl('/dashboard'));
    }
  }
  return NextResponse.redirect(redirectUrl(`/login?authError=${failure}`));
}
