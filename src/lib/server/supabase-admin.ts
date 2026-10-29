import 'server-only';

import {createClient} from '@supabase/supabase-js';

import type {Database} from '@/lib/supabase/database';

/** Elevated access is confined to trusted server code with its own authorization. */
export function supabaseAdmin() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY for secure server access.');
 return createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
