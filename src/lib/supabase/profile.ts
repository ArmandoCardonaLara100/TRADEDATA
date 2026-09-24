import type {SupabaseClient, User} from '@supabase/supabase-js';
import type {Database} from './database';
export async function ensureProfile(client: SupabaseClient<Database>, user: User) {
  const name = String(user.user_metadata?.name || user.email?.split('@')[0] || 'Trader').slice(0, 80);
  const {error} = await client.from('profiles').upsert({id:user.id, name}, {onConflict:'id', ignoreDuplicates:true});
  if (error) throw new Error('Could not initialize your profile. Please sign in again.');
}
