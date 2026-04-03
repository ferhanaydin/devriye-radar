# 📡 Devriye — EDS Radar Sürüş Asistanı

> Türkiye'deki tüm EGM EDS radar noktalarını gerçek zamanlı gösteren, Türkçe sesli uyarılı premium sürüş asistanı.

---

## 🚀 Özellikler

| Özellik | Detay |
|---|---|
| 📍 **1500+ EDS Noktası** | EGM'den otomatik çekilen güncel veriler |
| 🔊 **Kademeli Türkçe Sesli Uyarı** | 1km → 500m → 200m'de farklı anonslar |
| ⚡ **Gerçek Zamanlı Hız Göstergesi** | GPS tabanlı, renge göre değişen gösterge |
| 🗺️ **Rota Radar Analizi** | Gideceğin yolu gir, kaç radar olduğunu gör |
| 🔔 **Push Bildirim** | Uygulama arka plandayken de uyarı |
| 📳 **Titreşim Desteği** | Sessiz modda bile çalışır |
| 📴 **Offline Mod** | İnternetsiz de çalışır |
| 🌙 **Premium Karanlık Tema** | Gece sürüşlerine özel glassmorphism tasarım |
| ⚙️ **Özelleştirilebilir Ayarlar** | Uyarı mesafesi, ses, titreşim, sesli anons |

---

## 📁 Proje Yapısı

```
devriye-radar/
├── RadarApp/               # Expo / React Native Mobil Uygulama
│   ├── App.js              # Ana uygulama (Harita, uyarı, rota mantığı)
│   ├── SettingsScreen.js   # Ayarlar ekranı
│   ├── storage.js          # AsyncStorage ile kalıcı ayarlar
│   ├── eas.json            # Expo Application Services build config
│   ├── app.json            # Expo uygulama yapılandırması
│   └── assets/             # İkon, splash, ses ve radar verileri
│       └── eds_markers.json  # Offline yedek radar verisi
│
├── api/                    # Vercel Serverless API
│   └── index.js            # EGM kazıma API'si
│
├── .github/
│   └── workflows/
│       └── scrape.yml      # GitHub Actions otomatik veri güncelleme (20dk)
│
├── docs/                   # GitHub Pages yasal belgeler
│   ├── index.html          # Landing page
│   ├── privacy.html        # Gizlilik Politikası
│   └── terms.html          # Kullanım Şartları
│
├── scraper-gh.js           # GitHub Actions için EGM kazıyıcı
├── scraper.js              # Yerel geliştirme kazıyıcısı
├── server.js               # Yerel geliştirme sunucusu
├── eds_markers.json        # Bulut veri dosyası (otomatik güncellenir)
└── vercel.json             # Vercel yapılandırması
```

---

## ⚙️ Sistem Mimarisi

```
GitHub Actions (Her 20 dk)
        │
        ▼
scraper-gh.js → EGM sitesini kazır
        │
        ▼
eds_markers.json güncellenir (GitHub'a push)
        │
        ▼
Vercel bu dosyayı statik olarak sunar
        │
        ▼
Mobil Uygulama → İnternet varsa Vercel'den çeker
              → İnternet yoksa assets/eds_markers.json'dan okur (Offline)
```

---

## 🛠️ Kurulum & Geliştirme

### Gereksinimler
- Node.js 18+
- Expo Go (iOS/Android test için)

### Mobil Uygulamayı Başlat

```bash
cd RadarApp
npm install
npx expo start
```

### Yerel Sunucuyu Başlat (Veri güncelleyici)

```bash
npm install          # Ana dizinde
node server.js       # Her 15 dakikada bir veri günceller
```

---

## 📦 Yayınlama (EAS Build)

```bash
cd RadarApp
npm install -g eas-cli
eas login

# Android APK (İç test için)
eas build --platform android --profile preview

# Android AAB (Play Store için)
eas build --platform android --profile production

# iOS (App Store için)
eas build --platform ios --profile production
```

---

## 📜 Yasal Belgeler

- [Gizlilik Politikası](https://ferhanaydin.github.io/devriye-radar/privacy.html)
- [Kullanım Şartları](https://ferhanaydin.github.io/devriye-radar/terms.html)

---

## 🏗️ Kullanılan Teknolojiler

| Teknoloji | Kullanım |
|---|---|
| React Native / Expo | Mobil uygulama çatısı |
| react-native-maps | Harita bileşeni |
| expo-location | GPS ve konum takibi |
| expo-speech | Türkçe sesli uyarı |
| expo-notifications | Push bildirim |
| expo-haptics | Titreşim |
| expo-keep-awake | Ekranı açık tut |
| @mapbox/polyline | Rota çizgisi çözücü |
| OSRM | Ücretsiz rota motoru |
| Vercel | Statik JSON hosting |
| GitHub Actions | Otomatik veri güncelleme |
| AsyncStorage | Yerel ayar & istatistik saklama |

---

## 📊 Veri Kaynağı

Radar verileri **T.C. Emniyet Genel Müdürlüğü (EGM)**'nin kamuya açık EDS harita sayfasından otomatik olarak çekilmektedir:
- Kaynak: `onlineislemler.egm.gov.tr`
- Güncelleme Sıklığı: Her 20 dakikada bir

---

## ⚠️ Yasal Uyarı

Bu uygulama trafik güvenliğini desteklemeyi ve hız kurallarına uyulmasını teşvik etmeyi amaçlar. Hız sınırlarını aşmaya teşvik etmez. Tüm sürüş sorumluluğu kullanıcıya aittir.

---

## 📩 İletişim

**destek@devriye.app**
