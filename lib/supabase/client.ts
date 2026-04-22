import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/database.types';
import { SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient<Database> | undefined


export function createClient() {
    if (!client) {
      client = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );
    }
    return client;
}