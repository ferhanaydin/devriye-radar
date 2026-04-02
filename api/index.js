const axios = require('axios');

export default async function handler(req, res) {
  // CORS ayarları (Mobil uygulamanın bağlanabilmesi için)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const URL = 'https://onlineislemler.egm.gov.tr/trafik/sayfalar/edsharita.aspx';

  try {
    const response = await axios.get(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 15000,
    });

    const html = response.data;
    const markersRegex = /var markers = (\[[\s\S]*?\]);/;
    const match = html.match(markersRegex);

    if (!match || match.length < 2) {
      throw new Error('EGM verisi okunamadı.');
    }

    let markersStr = match[1];
    let sanitizedData = [];
    const itemRegex = /{\s*"Aciklama":\s*'(.*?)',\s*"lat":\s*'(.*?)',\s*"lng":\s*'(.*?)'\s*}/gs;
    
    let m;
    while ((m = itemRegex.exec(markersStr)) !== null) {
      sanitizedData.push({
        Aciklama: m[1].replace(/\\'/g, "'").trim(),
        lat: m[2],
        lng: m[3]
      });
    }

    // Başarılı cevap
    return res.status(200).json(sanitizedData);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
