const axios = require('axios');
const URL = 'https://onlineislemler.egm.gov.tr/trafik/sayfalar/edsharita.aspx';

async function test() {
  try {
    const res = await axios.get(URL);
    const html = res.data;
    const startIdx = html.indexOf('var markers = [');
    if (startIdx === -1) {
      console.log('Not found');
      return;
    }
    console.log(html.substring(startIdx, startIdx + 500));
  } catch (e) {
    console.error(e.message);
  }
}
test();
