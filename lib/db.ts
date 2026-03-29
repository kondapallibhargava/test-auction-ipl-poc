import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only, never exposed to browser
    );
  }
  return _client;
}

// Proxy so all call sites keep using `db.from(...)` unchanged
export const db = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    return getClient()[prop as keyof SupabaseClient];
  },
});
