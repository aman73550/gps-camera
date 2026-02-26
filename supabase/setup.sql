-- GPS Camera Go — Supabase Schema Setup
-- Run this once in your Supabase dashboard → SQL Editor

-- 1. Profiles: one row per authenticated user (identified by phone)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Uploads: every photo upload event
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT,
  serial_number TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  altitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  address TEXT NOT NULL DEFAULT '',
  location_name TEXT NOT NULL DEFAULT '',
  plus_code TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  file_size_kb INTEGER NOT NULL DEFAULT 0,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-user upload count queries
CREATE INDEX IF NOT EXISTS idx_uploads_user_phone ON uploads(user_phone);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_uploads_is_guest ON uploads(is_guest);

-- 3. App settings: global config (single row, id=1)
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  delete_after_months INTEGER NOT NULL DEFAULT 0,
  auto_delete_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings row
INSERT INTO app_settings (id, delete_after_months, auto_delete_enabled)
VALUES (1, 0, FALSE)
ON CONFLICT (id) DO NOTHING;
