-- Neon PostgreSQL'de bu SQL'i çalıştır
-- Topluluk Radarları Tablosu

CREATE TABLE IF NOT EXISTS community_radars (
  id SERIAL PRIMARY KEY,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes',
  votes INT DEFAULT 1
);

-- Süresi dolmuş radarları temizlemek için index
CREATE INDEX IF NOT EXISTS idx_expires_at ON community_radars(expires_at);

-- Test verisi (opsiyonel)
-- INSERT INTO community_radars (lat, lng) VALUES (41.015137, 28.979530);
