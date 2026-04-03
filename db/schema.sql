-- ============================================================
-- Devriye — Neon PostgreSQL Kurulum Scripti
-- Neon Console → SQL Editor'a yapıştır ve çalıştır
-- ============================================================

-- 1. Gerekli Extension'lar (Mesafe hesabı için)
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- 2. Topluluk Radarları Tablosu
CREATE TABLE IF NOT EXISTS community_radars (
  id        SERIAL PRIMARY KEY,
  lat       FLOAT NOT NULL,
  lng       FLOAT NOT NULL,
  votes     INT DEFAULT 1,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes'
);

-- 3. Süresi bitenleri hızlı silmek için index
CREATE INDEX IF NOT EXISTS idx_expires ON community_radars(expires_at);
