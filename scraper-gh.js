const axios = require('axios');
const fs = require('fs');
const path = require('path');

const URL = 'https://onlineislemler.egm.gov.tr/trafik/sayfalar/edsharita.aspx';
const OUTPUT_FILE = path.join(__dirname, 'RadarApp', 'assets', 'eds_markers.json');

async function scrape() {
  console.log('EGM Verileri Çekiliyor...');
  try {
    const response = await axios.get(URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 30000,
    });

    const html = response.data;
    const markersRegex = /var markers = (\[[\s\S]*?\]);/;
    const match = html.match(markersRegex);

    if (!match) throw new Error('Veri yok');

    let markersStr = match[1];
    let markers = [];
    const itemRegex = /{\s*"Aciklama":\s*'(.*?)',\s*"lat":\s*'(.*?)',\s*"lng":\s*'(.*?)'\s*}/gs;
    
    let m;
    while ((m = itemRegex.exec(markersStr)) !== null) {
      markers.push({ Aciklama: m[1].replace(/\\'/g, "'").trim(), lat: m[2], lng: m[3] });
    }

    // 🔥 İşte istediğin "Ne zaman kazındığı" verisi!
    const result = {
      updatedAt: new Date().toISOString(),
      count: markers.length,
      markers: markers
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`Bitti! ${markers.length} adet radar kazıldı. Saat: ${result.updatedAt}`);
  } catch (e) {
    console.error('Hata:', e.message);
    process.exit(1);
  }
}
scrape();
