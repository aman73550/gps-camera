import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export async function syncUserProfile(phone: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from("profiles")
      .upsert({ phone }, { onConflict: "phone", ignoreDuplicates: true });
  } catch {}
}

export async function getUserTier(
  phone: string,
): Promise<"standard" | "pro"> {
  if (!supabase) return "standard";
  try {
    const { data } = await supabase
      .from("profiles")
      .select("tier")
      .eq("phone", phone)
      .single();
    return (data?.tier as "standard" | "pro") || "standard";
  } catch {
    return "standard";
  }
}
