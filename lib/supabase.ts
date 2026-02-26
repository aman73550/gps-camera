import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: Platform.OS !== "web" ? AsyncStorage : undefined,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
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

export interface VersionCheckResult {
  requiredVersion: string | null;
  forceUpdate: boolean;
}

export async function checkRequiredVersion(): Promise<VersionCheckResult> {
  if (!supabase) return { requiredVersion: null, forceUpdate: false };
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("required_version, force_update")
      .eq("id", 1)
      .single();
    const row = data as { required_version?: string; force_update?: boolean } | null;
    return {
      requiredVersion: row?.required_version ?? null,
      forceUpdate: row?.force_update ?? false,
    };
  } catch {
    return { requiredVersion: null, forceUpdate: false };
  }
}
