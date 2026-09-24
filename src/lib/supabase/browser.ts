'use client';
import {createBrowserClient} from '@supabase/ssr';
import {supabaseConfig} from './config';
import type {Database} from './database';
export function supabaseBrowser() {
  const {url, key} = supabaseConfig();
  return createBrowserClient<Database>(url, key);
}
