const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 3000;
const JSON_FILE = path.join(__dirname, 'eds_markers.json');

// ─── eds_markers.json dosyasını static olarak sun ─────────────────────────
app.use(express.static(__dirname));

// ─── Scraper çalıştır ────────────────────────────────────────────────────────
function runScraper() {
  console.log(`[${new Date().toLocaleTimeString('tr-TR')}] EGM verileri güncelleniyor...`);
  exec('node scraper.js', { cwd: __dirname }, (err, stdout) => {
    if (err) {
      console.error('❌ Scraper hatası:', err.message);
      return;
    }
    console.log(stdout.trim());
  });
}

// ─── Sunucu başlarken hemen veriyi çek ────────────────────────────────────
runScraper();

// ─── 15 dakikada bir otomatik güncelle ────────────────────────────────────
const INTERVAL_MS = 15 * 60 * 1000; // 15 dakika
setInterval(runScraper, INTERVAL_MS);

// ─── Ne zaman güncellendiğini bildiren endpoint ───────────────────────────
app.get('/status', (req, res) => {
  const exists = fs.existsSync(JSON_FILE);
  if (!exists) return res.json({ ready: false, count: 0, updatedAt: null });

  const stat = fs.statSync(JSON_FILE);
  const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  res.json({
    ready: true,
    count: data.length,
    updatedAt: stat.mtime,
    nextUpdate: new Date(stat.mtime.getTime() + INTERVAL_MS),
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Sunucu çalışıyor: http://localhost:${PORT}`);
  console.log(`📦 JSON dosyası  : http://localhost:${PORT}/eds_markers.json`);
  console.log(`📊 Durum         : http://localhost:${PORT}/status`);
  console.log(`🕒 Güncelleme    : Her 15 dakikada bir\n`);
});
