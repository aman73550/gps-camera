import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export interface AppSettings {
  id: number;
  delete_after_months: number;
  auto_delete_enabled: boolean;
  required_version?: string;
  force_update?: boolean;
  updated_at?: string;
  guest_limit?: number;
  standard_daily_limit?: number;
  standard_monthly_limit?: number;
}

export async function getUserTier(
  phone: string,
): Promise<"standard" | "pro"> {
  if (!supabase) return "standard";
  const { data } = await supabase
    .from("profiles")
    .select("tier")
    .eq("phone", phone)
    .single();
  return (data?.tier as "standard" | "pro") || "standard";
}

export async function checkUploadLimit(
  phone: string | null,
  isGuest: boolean,
): Promise<{ allowed: boolean; reason?: string; tier?: string }> {
  if (!supabase) return { allowed: true };

  const settings = await getAppSettings();
  const guestLimit = settings.guest_limit ?? 20;
  const dailyLimit = settings.standard_daily_limit ?? 50;
  const monthlyLimit = settings.standard_monthly_limit ?? 1000;

  if (isGuest || !phone) {
    const { count } = await supabase
      .from("uploads")
      .select("*", { count: "exact", head: true })
      .is("user_phone", null);
    if ((count || 0) >= guestLimit) {
      return { allowed: false, reason: "GUEST_LIMIT", tier: "guest" };
    }
    return { allowed: true, tier: "guest" };
  }

  const tier = await getUserTier(phone);
  if (tier === "pro") return { allowed: true, tier: "pro" };

  const now = new Date();
  const dayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ count: dailyCount }, { count: monthlyCount }] = await Promise.all([
    supabase
      .from("uploads")
      .select("*", { count: "exact", head: true })
      .eq("user_phone", phone)
      .gte("created_at", dayStart),
    supabase
      .from("uploads")
      .select("*", { count: "exact", head: true })
      .eq("user_phone", phone)
      .gte("created_at", monthStart),
  ]);

  if ((dailyCount || 0) >= dailyLimit) {
    return { allowed: false, reason: "DAILY_LIMIT", tier };
  }
  if ((monthlyCount || 0) >= monthlyLimit) {
    return { allowed: false, reason: "MONTHLY_LIMIT", tier };
  }
  return { allowed: true, tier };
}

export interface UploadRecord {
  user_phone: string | null;
  serial_number: string;
  latitude: number;
  longitude: number;
  altitude: number;
  address: string;
  location_name: string;
  plus_code: string;
  file_path: string;
  file_size_kb: number;
  is_guest: boolean;
}

export async function recordUpload(data: UploadRecord): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("uploads").insert(data);
  if (error) console.error("Supabase recordUpload error:", error.message);
}

export async function recordUploadBatch(records: UploadRecord[]): Promise<void> {
  if (!supabase || records.length === 0) return;
  const { error } = await supabase.from("uploads").insert(records);
  if (error) console.error("Supabase recordUploadBatch error:", error.message);
}

export async function upsertProfile(phone: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("profiles")
    .upsert({ phone }, { onConflict: "phone", ignoreDuplicates: true });
  if (error) console.error("Supabase upsertProfile error:", error.message);
}

export async function getAppSettings(): Promise<AppSettings> {
  if (!supabase)
    return { id: 1, delete_after_months: 0, auto_delete_enabled: false };
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) return { id: 1, delete_after_months: 0, auto_delete_enabled: false };
  return data as AppSettings;
}

export async function updateAppSettings(
  settings: Partial<AppSettings>,
): Promise<void> {
  if (!supabase) return;
  await supabase.from("app_settings").upsert({
    id: 1,
    ...settings,
    updated_at: new Date().toISOString(),
  });
}

export async function runAutoCleanup(): Promise<number> {
  if (!supabase) return 0;
  const settings = await getAppSettings();
  if (!settings.auto_delete_enabled || settings.delete_after_months === 0)
    return 0;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - settings.delete_after_months);

  const { data: oldRecords } = await supabase
    .from("uploads")
    .select("id")
    .lt("created_at", cutoff.toISOString());

  if (!oldRecords || oldRecords.length === 0) return 0;

  const ids = oldRecords.map((r) => r.id);
  const { error } = await supabase.from("uploads").delete().in("id", ids);
  if (error) {
    console.error("Auto-cleanup error:", error.message);
    return 0;
  }
  return ids.length;
}

export async function requestUploadDelete(
  serialNumber: string,
  requestedBy: string | null,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("uploads")
    .update({
      pending_delete: true,
      delete_requested_at: new Date().toISOString(),
      delete_requested_by: requestedBy || "user",
    })
    .eq("serial_number", serialNumber);
  if (error) { console.error("requestUploadDelete error:", error.message); return false; }
  return true;
}

export async function getPendingDeletions(
  page: number,
  limit: number,
): Promise<{ data: any[]; total: number }> {
  if (!supabase) return { data: [], total: 0 };
  const offset = (page - 1) * limit;
  const { data, count } = await supabase
    .from("uploads")
    .select("*", { count: "exact" })
    .eq("pending_delete", true)
    .order("delete_requested_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return { data: data || [], total: count || 0 };
}

export async function confirmUploadDeletion(
  serialNumber: string,
  uploadsDir: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase
    .from("uploads")
    .select("file_path")
    .eq("serial_number", serialNumber)
    .single();
  if (data?.file_path) {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join(uploadsDir, data.file_path);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
  }
  const { error } = await supabase
    .from("uploads")
    .delete()
    .eq("serial_number", serialNumber);
  if (error) { console.error("confirmUploadDeletion error:", error.message); return false; }
  return true;
}

export async function rejectUploadDeletion(serialNumber: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("uploads")
    .update({ pending_delete: false, delete_requested_at: null, delete_requested_by: null })
    .eq("serial_number", serialNumber);
  if (error) { console.error("rejectUploadDeletion error:", error.message); return false; }
  return true;
}

export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabase) {
    console.log("ℹ️  Supabase not configured (no SUPABASE_URL/SUPABASE_ANON_KEY)");
    return false;
  }
  const { error } = await supabase.from("uploads").select("id").limit(1);
  if (error) {
    if (error.code === "42P01") {
      console.error(
        "\n⚠️  Supabase tables not found.\n   Run supabase/setup.sql in your Supabase dashboard → SQL Editor\n",
      );
    } else {
      console.error("Supabase connection error:", error.message);
    }
    return false;
  }
  console.log("✓ Supabase connected");
  return true;
}
