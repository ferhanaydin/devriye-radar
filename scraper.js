const axios = require('axios');
const fs = require('fs');
const path = require('path');

const URL = 'https://onlineislemler.egm.gov.tr/trafik/sayfalar/edsharita.aspx';
// Direkt olarak RadarApp/assets/ klasörüne yaz (kopyalama adımı yok)
const OUTPUT_FILE = path.join(__dirname, 'RadarApp', 'assets', 'eds_markers.json');

async function scrapeMarkers() {
  console.log(`[${new Date().toLocaleString()}] EGM verileri çekiliyor: ${URL}...`);
  
  try {
    const response = await axios.get(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      },
      timeout: 10000,
    });

    const html = response.data;
    
    // Regex: var markers = [ ... ]; bloğunu yakala
    const markersRegex = /var markers = (\[[\s\S]*?\]);/;
    const match = html.match(markersRegex);

    if (!match || match.length < 2) {
      throw new Error('Markers verisi sayfa kaynağında bulunamadı!');
    }

    // JS array string'ini temizleyip JSON formatına uygun hale getirelim (bazı siteler 'lat' yerine lat kullanabiliyor)
    // Neyse ki EGM doğrudan JSON-like formatında vermiş.
    let markersStr = match[1];
    
    // JS objesini güvenli bir şekilde değerlendirmek için eval yerine JSON.parse kullanmaya çalışalım.
    // markersStr içindeki tek tırnakları çift tırnağa çevirelim (basit bir replacer)
    // Dikkat: Nesne anahtarları tırnaksızsa JSON.parse hata verir. Bu yüzden eval-like bir yaklaşım gerekebilir ama biz temizleyelim.
    
    // JSON.parse için anahtarları ve değerleri çift tırnağa çekelim (Eğer EGM sayfasında "lat": "41.1" gibiyse zaten tamamdır)
    // EGM formatı: { "Aciklama": '...', "lat": '...', "lng": '...' }
    // Tek tırnakları çift tırnağa çevireceğiz.
    
    let sanitizedData = [];
    const itemRegex = /{\s*"Aciklama":\s*'(.*?)',\s*"lat":\s*'(.*?)',\s*"lng":\s*'(.*?)'\s*}/gs;
    let m;
    while ((m = itemRegex.exec(markersStr)) !== null) {
      sanitizedData.push({
        Aciklama: m[1].replace(/\\'/g, "'").trim(), // Handle potential escaped quotes
        lat: m[2],
        lng: m[3]
      });
    }

    if (sanitizedData.length === 0) {
      // Bir de alternatif regex deneyelim (belki tırnaklar farklıdır)
      const altRegex = /Aciklama:\s*'(.*?)',[\s\S]*?lat:\s*'(.*?)',[\s\S]*?lng:\s*'(.*?)'/g;
      while ((m = altRegex.exec(markersStr)) !== null) {
        sanitizedData.push({
          Aciklama: m[1].trim(),
          lat: m[2],
          lng: m[3]
        });
      }
    }

    if (sanitizedData.length === 0) {
      throw new Error('Hiçbir marker verisi ayrıştırılamadı!');
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sanitizedData, null, 2));
    console.log(`✅ İşlem Başarılı! ${sanitizedData.length} adet marker kaydedildi: ${OUTPUT_FILE}`);
    return sanitizedData;

  } catch (error) {
    console.error(`❌ Hata Oluştu: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
    }
  }
}

// Hemen çalıştır
scrapeMarkers();

// İstersen 15 dakikada bir otomatik çalışması için:
// setInterval(scrapeMarkers, 15 * 60 * 1000);
