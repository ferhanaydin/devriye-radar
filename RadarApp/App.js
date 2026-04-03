import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, Dimensions,
  TouchableOpacity, StatusBar, Alert, Share,
  Animated, FlatList, Modal, Linking, TextInput, Keyboard
} from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Share2, Navigation, List, Map, RefreshCw,
  ShieldAlert, Radio, Settings, MapPin, ExternalLink, Gauge, Search, X, Route
} from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import polyline from '@mapbox/polyline';

import SettingsScreen from './SettingsScreen';
import { loadSettings, loadStats, incrementWarning, DEFAULT_SETTINGS } from './storage';

const { width, height } = Dimensions.get('window');
const EDS_DATA = require('./assets/eds_markers.json');

// ─── Bildirim Ayarı ──────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Haversine Mesafe (metre) ─────────────────────────────────────────────────
function getDistanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Noktanın Çizgiye Uzaklığı (Basit bir kontrol için - metre bazında)
function isNearPath(point, path, thresholdM = 500) {
  // Rotadaki her noktaya bak (Performans için seyreltilmiş bakılabilir)
  for (let i = 0; i < path.length; i += 2) { // Her 2. noktaya bak (Hız için)
    const dist = getDistanceM(point.lat, point.lng, path[i].latitude, path[i].longitude);
    if (dist <= thresholdM) return true;
  }
  return false;
}

const fmtDist = (m) => m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
const speedColor = (kmh) => kmh < 80 ? '#30D158' : kmh < 100 ? '#FF9500' : '#FF3B30';

const VOICE_MSGS = {
  1000: 'Dikkat! Bir kilometre ileride radar kontrol noktası!',
  500: 'Dikkat! Beş yüz metre ileride radar!',
  200: 'Dikkat! İki yüz metre ileride radar! Hızınızı düşürün!',
  speed: 'Dikkat! Hız fazla ve ileride radar var! Yavaşlayın!',
};

