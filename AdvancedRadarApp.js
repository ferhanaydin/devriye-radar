import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, SafeAreaView, Dimensions,
  TouchableOpacity, StatusBar, Animated, Platform, Alert, Share
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Navigation, Camera, Bell, Info, ShieldAlert, Share2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

// YENİ PAKETLER
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import * as TaskManager from 'expo-task-manager';

const { width, height } = Dimensions.get('window');
const LOCATION_TASK_NAME = 'background-location-task';

// Bildirim Ayarları
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [nearestRadar, setNearestRadar] = useState(null);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const soundRef = useRef(null);
  const mapRef = useRef(null);

  // Paylaşma Fonksiyonu
  const onShare = async () => {
    try {
      await Share.share({
        message: '🚨 Trafikte radarları saniye saniye takip ettiğim bu uygulamayı sen de indirmelisin! \n\nLink: (Buraya link gelecek)',
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  // 1. İzinleri Al (Konum & Bildirim)
  useEffect(() => {
    (async () => {
      // Bildirim İzni
      const { status: nStatus } = await Notifications.getPermissionsAsync();
      if (nStatus !== 'granted') await Notifications.requestPermissionsAsync();

      // Konum İzni (Ön Plan)
      const { status: lStatus } = await Location.requestForegroundPermissionsAsync();
      if (lStatus !== 'granted') {
        Alert.alert('İzin Gerekli', 'Radarları görebilmek için konum izni vermelisin.');
        return;
      }

      // Mevcut Konumu Al
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc.coords);

      // Verileri Çek
      fetchMarkers();
    })();
  }, []);

  // 2. Ses Dosyasını Hazırla
  async function playAlertSound() {
    const { sound } = await Audio.Sound.createAsync(
      require('./assets/alert.mp3') // Buraya bir ses dosyası ekleyebilirsin
    );
    soundRef.current = sound;
    await sound.playAsync();
  }

  // 3. Mesafe Kontrolü Mantığı
  useEffect(() => {
    if (!userLocation || markers.length === 0) return;

    // En yakın radarı bul (Haversine formülü veya basit Pisagor)
    let minDistance = Infinity;
    let closest = null;

    markers.forEach(marker => {
      const dist = getDistance(
        userLocation.latitude, userLocation.longitude,
        parseFloat(marker.lat), parseFloat(marker.lng)
      );
      if (dist < minDistance) {
        minDistance = dist;
        closest = marker;
      }
    });

    // 500 metre içindeyse ve daha önce uyarmadıysak
    if (minDistance < 0.5) { // 0.5 km = 500m
      if (!isAlertActive) {
        sendNotification(closest.Aciklama);
        playAlertSound();
        setIsAlertActive(true);
        setNearestRadar(closest);
      }
    } else {
      setIsAlertActive(false);
    }
  }, [userLocation]);

  // Bildirim Gönder
  async function sendNotification(desc) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🚨 DİKKAT: YAKINDA EDS VAR!",
        body: `500m içerisinde kontrol noktası: ${desc}`,
        data: { data: 'goes here' },
        sound: 'default',
      },
      trigger: null, // Hemen gönder
    });
  }

  // Mesafe hesaplama (Basit km hesabı)
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Dünya yarıçapı
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const fetchMarkers = async () => {
    try {
      const response = await fetch('http://192.168.1.73:3000/api/markers');
      const data = await response.json();
      setMarkers(data);
    } catch (e) { console.log(e); }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: 41.0082, longitude: 28.9784,
          latitudeDelta: 0.1, longitudeDelta: 0.1,
        }}
        showsUserLocation={true}
        followsUserLocation={true}
      >
        {/* Kullanıcı etrafındaki 500m tehlike çemberi */}
        {userLocation && (
          <Circle
            center={userLocation}
            radius={500}
            fillColor="rgba(255, 59, 48, 0.1)"
            strokeColor="rgba(255, 59, 48, 0.5)"
          />
        )}

        {markers.map((m, i) => (
          <Marker key={i} coordinate={{ latitude: parseFloat(m.lat), longitude: parseFloat(m.lng) }}>
            <View style={styles.marker} />
          </Marker>
        ))}
      </MapView>

      {/* PREMIUM HEADER - PAYLAŞ BUTONLU */}
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Radar Radar</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Aktif Takipte</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 15 }}>
            <TouchableOpacity onPress={onShare} style={styles.iconButton}>
              <Share2 color="#fff" size={22} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Bell color="#fff" size={22} />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      {/* UYARI PANELİ (Sadece radar yakındayken çıkar) */}
      {isAlertActive && (
        <BlurView intensity={90} tint="dark" style={styles.alertCard}>
          <ShieldAlert color="#FF3B30" size={40} />
          <View style={{ marginLeft: 15, flex: 1 }}>
            <Text style={styles.alertTitle}>RADAR TESPİT EDİLDİ!</Text>
            <Text style={styles.alertDesc}>{nearestRadar?.Aciklama}</Text>
          </View>
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: '100%', height: '100%' },
  marker: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3530', borderWidth: 2, borderColor: '#fff' },
  alertCard: {
    position: 'absolute', top: 60, left: 20, right: 20,
    padding: 20, borderRadius: 25, flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: '#FF3B30',
  },
  alertTitle: { color: '#FF3B30', fontWeight: '900', fontSize: 18 },
  alertDesc: { color: '#fff', fontSize: 13, marginTop: 4 },

  // Header Styles
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 60, paddingBottom: 20,
    borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    paddingHorizontal: 25, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CD964', marginRight: 6 },
  statusText: { color: '#aaa', fontSize: 13, fontWeight: '500' },
  iconButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  }
});
