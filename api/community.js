import { neon } from '@neondatabase/serverless';

// GET  → Aktif topluluk radarlarını getir
// POST → Yeni topluluk radarı bildir
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  // ── GET: Aktif radarları getir ────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      // Süresi dolmuşları temizle, aktif olanları getir
      await sql`DELETE FROM community_radars WHERE expires_at < NOW()`;
      const radars = await sql`
        SELECT id, lat, lng, reported_at, expires_at, votes
        FROM community_radars
        WHERE expires_at > NOW()
        ORDER BY reported_at DESC
      `;
      return res.status(200).json({ radars });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: Yeni radar bildir ───────────────────────────────────────────────
  if (req.method === 'POST') {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat ve lng zorunlu.' });

    try {
      // Yakında (100m içinde) zaten bir bildirim var mı?
      const nearby = await sql`
        SELECT id, votes FROM community_radars
        WHERE expires_at > NOW()
          AND earth_distance(
            ll_to_earth(lat, lng),
            ll_to_earth(${lat}, ${lng})
          ) < 150
        LIMIT 1
      `;

      if (nearby.length > 0) {
        // Varsa oy sayısını artır ve süresini uzat
        await sql`
          UPDATE community_radars
          SET votes = votes + 1,
              expires_at = GREATEST(expires_at, NOW() + INTERVAL '20 minutes')
          WHERE id = ${nearby[0].id}
        `;
        return res.status(200).json({ status: 'updated', id: nearby[0].id });
      }

      // Yoksa yeni kayıt oluştur
      const result = await sql`
        INSERT INTO community_radars (lat, lng)
        VALUES (${lat}, ${lng})
        RETURNING id
      `;
      return res.status(201).json({ status: 'created', id: result[0].id });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
