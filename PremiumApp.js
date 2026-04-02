import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, SafeAreaView, Dimensions, 
  TouchableOpacity, StatusBar, ScrollView, Animated 
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { 
  Navigation, Camera, Bell, Info, Map as MapIcon, 
  Layers, MapPin, Search 
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Premium Dark Map Style (Apple Maps Midnight Mode Style)
const MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#121212" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#767676" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

export default function App() {
  const [selectedRadar, setSelectedRadar] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const mapRef = useRef(null);

  // API'den veri çekme (Bilgisayarının IP adresini buraya yazmalısın)
  const API_URL = 'http://192.168.1.XXX:3000/api/markers'; 

  const fetchMarkers = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      setMarkers(data);
    } catch (error) {
      console.log('Veri çekilemedi, JSON dosyası veya sunucu kontrol edilmeli.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkers();
    const interval = setInterval(fetchMarkers, 20 * 60 * 1000); // 20 dk.da bir
    return () => clearInterval(interval);
  }, []);

  // Panel animasyonu
  const showDetail = (radar) => {
    setSelectedRadar(radar);
    Animated.spring(slideAnim, {
      toValue: height - 320,
      useNativeDriver: true,
      tension: 20,
      friction: 7
    }).start();

    // Haritayı merkeze al
    mapRef.current?.animateToRegion({
      latitude: parseFloat(radar.lat),
      longitude: parseFloat(radar.lng),
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 1000);
  };

  const closeDetail = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true
    }).start(() => setSelectedRadar(null));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* MAP LAYER */}
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={MAP_STYLE}
        initialRegion={{
          latitude: 41.0082,
          longitude: 28.9784,
          latitudeDelta: 0.2, // Şehri geniş gör
          longitudeDelta: 0.2,
        }}
        onPress={closeDetail}
      >
        {/* Dinamik Radar İşaretçileri */}
        {markers.map((marker, index) => (
          <Marker
            key={index}
            coordinate={{ 
              latitude: parseFloat(marker.lat), 
              longitude: parseFloat(marker.lng) 
            }}
            onPress={() => showDetail(marker)}
            tracksViewChanges={false} // Performans için önemli
          >
            <View style={styles.radarPointContainer}>
              <View style={styles.radarPointInner} />
              <View style={styles.radarPulse} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* TOP HEADER (Glassmorphism) */}
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Radar Radar</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>1572 Aktif Nokta</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconButton}>
            <Bell color="#fff" size={22} />
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* SPEEDOMETER & CONTROLS */}
      <View style={styles.sidebar}>
        <TouchableOpacity style={styles.glassButton}><Search color="#fff" size={22} /></TouchableOpacity>
        <TouchableOpacity style={styles.glassButton}><Layers color="#fff" size={22} /></TouchableOpacity>
        <TouchableOpacity style={[styles.glassButton, styles.activeBtn]}><Navigation color="#fff" size={22} /></TouchableOpacity>
      </View>

      {/* DETAIL DRAWER (Animated) */}
      <Animated.View style={[styles.detailCard, { transform: [{ translateY: slideAnim }] }]}>
        <BlurView intensity={100} tint="dark" style={styles.detailBlur}>
          <View style={styles.dragger} />
          {selectedRadar && (
            <View style={styles.detailContent}>
              <View style={styles.detailHeader}>
                <View style={styles.radarIconBox}>
                  <Camera color="#FF3B30" size={32} />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.detailTitle}>EDS Kontrol Noktası</Text>
                  <Text style={styles.detailSub}>{selectedRadar.lat}, {selectedRadar.lng}</Text>
                </View>
              </View>
              
              <Text style={styles.descriptionText}>{selectedRadar.Aciklama}</Text>
              
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Hız Sınırı</Text>
                  <Text style={styles.statValue}>82 <Text style={{fontSize: 12}}>km/h</Text></Text>
                </View>
                <View style={styles.statSeparator} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Tip</Text>
                  <Text style={styles.statValue}>İhlal</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.navigateBtn}>
                <LinearGradient
                  colors={['#FF3B30', '#D7261C']}
                  style={styles.gradientBtn}
                >
                  <Navigation color="#fff" size={20} />
                  <Text style={styles.btnText}>Yol Tarifi Al</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: '100%', height: '100%' },
  
  // HEADER
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    paddingHorizontal: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CD964', marginRight: 6 },
  statusText: { color: '#aaa', fontSize: 13, fontWeight: '500' },
  
  // CONTROLS
  sidebar: {
    position: 'absolute',
    right: 20,
    top: height / 3,
    gap: 15,
  },
  glassButton: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(40,40,40,0.7)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  activeBtn: { backgroundColor: '#007AFF', borderColor: '#007AFF' },

  // RADAR POINT
  radarPointContainer: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  radarPointInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF3B30', zIndex: 2, borderWidth: 2, borderColor: '#fff' },
  radarPulse: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,59,48,0.4)', zIndex: 1 },

  // DETAIL CARD
  detailCard: {
    position: 'absolute',
    left: 10, right: 10,
    height: 400,
    borderRadius: 35,
    overflow: 'hidden',
  },
  detailBlur: { flex: 1, padding: 25 },
  dragger: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: 20 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  radarIconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  detailTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  detailSub: { color: '#888', fontSize: 13, marginTop: 4 },
  descriptionText: { color: '#ccc', fontSize: 15, lineHeight: 22, marginBottom: 25 },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, marginBottom: 25 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#888', fontSize: 12, marginBottom: 5 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statSeparator: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  navigateBtn: { shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
  gradientBtn: { 
    height: 60, borderRadius: 20, flexDirection: 'row', 
    justifyContent: 'center', alignItems: 'center', gap: 10 
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
