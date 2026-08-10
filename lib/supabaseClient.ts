import { createClient } from "@supabase/supabase-js";

// Used for exactly two things per CLAUDE.md: holding/refreshing the session
// handed back by the backend's login response, and subscribing to Realtime
// location updates. Never call `.from(...)` on this for app data -- that
// goes through the NestJS backend (see lib/api.ts).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
