const axios = require('axios');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const URL = 'https://onlineislemler.egm.gov.tr/trafik/sayfalar/edsharita.aspx';

  try {
    // ⚡ Axios Timeout'u 8 saniyeye çekelim ki Vercel (10sn) bizi kesmeden biz hata yönetelim.
    const response = await axios.get(URL, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' 
      },
      timeout: 8000, 
    });

    const html = response.data;
    
    // 🏎️ Daha hızlı regex: Sadece markers bloğunu al
    const startIdx = html.indexOf('var markers = [');
    if (startIdx === -1) throw new Error('Markers bloğu bulunamadı.');
    
    const endIdx = html.indexOf('];', startIdx);
    const markersStr = html.substring(startIdx + 14, endIdx + 1);

    let sanitizedData = [];
    // EGM'nin garip formatını hızlıca parse et
    const itemRegex = /{\s*"Aciklama":\s*'(.*?)',\s*"lat":\s*'(.*?)',\s*"lng":\s*'(.*?)'\s*}/gs;
    
    let m;
    while ((m = itemRegex.exec(markersStr)) !== null) {
      sanitizedData.push({
        Aciklama: m[1].replace(/\\'/g, "'").trim(),
        lat: m[2],
        lng: m[3]
      });
    }

    if (sanitizedData.length === 0) throw new Error('Veri ayrıştırılamadı.');

    return res.status(200).json({
      source: 'cloud',
      updatedAt: new Date().toISOString(),
      count: sanitizedData.length,
      markers: sanitizedData
    });

  } catch (error) {
    console.error('API Error:', error.message);
    return res.status(500).json({ 
      error: 'EGM sunucusu yanıt vermiyor veya çok yavaş. Lütfen biraz sonra tekrar deneyin.',
      details: error.message 
    });
  }
}
