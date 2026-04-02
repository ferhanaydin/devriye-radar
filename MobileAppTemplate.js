import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView, Dimensions, TouchableOpacity } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Camera, Navigation, RefreshCcw } from 'lucide-react-native';

// Çektiğimiz veriyi projenin içine attığını varsayalım (veya bir API'den çekebilirsin)
// import edsData from './assets/eds_markers.json';

const { width, height } = Dimensions.get('window');

const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "lines": { "color": "#bdbdbd" } }
  // ... map box style ...
];

export default function App() {
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Veriyi simüle edelim (Burada senin JSON'un olacak)
  useEffect(() => {
    // Gerçek uygulamada fetch('https://senin-api-adresin.com/markers') yapabilirsin
    // Örnek veri formatı: [{ Aciklama: '...', lat: '...', lng: '...' }]
    setLoading(false);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EGM Radar Takip</Text>
        <Text style={styles.subtitle}>Toplam {markers.length} Aktif EDS Noktası</Text>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 41.0082,
          longitude: 28.9784,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        customMapStyle={DARK_MAP_STYLE}
      >
        {/* Performans için Marker Clustering kullanılmalıdır */}
        {markers.map((marker, index) => (
          <Marker
            key={index}
            coordinate={{
              latitude: parseFloat(marker.lat),
              longitude: parseFloat(marker.lng),
            }}
            pinColor="#FF3B30"
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>EDS Noktası</Text>
                <Text style={styles.calloutDesc}>{marker.Aciklama}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.button}>
          <Navigation color="white" size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.primaryButton]}>
          <Camera color="white" size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <RefreshCcw color="white" size={24} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(50,50,50,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  primaryButton: {
    backgroundColor: '#FF3B30',
    width: 70,
    height: 70,
    borderRadius: 35,
    marginTop: -10,
  },
  callout: {
    width: 200,
    padding: 10,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  calloutDesc: {
    fontSize: 12,
    color: '#444',
  }
});
