/**
 * Realtime "changed" signals for display and host screens. Never imported by
 * participant routes (supabase-js stays out of their bundle).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

/**
 * Subscribes to a public broadcast channel and calls `onSignal` for each
 * `event` message. `onStatus` reports SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT /
 * CLOSED; callers refetch on SUBSCRIBED to cover messages missed while
 * reconnecting. Returns an unsubscribe function.
 */
export function subscribeToSignal(
  topic: string,
  event: string,
  onSignal: () => void,
  onStatus?: (status: string) => void,
): () => void {
  const supabase = getClient();
  const channel = supabase
    .channel(topic, { config: { private: false } })
    .on("broadcast", { event }, () => onSignal())
    .subscribe((status) => onStatus?.(status));
  return () => {
    void supabase.removeChannel(channel);
  };
}
