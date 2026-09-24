import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {supabaseConfig} from './config';
import type {Database} from './database';

export async function supabaseServer() {
  const store = await cookies();
  const {url, key} = supabaseConfig();
  return createServerClient<Database>(url, key, {cookies: {
    getAll: () => store.getAll(),
    setAll(values) {
      // Server Components cannot write cookies. Proxy refreshes before rendering.
      try { values.forEach(({name, value, options}) => store.set(name, value, options)); }
      catch { /* Cookie writes are performed by proxy or route handlers. */ }
    },
  }});
}
