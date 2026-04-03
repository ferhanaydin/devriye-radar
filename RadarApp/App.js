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
  Navigation, List, Map, RefreshCw, ShieldAlert, Radio,
  Settings, MapPin, ExternalLink, Gauge, Search, X, Route,
  AlertTriangle, Users, CheckCircle
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

// ─── API URL'leri ─────────────────────────────────────────────────────────────
const API_BASE = 'https://devriye-radar.vercel.app';

// ─── Bildirim Ayarı ──────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true,
  }),
});

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────
function getDistanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNearPath(point, path, thresholdM = 500) {
  for (let i = 0; i < path.length; i += 3) {
    if (getDistanceM(point.lat, point.lng, path[i].latitude, path[i].longitude) <= thresholdM)
      return true;
  }
  return false;
}

// Radar tipi — EGM açıklama metninden çıkar
function getRadarType(aciklama) {
  const a = aciklama?.toLowerCase() || '';
  if (a.includes('ortalama')) return { label: 'Ortalama Hız', color: '#FF9500', icon: '⚡' };
  if (a.includes('kırmızı') || a.includes('kirmizi')) return { label: 'Kırmızı Işık', color: '#FF2D55', icon: '🚦' };
  if (a.includes('mobil')) return { label: 'Mobil EDS', color: '#AF52DE', icon: '🚔' };
  return { label: 'Sabit EDS', color: '#FF3B30', icon: '📷' };
}

const fmtDist = (m) => m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
const speedColor = (kmh) => kmh < 80 ? '#30D158' : kmh < 100 ? '#FF9500' : '#FF3B30';

const VOICE_MSGS = {
  1000: 'Dikkat! Bir kilometre ileride radar kontrol noktası!',
  500: 'Dikkat! Beş yüz metre ileride radar!',
  200: 'Dikkat! İki yüz metre ileride radar! Hızınızı düşürün!',
  speed: 'Dikkat! Hız fazla ve ileride radar var! Yavaşlayın!',
  community: 'Dikkat! Yakında mobil radar bildirildi!',
};