export default function App() {
  const mapRef = useRef(null);
  const alertAnim = useRef(new Animated.Value(0)).current;
  const detailAnim = useRef(new Animated.Value(height)).current;
  const listAnim = useRef(new Animated.Value(height)).current;

  const lastAlertTime = useRef({});
  const alertActiveRef = useRef(false);

  // ─── State ──────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [markers, setMarkers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [nearbyRadars, setNearbyRadars] = useState([]);
  const [nearestRadar, setNearestRadar] = useState(null);
  const [nearestDist, setNearestDist] = useState(null);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [dataSource, setDataSource] = useState('—');
  const [stats, setStats] = useState({ totalWarnings: 0, todayWarnings: 0 });

  // Rota State'leri
  const [destInput, setDestInput] = useState('');
  const [routePath, setRoutePath] = useState(null);
  const [routeRadarsCount, setRouteRadarsCount] = useState(0);
  const [isRouting, setIsRouting] = useState(false);

  // ─── İzinler + İlk Yükleme ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [savedSettings, savedStats] = await Promise.all([loadSettings(), loadStats()]);
      setSettings(savedSettings);
      setStats(savedStats);
      await activateKeepAwakeAsync();

      const { status: ns } = await Notifications.getPermissionsAsync();
      if (ns !== 'granted') await Notifications.requestPermissionsAsync();

      const { status: ls } = await Location.requestForegroundPermissionsAsync();
      if (ls !== 'granted') {
        Alert.alert('İzin Gerekli', 'Konum izni olmadan yakın radarlar hesaplanamaz.');
      } else {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLocation(loc.coords);
        setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }, 1200);
        }, 800);

        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 15, timeInterval: 1500 },
          (newLoc) => {
            setUserLocation(newLoc.coords);
            setCurrentSpeed(newLoc.coords.speed ? Math.max(0, Math.round(newLoc.coords.speed * 3.6)) : 0);
          }
        );
      }
      loadMarkers();
    })();
    return () => deactivateKeepAwake();
  }, []);

  // ─── Veri Yükle ─────────────────────────────────────────────────────────────
  const loadMarkers = useCallback(async () => {
    setIsLoading(true);
    const VERCEL_API_URL = 'https://devriye-radar.vercel.app/eds_markers.json';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(VERCEL_API_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      const result = await res.json();
      const data = result.markers || result;
      if (data && Array.isArray(data) && data.length > 0) {
        setMarkers(data);
        setLastUpdate(result.updatedAt ? new Date(result.updatedAt) : new Date());
        setDataSource('BuluT');
        return;
      }
    } catch (e) {
      const localMarkers = EDS_DATA.markers || EDS_DATA;
      setMarkers(localMarkers);
      setLastUpdate(new Date());
      setDataSource('OfflinE');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── ROTA OLUŞTURMA ─────────────────────────────────────────────────────────
  const searchRoute = async () => {
    if (!destInput || !userLocation) return;
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      // 1. Hedef koordinatlarını al
      const geocode = await Location.geocodeAsync(destInput);
      if (!geocode || geocode.length === 0) {
        Alert.alert('Hata', 'Gidilecek yer bulunamadı.');
        return;
      }
      const { latitude: dLat, longitude: dLng } = geocode[0];

      // 2. OSRM API ile rotayı çek (Ücretsiz)
      const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.longitude},${userLocation.latitude};${dLng},${dLat}?overview=full&geometries=polyline`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) {
        Alert.alert('Hata', 'Yol tarifi oluşturulamadı.');
        return;
      }

      // 3. Polyline'ı çöz
      const points = polyline.decode(data.routes[0].geometry);
      const coords = points.map(point => ({ latitude: point[0], longitude: point[1] }));
      setRoutePath(coords);
      setIsRouting(true);

      // 4. Rota üzerindeki radarları hesapla (Gelecekteki performans için filtreleme)
      const onRoute = markers.filter(m => isNearPath(m, coords));
      setRouteRadarsCount(onRoute.length);

      // Haritayı rotaya sığdır
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 120, right: 50, bottom: 200, left: 50 },
        animated: true,
      });

    } catch (e) {
      Alert.alert('Hata', 'Rota oluşturulurken bir problem oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearRoute = () => {
    setRoutePath(null);
    setIsRouting(false);
    setDestInput('');
    setRouteRadarsCount(0);
    goToMyLocation();
  };

  // ─── Uyarı Kontrolü ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userLocation || markers.length === 0) return;
    const sorted = markers
      .map(m => ({ ...m, dist: getDistanceM(userLocation.latitude, userLocation.longitude, parseFloat(m.lat), parseFloat(m.lng)) }))
      .sort((a, b) => a.dist - b.dist);

    const nearest = sorted[0];
    setNearestRadar(nearest);
    setNearestDist(nearest.dist);
    setNearbyRadars(sorted.slice(0, 8));

    const alertDist = settings.alertDistance;
    const now = Date.now();
    const bands = [200, 500, 1000].filter(b => b <= alertDist || b === 200 || b === 500);

    for (const band of bands) {
      if (nearest.dist <= band) {
        const lastT = lastAlertTime.current[band] || 0;
        if (now - lastT > 45000) {
          lastAlertTime.current[band] = now;
          triggerAlert(nearest, band, currentSpeed > 80 && band <= 500);
          break;
        }
      }
    }

    if (nearest.dist <= alertDist) {
      if (!alertActiveRef.current) {
        alertActiveRef.current = true;
        setIsAlertActive(true);
        Animated.spring(alertAnim, { toValue: 1, useNativeDriver: true, tension: 20, friction: 7 }).start();
      }
    } else {
      if (alertActiveRef.current) {
        alertActiveRef.current = false;
        setIsAlertActive(false);
        Animated.timing(alertAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }
    }
  }, [userLocation, markers, settings.alertDistance, currentSpeed]);

  const triggerAlert = async (radar, band, isSpeedHigh) => {
    const msg = isSpeedHigh ? VOICE_MSGS.speed : (VOICE_MSGS[band] || VOICE_MSGS[500]);
    if (settings.voiceEnabled) Speech.speak(msg, { language: 'tr-TR', rate: 0.95 });
    if (settings.hapticEnabled) Haptics.notificationAsync(band <= 200 ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Warning);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: band <= 200 ? '🚨 RADAR! 200 METRE!' : `⚠️ ${fmtDist(band)} İleride Radar`,
        body: (isSpeedHigh ? '⚡ Hız fazla! ' : '') + radar.Aciklama,
        sound: settings.soundEnabled ? 'default' : null,
      },
      trigger: null,
    });
    setStats(await incrementWarning());
  };

  const openDetail = useCallback((marker) => {
    setSelectedMarker(marker);
    Animated.spring(detailAnim, { toValue: height * 0.52, useNativeDriver: true, tension: 18, friction: 8 }).start();
  }, []);

  const closeDetail = useCallback(() => {
    Animated.timing(detailAnim, { toValue: height, duration: 320, useNativeDriver: true }).start(() => setSelectedMarker(null));
  }, []);

  const goToMyLocation = () => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({
      latitude: userLocation.latitude, longitude: userLocation.longitude,
      latitudeDelta: 0.02, longitudeDelta: 0.02,
    }, 700);
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* HARİTA */}
      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_DEFAULT}
        mapType={isSatellite ? 'satellite' : 'standard'}
        initialRegion={{ latitude: 39.9, longitude: 32.8, latitudeDelta: 8, longitudeDelta: 8 }}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={() => closeDetail()}
      >
        {/* Rota Çizgisi */}
        {routePath && (
          <Polyline
            coordinates={routePath}
            strokeWidth={5}
            strokeColor="#007AFF"
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Radar Noktaları - Rota varsa sadece rota üzerindekiler koyu, diğerleri silik */}
        {markers.map((m, i) => {
          const lat = parseFloat(m.lat);
          const lng = parseFloat(m.lng);
          const isOnRoute = routePath ? isNearPath(m, routePath) : true;

          // Performans için sadece yakındaki veya rota üzerindeki ikonları render et
          if (routePath && !isOnRoute) return null;

          return (
            <Marker key={i} coordinate={{ latitude: lat, longitude: lng }} tracksViewChanges={false} onPress={() => openDetail(m)}>
              <View style={[s.pin, !isOnRoute && { opacity: 0.3 }]}>
                <View style={[s.pinDot, nearestRadar?.Aciklama === m.Aciklama && isAlertActive && s.pinDotAlert]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* LOGO & STAT BAR */}
      <BlurView intensity={88} tint="dark" style={s.header}>
        <View style={s.hRow}>
          <Text style={s.appName}>Devriye</Text>
          <View style={s.hBtns}>
            <TouchableOpacity style={s.hBtn} onPress={() => setShowSettings(true)}><Settings color="#fff" size={18} /></TouchableOpacity>
          </View>
        </View>

        {/* Arama Barı (Yeni!) */}
        <View style={s.searchWrap}>
          <Search color="#777" size={18} style={{ marginLeft: 12 }} />
          <TextInput
            placeholder="Nereye gitmek istersin?"
            placeholderTextColor="#777"
            style={s.searchInput}
            value={destInput}
            onChangeText={setDestInput}
            onSubmitEditing={searchRoute}
            returnKeyType="search"
          />
          {destInput.length > 0 && (
            <TouchableOpacity onPress={clearRoute} style={{ padding: 8 }}>
              <X color="#777" size={18} />
            </TouchableOpacity>
          )}
        </View>

        {isRouting && (
          <View style={s.routeInfo}>
            <Route color="#30D158" size={16} />
            <Text style={s.routeInfoTxt}>Rotada {routeRadarsCount} radar bulundu</Text>
          </View>
        )}
      </BlurView>

      {/* HIZ GÖSTERGESİ */}
      <View style={s.speedWrap}>
        <BlurView intensity={80} tint="dark" style={s.speedCard}>
          <Gauge color={speedColor(currentSpeed)} size={16} style={{ marginBottom: 2 }} />
          <Text style={[s.speedNum, { color: speedColor(currentSpeed) }]}>{currentSpeed}</Text>
          <Text style={s.speedUnit}>km/h</Text>
        </BlurView>
      </View>

      {/* KONTROLLER */}
      <View style={s.controls}>
        <Btn onPress={goToMyLocation}><Navigation color="#007AFF" size={20} /></Btn>
        <Btn onPress={() => setIsSatellite(p => !p)}><Map color={isSatellite ? '#FFD60A' : '#aaa'} size={20} /></Btn>
        <Btn onPress={() => { setShowList(true); Animated.spring(listAnim, { toValue: height * 0.4, useNativeDriver: true }).start(); }}><List color="#fff" size={20} /></Btn>
      </View>

      {/* UYARI KARTI */}
      {isAlertActive && (
        <Animated.View style={[s.alertWrap, { opacity: alertAnim, transform: [{ translateY: alertAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <LinearGradient colors={['rgba(255,59,48,0.15)', 'rgba(255,59,48,0.04)']} style={s.alertGrad}>
            <BlurView intensity={90} tint="dark" style={s.alertCard}>
              <View style={s.alertIcon}><Radio color="#FF3B30" size={24} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.alertTitle}>RADAR TESPİT EDİLDİ</Text>
                <Text style={s.alertDesc} numberOfLines={1}>{nearestRadar?.Aciklama}</Text>
              </View>
              <View style={s.alertDistBox}><Text style={s.alertDistNum}>{fmtDist(nearestDist)}</Text><Text style={s.alertDistLbl}>uzakta</Text></View>
            </BlurView>
          </LinearGradient>
        </Animated.View>
      )}

      {/* RADAR DETAY KARTI */}
      {selectedMarker && (
        <Animated.View style={[s.detailWrap, { transform: [{ translateY: detailAnim }] }]}>
          <BlurView intensity={98} tint="dark" style={s.detailInner}>
            <View style={s.detailHandle} /><View style={s.detailHeader}><View style={s.detailIconBox}><ShieldAlert color="#FF3B30" size={28} /></View><View style={{ flex: 1, marginLeft: 14 }}><Text style={s.detailTitle}>EDS Kontrol Noktası</Text><Text style={s.detailCoord}>{parseFloat(selectedMarker.lat).toFixed(4)}, {parseFloat(selectedMarker.lng).toFixed(4)}</Text></View><TouchableOpacity onPress={closeDetail}><Text style={{ color: '#007AFF', fontSize: 16 }}>Kapat</Text></TouchableOpacity></View>
            <Text style={s.detailDesc}>{selectedMarker.Aciklama}</Text>
            <TouchableOpacity style={s.mapsBtn} onPress={() => Linking.openURL(`https://maps.google.com/?q=${selectedMarker.lat},${selectedMarker.lng}`)}><LinearGradient colors={['#1C1C1E', '#2C2C2E']} style={s.mapsBtnInner}><MapPin color="#007AFF" size={18} /><Text style={s.mapsBtnTxt}>Haritada Aç</Text><ExternalLink color="#666" size={15} /></LinearGradient></TouchableOpacity>
          </BlurView>
        </Animated.View>
      )}

      {/* AYARLAR */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet"><SettingsScreen settings={settings} onSettingsChange={setSettings} onClose={() => setShowSettings(false)} /></Modal>
    </View>
  );
}

