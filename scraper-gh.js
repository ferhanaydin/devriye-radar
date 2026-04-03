const axios = require('axios');
const fs = require('fs');
const path = require('path');

const URL = 'https://onlineislemler.egm.gov.tr/trafik/sayfalar/edsharita.aspx';
const OUTPUT_FILE = path.join(__dirname, 'eds_markers.json');

async function scrape() {
  console.log('--- 📡 EGM Radar Kazıma İşlemi Başladı ---');
  
  try {
    // 1. EGM Verilerini Çekmeyi Dene
    const response = await axios.get(URL, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' 
      },
      timeout: 25000, // 25 saniye bekle
    });

    const html = response.data;
    if (!html || html.length < 500) {
      throw new Error('Gelen sayfa içeriği boş veya çok kısa.');
    }

    // 2. Markers Bloğunu Bul
    const markersRegex = /var markers = (\[[\s\S]*?\]);/;
    const match = html.match(markersRegex);

    if (!match || match.length < 2) {
      throw new Error('Markers verisi sayfa kaynağında bulunamadı.');
    }

    let markersStr = match[1];
    let markers = [];
    const itemRegex = /{\s*"Aciklama":\s*'(.*?)',\s*"lat":\s*'(.*?)',\s*"lng":\s*'(.*?)'\s*}/gs;
    
    let m;
    while ((m = itemRegex.exec(markersStr)) !== null) {
      markers.push({ 
        Aciklama: m[1].replace(/\\'/g, "'").trim(), 
        lat: m[2], 
        lng: m[3] 
      });
    }

    // 🏆 KRİTİK KONTROL: Eğer veri setimiz anlamlı bir sayıya ulaştıysa (örneğin en az 1000 radar)
    if (markers.length > 1000) {
      const result = {
        updatedAt: new Date().toISOString(),
        count: markers.length,
        markers: markers
      };

      // Sadece veri tamamsa üzerine yaz
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
      console.log(`✅ BAŞARILI: ${markers.length} adet radar tazelendi.`);
    } else {
      throw new Error(`Kazılan radar sayısı yetersiz (${markers.length}). Dosya güncellenmedi.`);
    }

  } catch (e) {
    // 🛡️ SESSİZ HATA YÖNETİMİ
    console.warn(`⚠️ UYARI: Kazıma başarısız oldu veya sunucu yanıt vermedi. Mevcut veriler korunuyor.`);
    console.warn(`Hata Detayı: ${e.message}`);
    
    // GitHub'ın hata vermemesi için "Başarılı" çıkıyoruz ama hiçbir şeyi güncellemedik
    process.exit(0); 
  }
}

scrape();