export default function App() {
  const mapRef = useRef(null);
  const alertAnim = useRef(new Animated.Value(0)).current;
  const detailAnim = useRef(new Animated.Value(height)).current;
  const listAnim = useRef(new Animated.Value(height)).current;
  const reportAnim = useRef(new Animated.Value(0)).current;
  const lastAlertTime = useRef({});
  const alertActiveRef = useRef(false);
  const communityAlertedIds = useRef(new Set());

  // ─── State ──────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [markers, setMarkers] = useState([]);
  const [communityRadars, setCommunityRadars] = useState([]); // Topluluk radarları
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
  const [destInput, setDestInput] = useState('');
  const [routePath, setRoutePath] = useState(null);
  const [routeRadarsCount, setRouteRadarsCount] = useState(0);
  const [isRouting, setIsRouting] = useState(false);
  const [reportSent, setReportSent] = useState(false); // Bildir butonu feedback

  // ─── İlk Yükleme ────────────────────────────────────────────────────────────
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
            latitude: loc.coords.latitude, longitude: loc.coords.longitude,
            latitudeDelta: 0.04, longitudeDelta: 0.04,
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

      await loadMarkers();
      await loadCommunityRadars();
    })();
    return () => deactivateKeepAwake();
  }, []);

  // Topluluk radarlarını her 2 dakikada bir tazele
  useEffect(() => {
    const interval = setInterval(loadCommunityRadars, 120000);
    return () => clearInterval(interval);
  }, []);

  // ─── EGM Veri Yükleme ───────────────────────────────────────────────────────
  const loadMarkers = useCallback(async () => {
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${API_BASE}/eds_markers.json`, { signal: controller.signal });
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

  // ─── Topluluk Radarları Yükleme ─────────────────────────────────────────────
  const loadCommunityRadars = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/community`);
      const { radars } = await res.json();
      if (radars) setCommunityRadars(radars);
    } catch (e) {
      // Sessizce geç
    }
  }, []);

  // ─── Mobil Radar Bildir ──────────────────────────────────────────────────────
  const reportCommunityRadar = async () => {
    if (!userLocation) return;
    try {
      await fetch(`${API_BASE}/api/community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: userLocation.latitude, lng: userLocation.longitude }),
      });
      setReportSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadCommunityRadars();
      setTimeout(() => setReportSent(false), 3000);
    } catch (e) {
      Alert.alert('Hata', 'Bildirim gönderilemedi.');
    }
  };

  // ─── Rota Oluşturma ──────────────────────────────────────────────────────────
  const searchRoute = async () => {
    if (!destInput || !userLocation) return;
    setIsLoading(true);
    Keyboard.dismiss();
    try {
      const geocode = await Location.geocodeAsync(destInput);
      if (!geocode?.length) { Alert.alert('Hata', 'Yer bulunamadı.'); return; }
      const { latitude: dLat, longitude: dLng } = geocode[0];
      const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.longitude},${userLocation.latitude};${dLng},${dLat}?overview=full&geometries=polyline`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.routes?.length) { Alert.alert('Hata', 'Yol tarifi oluşturulamadı.'); return; }
      const points = polyline.decode(data.routes[0].geometry);
      const coords = points.map(p => ({ latitude: p[0], longitude: p[1] }));
      setRoutePath(coords);
      setIsRouting(true);
      setRouteRadarsCount(markers.filter(m => isNearPath(m, coords)).length);
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 130, right: 50, bottom: 220, left: 50 }, animated: true,
      });
    } catch (e) {
      Alert.alert('Hata', 'Rota oluşturulamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearRoute = () => {
    setRoutePath(null); setIsRouting(false); setDestInput(''); setRouteRadarsCount(0);
    if (userLocation) mapRef.current?.animateToRegion({
      latitude: userLocation.latitude, longitude: userLocation.longitude,
      latitudeDelta: 0.025, longitudeDelta: 0.025,
    }, 700);
  };

  // ─── Uyarı Kontrolü ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userLocation || markers.length === 0) return;
    const sorted = markers.map(m => ({
      ...m, dist: getDistanceM(userLocation.latitude, userLocation.longitude, parseFloat(m.lat), parseFloat(m.lng))
    })).sort((a, b) => a.dist - b.dist);

    const nearest = sorted[0];
    setNearestRadar(nearest);
    setNearestDist(nearest.dist);
    setNearbyRadars(sorted.slice(0, 8));

    // EGM radar bantları
    const now = Date.now();
    for (const band of [200, 500, 1000]) {
      if (nearest.dist <= band && band <= settings.alertDistance) {
        if (now - (lastAlertTime.current[band] || 0) > 45000) {
          lastAlertTime.current[band] = now;
          triggerAlert(nearest, band, currentSpeed > 80 && band <= 500);
          break;
        }
      }
    }

    // Topluluk radarı kontrolü
    communityRadars.forEach(cr => {
      const dist = getDistanceM(userLocation.latitude, userLocation.longitude, cr.lat, cr.lng);
      if (dist < 500 && !communityAlertedIds.current.has(cr.id)) {
        communityAlertedIds.current.add(cr.id);
        if (settings.voiceEnabled) Speech.speak(VOICE_MSGS.community, { language: 'tr-TR' });
        if (settings.hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    });

    if (nearest.dist <= settings.alertDistance) {
      if (!alertActiveRef.current) {
        alertActiveRef.current = true; setIsAlertActive(true);
        Animated.spring(alertAnim, { toValue: 1, useNativeDriver: true, tension: 20, friction: 7 }).start();
      }
    } else {
      if (alertActiveRef.current) {
        alertActiveRef.current = false; setIsAlertActive(false);
        Animated.timing(alertAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
        lastAlertTime.current = {};
      }
    }
  }, [userLocation, markers, communityRadars, settings, currentSpeed]);

  const triggerAlert = async (radar, band, isSpeedHigh) => {
    const msg = isSpeedHigh ? VOICE_MSGS.speed : VOICE_MSGS[band];
    if (settings.voiceEnabled) { Speech.stop(); Speech.speak(msg, { language: 'tr-TR', rate: 0.95 }); }
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
    Animated.spring(detailAnim, { toValue: height * 0.55, useNativeDriver: true, tension: 18, friction: 8 }).start();
  }, []);

  const closeDetail = useCallback(() => {
    Animated.timing(detailAnim, { toValue: height, duration: 320, useNativeDriver: true }).start(() => setSelectedMarker(null));
  }, []);

  const goToMyLocation = () => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({
      latitude: userLocation.latitude, longitude: userLocation.longitude,
      latitudeDelta: 0.025, longitudeDelta: 0.025,
    }, 700);
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* HARİTA */}
      <MapView
        ref={mapRef} style={s.map} provider={PROVIDER_DEFAULT}
        mapType={isSatellite ? 'satellite' : 'standard'}
        initialRegion={{ latitude: 39.9, longitude: 32.8, latitudeDelta: 8, longitudeDelta: 8 }}
        showsUserLocation showsMyLocationButton={false}
        onPress={closeDetail}
      >
        {routePath && (
          <Polyline coordinates={routePath} strokeWidth={5} strokeColor="#007AFF" lineCap="round" />
        )}

        {/* EGM Radarları */}
        {markers.map((m, i) => {
          if (routePath && !isNearPath(m, routePath)) return null;
          const type = getRadarType(m.Aciklama);
          return (
            <Marker key={`egm-${i}`} coordinate={{ latitude: parseFloat(m.lat), longitude: parseFloat(m.lng) }}
              tracksViewChanges={false} onPress={() => openDetail(m)}>
              <View style={s.pin}>
                <View style={[s.pinDot, { backgroundColor: type.color },
                  nearestRadar?.Aciklama === m.Aciklama && isAlertActive && s.pinDotAlert]} />
              </View>
            </Marker>
          );
        })}

        {/* Topluluk Radarları (Mor) */}
        {communityRadars.map((cr) => (
          <Marker key={`cr-${cr.id}`} coordinate={{ latitude: cr.lat, longitude: cr.lng }}
            tracksViewChanges={false}>
            <View style={s.communityPin}>
              <Text style={s.communityPinText}>🚔</Text>
              {cr.votes > 1 && <View style={s.voteBadge}><Text style={s.voteTxt}>{cr.votes}</Text></View>}
            </View>
          </Marker>
        ))}
      </MapView>

      {/* HEADER */}
      <BlurView intensity={88} tint="dark" style={s.header}>
        <View style={s.hRow}>
          <View>
            <Text style={s.appName}>Devriye</Text>
            <View style={s.badge}>
              <View style={[s.dot, { backgroundColor: isLoading ? '#FF9500' : (dataSource === 'BuluT' ? '#30D158' : '#FF3B30') }]} />
              <Text style={s.badgeTxt}>{isLoading ? 'Yükleniyor...' : `${markers.length} aktif nokta`}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.hBtn} onPress={() => setShowSettings(true)}>
            <Settings color="#fff" size={18} />
          </TouchableOpacity>
        </View>

        {/* Arama Barı */}
        <View style={s.searchWrap}>
          <Search color="#777" size={17} style={{ marginLeft: 12 }} />
          <TextInput
            placeholder="Rota oluştur — nereye gidiyorsun?"
            placeholderTextColor="#555"
            style={s.searchInput}
            value={destInput}
            onChangeText={setDestInput}
            onSubmitEditing={searchRoute}
            returnKeyType="search"
          />
          {destInput.length > 0 && (
            <TouchableOpacity onPress={clearRoute} style={{ padding: 10 }}>
              <X color="#777" size={16} />
            </TouchableOpacity>
          )}
        </View>

        {isRouting && (
          <View style={s.routeInfoBar}>
            <Route color="#30D158" size={14} />
            <Text style={s.routeInfoTxt}>Rotanda <Text style={{ color: '#FF3B30', fontWeight: '800' }}>{routeRadarsCount}</Text> radar var</Text>
            <TouchableOpacity onPress={clearRoute}><Text style={{ color: '#007AFF', fontSize: 12 }}>Temizle</Text></TouchableOpacity>
          </View>
        )}
      </BlurView>

      {/* HIZ GÖSTERGESİ */}
      <View style={s.speedWrap}>
        <BlurView intensity={80} tint="dark" style={s.speedCard}>
          <Gauge color={speedColor(currentSpeed)} size={14} style={{ marginBottom: 1 }} />
          <Text style={[s.speedNum, { color: speedColor(currentSpeed) }]}>{currentSpeed}</Text>
          <Text style={s.speedUnit}>km/h</Text>
        </BlurView>
      </View>

      {/* MOBİL RADAR BİLDİR BUTONU */}
      <TouchableOpacity style={[s.reportBtn, reportSent && s.reportBtnSent]} onPress={reportCommunityRadar} activeOpacity={0.8}>
        <BlurView intensity={85} tint="dark" style={s.reportInner}>
          {reportSent
            ? <><CheckCircle color="#30D158" size={18} /><Text style={[s.reportTxt, { color: '#30D158' }]}>Gönderildi!</Text></>
            : <><AlertTriangle color="#FF9500" size={18} /><Text style={s.reportTxt}>Mobil Radar!</Text></>
          }
        </BlurView>
      </TouchableOpacity>

      {/* KONTROLLER */}
      <View style={s.controls}>
        <Btn onPress={goToMyLocation}><Navigation color="#007AFF" size={20} /></Btn>
        <Btn onPress={() => setIsSatellite(p => !p)}><Map color={isSatellite ? '#FFD60A' : '#aaa'} size={20} /></Btn>
        <Btn onPress={() => { setShowList(true); Animated.spring(listAnim, { toValue: height * 0.42, useNativeDriver: true }).start(); }}>
          <List color="#fff" size={20} />
        </Btn>
      </View>

      {/* UYARI KARTI */}
      {isAlertActive && (
        <Animated.View style={[s.alertWrap, {
          opacity: alertAnim,
          transform: [{ translateY: alertAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <LinearGradient colors={['rgba(255,59,48,0.18)', 'rgba(255,59,48,0.04)']} style={s.alertGrad}>
            <BlurView intensity={90} tint="dark" style={s.alertCard}>
              <View style={s.alertIcon}><Radio color="#FF3B30" size={22} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.alertTitle}>RADAR TESPİT EDİLDİ</Text>
                <Text style={s.alertType}>{getRadarType(nearestRadar?.Aciklama).icon} {getRadarType(nearestRadar?.Aciklama).label}</Text>
                <Text style={s.alertDesc} numberOfLines={1}>{nearestRadar?.Aciklama}</Text>
              </View>
              <View style={s.alertDistBox}>
                <Text style={s.alertDistNum}>{nearestDist ? fmtDist(nearestDist) : ''}</Text>
                <Text style={s.alertDistLbl}>uzakta</Text>
              </View>
            </BlurView>
          </LinearGradient>
        </Animated.View>
      )}

      {/* RADAR DETAY KARTI */}
      {selectedMarker && (() => {
        const type = getRadarType(selectedMarker.Aciklama);
        return (
          <Animated.View style={[s.detailWrap, { transform: [{ translateY: detailAnim }] }]}>
            <BlurView intensity={98} tint="dark" style={s.detailInner}>
              <View style={s.detailHandle} />
              <View style={s.detailHeader}>
                <View style={[s.detailIconBox, { backgroundColor: type.color + '22' }]}>
                  <Text style={{ fontSize: 26 }}>{type.icon}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={s.detailTitle}>{type.label}</Text>
                  <View style={[s.typeBadge, { backgroundColor: type.color + '33', borderColor: type.color }]}>
                    <Text style={[s.typeBadgeTxt, { color: type.color }]}>{type.label}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={closeDetail}><Text style={{ color: '#007AFF', fontSize: 16 }}>Kapat</Text></TouchableOpacity>
              </View>

              <Text style={s.detailDesc}>{selectedMarker.Aciklama}</Text>

              <View style={s.detailStats}>
                <View style={s.dStat}><Text style={s.dStatVal}>{nearestDist ? fmtDist(nearestDist) : '—'}</Text><Text style={s.dStatLbl}>Uzaklık</Text></View>
                <View style={s.dStatSep} />
                <View style={s.dStat}><Text style={s.dStatVal}>{type.icon}</Text><Text style={s.dStatLbl}>Tip</Text></View>
                <View style={s.dStatSep} />
                <View style={s.dStat}><Text style={s.dStatVal}>EGM</Text><Text style={s.dStatLbl}>Kaynak</Text></View>
              </View>

              <TouchableOpacity style={s.mapsBtn}
                onPress={() => Linking.openURL(`https://maps.google.com/?q=${selectedMarker.lat},${selectedMarker.lng}`)}>
                <LinearGradient colors={['#1C1C1E', '#2C2C2E']} style={s.mapsBtnInner}>
                  <MapPin color="#007AFF" size={18} />
                  <Text style={s.mapsBtnTxt}>Google Maps'te Aç</Text>
                  <ExternalLink color="#666" size={14} />
                </LinearGradient>
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        );
      })()}

      {/* YAKIN RADARLAR LİSTESİ */}
      {showList && (
        <Animated.View style={[s.listWrap, { transform: [{ translateY: listAnim }] }]}>
          <BlurView intensity={98} tint="dark" style={s.listInner}>
            <View style={s.listHandle} />
            <View style={s.listHead}>
              <Text style={s.listTitle}>Yakındaki Radarlar</Text>
              <TouchableOpacity onPress={() => Animated.timing(listAnim, { toValue: height, duration: 320, useNativeDriver: true }).start(() => setShowList(false))}>
                <Text style={s.listClose}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={nearbyRadars}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item, index }) => {
                const type = getRadarType(item.Aciklama);
                return (
                  <TouchableOpacity style={s.listItem} onPress={() => {
                    setShowList(false);
                    openDetail(item);
                    mapRef.current?.animateToRegion({
                      latitude: parseFloat(item.lat), longitude: parseFloat(item.lng),
                      latitudeDelta: 0.008, longitudeDelta: 0.008,
                    }, 700);
                  }}>
                    <View style={[s.listIdx, { backgroundColor: index === 0 ? '#FF3B30' : '#2c2c2c' }]}>
                      <Text style={s.listIdxTxt}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.listItemTitle} numberOfLines={1}>{item.Aciklama}</Text>
                      <Text style={[s.listItemType, { color: type.color }]}>{type.icon} {type.label} · {fmtDist(item.dist)}</Text>
                    </View>
                    <ShieldAlert color={index === 0 ? '#FF3B30' : '#444'} size={15} />
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={s.sep} />}
            />
          </BlurView>
        </Animated.View>
      )}

      {/* AYARLAR */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <SettingsScreen settings={settings} onSettingsChange={setSettings} onClose={() => setShowSettings(false)} />
      </Modal>
    </View>
  );
}

function Btn({ children, onPress }) {
  return <TouchableOpacity style={s.ctrlBtn} onPress={onPress}>{children}</TouchableOpacity>;
}

// ─── STİLLER ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  map: { flex: 1 },
  pin: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  pinDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  pinDotAlert: { width: 14, height: 14, borderRadius: 7, shadowOpacity: 1, shadowRadius: 8, shadowColor: '#FF3B30' },
  communityPin: { alignItems: 'center', justifyContent: 'center' },
  communityPinText: { fontSize: 22 },
  voteBadge: { position: 'absolute', top: -4, right: -8, backgroundColor: '#AF52DE', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 },
  voteTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 50, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  hRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appName: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  badge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  badgeTxt: { color: '#666', fontSize: 11 },
  hBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, marginTop: 14, height: 44, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingHorizontal: 10 },
  routeInfoBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(48,209,88,0.08)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10, gap: 6 },
  routeInfoTxt: { color: '#aaa', fontSize: 13, flex: 1, marginLeft: 6 },
  speedWrap: { position: 'absolute', left: 16, bottom: 50 },
  speedCard: { width: 74, height: 74, borderRadius: 37, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  speedNum: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  speedUnit: { color: '#555', fontSize: 10 },
  reportBtn: { position: 'absolute', bottom: 140, left: '50%', marginLeft: -70, width: 140, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,149,0,0.5)' },
  reportBtnSent: { borderColor: 'rgba(48,209,88,0.5)' },
  reportInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  reportTxt: { color: '#FF9500', fontWeight: '700', fontSize: 14 },
  controls: { position: 'absolute', right: 16, bottom: 50, gap: 10 },
  ctrlBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(20,20,20,0.9)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  alertWrap: { position: 'absolute', bottom: 148, left: 14, right: 14 },
  alertGrad: { borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,59,48,0.5)', overflow: 'hidden' },
  alertCard: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  alertIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,59,48,0.15)', justifyContent: 'center', alignItems: 'center' },
  alertTitle: { color: '#FF3B30', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  alertType: { color: '#FF9500', fontSize: 11, marginTop: 1 },
  alertDesc: { color: '#999', fontSize: 10, marginTop: 1 },
  alertDistBox: { alignItems: 'center', paddingLeft: 10 },
  alertDistNum: { color: '#FF3B30', fontSize: 18, fontWeight: '900' },
  alertDistLbl: { color: '#555', fontSize: 9 },
  detailWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.55, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  detailInner: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  detailHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 18 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  detailIconBox: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  detailTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, marginTop: 4 },
  typeBadgeTxt: { fontSize: 11, fontWeight: '600' },
  detailDesc: { color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 18 },
  detailStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingVertical: 14, marginBottom: 16 },
  dStat: { flex: 1, alignItems: 'center' },
  dStatVal: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dStatLbl: { color: '#555', fontSize: 11, marginTop: 3 },
  dStatSep: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 6 },
  mapsBtn: { borderRadius: 16, overflow: 'hidden' },
  mapsBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  mapsBtnTxt: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  listWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.6, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' },
  listInner: { flex: 1, paddingTop: 10 },
  listHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 14 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 8 },
  listTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  listClose: { color: '#007AFF', fontSize: 16 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13 },
  listIdx: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  listIdxTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  listItemTitle: { color: '#fff', fontSize: 13 },
  listItemType: { fontSize: 11, marginTop: 2 },
  sep: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 58 },
});