function Btn({ children, onPress }) { return <TouchableOpacity style={s.ctrlBtn} onPress={onPress}>{children}</TouchableOpacity>; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  map: { flex: 1 },
  pin: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30', borderWidth: 2, borderColor: '#fff' },
  pinDotAlert: { width: 14, height: 14, borderRadius: 7, shadowOpacity: 1, shadowRadius: 8, shadowColor: '#FF3B30' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 50, paddingHorizontal: 18, paddingBottom: 15, borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  hRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appName: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  hBtns: { flexDirection: 'row', gap: 10 },
  hBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  // Search Bar
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, marginTop: 15, height: 46 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingHorizontal: 10 },
  routeInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(48,209,88,0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 10, gap: 5 },
  routeInfoTxt: { color: '#30D158', fontSize: 12, fontWeight: '600' },

  speedWrap: { position: 'absolute', left: 16, bottom: 48 },
  speedCard: { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  speedNum: { fontSize: 24, fontWeight: '800', lineHeight: 26 },
  speedUnit: { color: '#555', fontSize: 10 },
  controls: { position: 'absolute', right: 16, bottom: 48, gap: 10 },
  ctrlBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(20,20,20,0.88)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  alertWrap: { position: 'absolute', bottom: 140, left: 14, right: 14 },
  alertGrad: { borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,59,48,0.55)', overflow: 'hidden' },
  alertCard: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  alertIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,59,48,0.15)', justifyContent: 'center', alignItems: 'center' },
  alertTitle: { color: '#FF3B30', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  alertDesc: { color: '#bbb', fontSize: 11, marginTop: 2 },
  alertDistBox: { alignItems: 'center', paddingLeft: 10 },
  alertDistNum: { color: '#FF3B30', fontSize: 18, fontWeight: '900' },
  alertDistLbl: { color: '#555', fontSize: 9 },
  detailWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.5, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  detailInner: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  detailHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 18 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  detailIconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,59,48,0.12)', justifyContent: 'center', alignItems: 'center' },
  detailTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  detailCoord: { color: '#555', fontSize: 11, marginTop: 3 },
  detailDesc: { color: '#aaa', fontSize: 13, lineHeight: 20, marginBottom: 20 },
  mapsBtn: { borderRadius: 16, overflow: 'hidden' },
  mapsBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  mapsBtnTxt: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
});
