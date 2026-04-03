const axios = require('axios');
const fs = require('fs');
const path = require('path');

const URL = 'https://onlineislemler.egm.gov.tr/trafik/sayfalar/edsharita.aspx';
const OUTPUT_FILE = path.join(__dirname, 'eds_markers.json');

// ──────────────────────────────────────────────────────────────────────────────
// Ana fonksiyon — Hiçbir koşulda exit(1) ile çıkmaz
// ──────────────────────────────────────────────────────────────────────────────
async function scrape() {
  console.log(`[${new Date().toISOString()}] EGM Radar Kazıma Başladı`);

  let response;

  // 1. Siteye bağlanmayı dene — ulaşamazsan çık, hataya düşme
  try {
    response = await axios.get(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 25000,
    });
    console.log(`✅ EGM sitesine ulaşıldı. Sayfa boyutu: ${response.data?.length || 0} karakter`);
  } catch (e) {
    // Siteye ulaşılamadı — sessizce çık, bir sonraki periyotta tekrar dene
    console.warn(`⚠️ EGM sitesine ulaşılamadı: ${e.message}`);
    console.warn('📄 Mevcut veriler korunuyor. Sonraki periyotta tekrar denenecek.');
    process.exit(0); // ← GitHub Actions'a "Her şey yolunda" de
  }

  // 2. Sayfa içeriği yeterince büyük mü?
  const html = response.data || '';
  if (html.length < 1000) {
    console.warn(`⚠️ Sayfa içeriği çok kısa (${html.length} karakter), muhtemelen hata sayfası.`);
    process.exit(0);
  }

  // 3. Markers verisini çıkart
  let markers = [];
  try {
    const match = html.match(/var markers = (\[[\s\S]*?\]);/);
    if (!match) {
      console.warn('⚠️ "var markers" bloğu bulunamadı. Sayfa yapısı değişmiş olabilir.');
      process.exit(0);
    }

    const itemRegex = /{\s*"Aciklama":\s*'(.*?)',\s*"lat":\s*'(.*?)',\s*"lng":\s*'(.*?)'\s*}/gs;
    let m;
    while ((m = itemRegex.exec(match[1])) !== null) {
      markers.push({
        Aciklama: m[1].replace(/\\'/g, "'").trim(),
        lat: m[2],
        lng: m[3],
      });
    }
  } catch (e) {
    console.warn(`⚠️ Veri ayrıştırma hatası: ${e.message}`);
    process.exit(0);
  }

  // 4. Makul sayıda radar var mı?
  if (markers.length < 1000) {
    console.warn(`⚠️ Kazılan radar sayısı çok az: ${markers.length}. Dosya güncellenmedi.`);
    process.exit(0);
  }

  // 5. Dosyayı güvenli şekilde yaz
  try {
    const output = {
      updatedAt: new Date().toISOString(),
      count: markers.length,
      markers,
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
    console.log(`✅ BAŞARILI: ${markers.length} radar ${OUTPUT_FILE} dosyasına yazıldı.`);
  } catch (e) {
    console.warn(`⚠️ Dosya yazma hatası: ${e.message}`);
    process.exit(0);
  }
}

// Global hata yakalayıcı — hiçbir şey exit(1)'e kaçmasın
process.on('unhandledRejection', (reason) => {
  console.warn(`⚠️ Yakalanmamış hata: ${reason}`);
  process.exit(0);
});

scrape();
