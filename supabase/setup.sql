-- ─────────────────────────────────────────────────────────────
-- Verified GPS Camera — Supabase Schema Setup
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────

-- 1. PROFILES (one row per user identified by phone)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT UNIQUE NOT NULL,
  tier       TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- Moderation columns for profiles (safe to re-run)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS warned      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS warn_message TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS warned_at    TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at    TIMESTAMPTZ;

-- RLS: allow anon key full access (app uses anon key for all ops)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.profiles;
CREATE POLICY "anon_all" ON public.profiles FOR ALL USING (true) WITH CHECK (true);


-- 2. UPLOADS (every photo upload event)
CREATE TABLE IF NOT EXISTS public.uploads (
  id            BIGSERIAL PRIMARY KEY,
  user_phone    TEXT REFERENCES public.profiles(phone) ON DELETE SET NULL,
  serial_number TEXT NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude     DOUBLE PRECISION NOT NULL DEFAULT 0,
  altitude      DOUBLE PRECISION NOT NULL DEFAULT 0,
  address       TEXT NOT NULL DEFAULT '',
  location_name TEXT NOT NULL DEFAULT '',
  plus_code     TEXT NOT NULL DEFAULT '',
  file_path     TEXT NOT NULL DEFAULT '',
  file_size_kb  INTEGER NOT NULL DEFAULT 0,
  is_guest      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploads_user_phone ON public.uploads(user_phone);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON public.uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploads_is_guest   ON public.uploads(is_guest);
CREATE INDEX IF NOT EXISTS idx_uploads_serial     ON public.uploads(serial_number);

-- Soft-delete columns (added later — safe to re-run)
ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS pending_delete       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS delete_requested_at  TIMESTAMPTZ;
ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS delete_requested_by  TEXT;
CREATE INDEX IF NOT EXISTS idx_uploads_pending_delete ON public.uploads(pending_delete) WHERE pending_delete = TRUE;

-- Moderation columns for uploads (safe to re-run)
ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS flagged     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS flag_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_uploads_flagged ON public.uploads(flagged) WHERE flagged = TRUE;

-- Image hash for deduplication during guest-to-account merge (safe to re-run)
ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS image_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_uploads_image_hash ON public.uploads(image_hash) WHERE image_hash IS NOT NULL;

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.uploads;
CREATE POLICY "anon_all" ON public.uploads FOR ALL USING (true) WITH CHECK (true);


-- 3. APP SETTINGS (single row, id = 1)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  delete_after_months INTEGER NOT NULL DEFAULT 0,
  auto_delete_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  required_version    TEXT NOT NULL DEFAULT '1.0.0',
  force_update        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.app_settings;
CREATE POLICY "anon_all" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

-- Upload limit columns (added later — safe to re-run)
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS guest_limit             INTEGER NOT NULL DEFAULT 20;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS standard_daily_limit   INTEGER NOT NULL DEFAULT 50;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS standard_monthly_limit INTEGER NOT NULL DEFAULT 1000;

-- Image compression columns (added later — safe to re-run)
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS image_max_width    INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS image_quality      INTEGER NOT NULL DEFAULT 50;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS image_format       TEXT    NOT NULL DEFAULT 'auto';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS image_max_file_mb  INTEGER NOT NULL DEFAULT 5;

-- Seed default settings
INSERT INTO public.app_settings (id, delete_after_months, auto_delete_enabled, required_version, force_update, guest_limit, standard_daily_limit, standard_monthly_limit)
VALUES (1, 0, FALSE, '1.0.0', FALSE, 20, 50, 1000)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- SUPABASE STORAGE BUCKET (for Vercel deployment)
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────

-- Create the uploads storage bucket (public for reads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  20971520,
  ARRAY['image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public reads from the bucket
DROP POLICY IF EXISTS "uploads_public_read" ON storage.objects;
CREATE POLICY "uploads_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads');

-- Allow server-side uploads (anon key or service role)
DROP POLICY IF EXISTS "uploads_insert" ON storage.objects;
CREATE POLICY "uploads_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'uploads');

-- Allow server-side updates (upsert)
DROP POLICY IF EXISTS "uploads_update" ON storage.objects;
CREATE POLICY "uploads_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'uploads');

-- Allow server-side deletes
DROP POLICY IF EXISTS "uploads_delete" ON storage.objects;
CREATE POLICY "uploads_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'uploads');
