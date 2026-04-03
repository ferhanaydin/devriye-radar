import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Switch, Dimensions, StatusBar
} from 'react-native';
import { BlurView } from 'expo-blur';
import { 
  Settings, Volume2, Mic, Vibrate, MapPin,
  ChevronRight, BarChart2, X, Shield, Clock
} from 'lucide-react-native';
import { saveSetting, loadStats } from './storage';

const { width } = Dimensions.get('window');

const DISTANCES = [200, 500, 1000, 2000];

export default function SettingsScreen({ settings, onSettingsChange, onClose }) {
  const [stats, setStats] = useState({ totalWarnings: 0, todayWarnings: 0 });

  useEffect(() => {
    loadStats().then(setStats);
  }, []);

  const toggle = async (key) => {
    const newVal = !settings[key];
    onSettingsChange({ ...settings, [key]: newVal });
    await saveSetting(key.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, ''), newVal);
  };

  const setDistance = async (dist) => {
    onSettingsChange({ ...settings, alertDistance: dist });
    await saveSetting('ALERT_DISTANCE', dist);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <BlurView intensity={98} tint="dark" style={s.blur}>
        
        {/* Başlık */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Settings color="#fff" size={22} />
            <Text style={s.title}>Ayarlar</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <X color="#fff" size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ─── İSTATİSTİKLER ─── */}
          <Text style={s.sectionTitle}>📊 İstatistikler</Text>
          <View style={s.card}>
            <View style={s.statRow}>
              <View style={s.statBox}>
                <BarChart2 color="#FF3B30" size={24} />
                <Text style={s.statNum}>{stats.totalWarnings}</Text>
                <Text style={s.statLbl}>Toplam Uyarı</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Clock color="#FF9500" size={24} />
                <Text style={s.statNum}>{stats.todayWarnings}</Text>
                <Text style={s.statLbl}>Bugün</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Shield color="#30D158" size={24} />
                <Text style={s.statNum}>1572</Text>
                <Text style={s.statLbl}>Radar Noktası</Text>
              </View>
            </View>
          </View>

          {/* ─── UYARI MESAFESİ ─── */}
          <Text style={s.sectionTitle}>📍 Uyarı Mesafesi</Text>
          <View style={s.card}>
            <View style={s.distRow}>
              {DISTANCES.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.distBtn, settings.alertDistance === d && s.distBtnActive]}
                  onPress={() => setDistance(d)}
                >
                  <Text style={[s.distText, settings.alertDistance === d && s.distTextActive]}>
                    {d < 1000 ? `${d}m` : `${d / 1000}km`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.hint}>
              Radardan {settings.alertDistance < 1000 ? `${settings.alertDistance} metre` : `${settings.alertDistance / 1000} kilometre`} önce uyarı alırsın
            </Text>
          </View>

          {/* ─── BİLDİRİM AYARLARI ─── */}
          <Text style={s.sectionTitle}>🔔 Bildirim</Text>
          <View style={s.card}>
            <ToggleRow
              icon={<Volume2 color="#FF9500" size={22} />}
              label="Ses Uyarısı"
              desc="Radar yaklaşınca bip sesi"
              value={settings.soundEnabled}
              onToggle={() => toggle('soundEnabled')}
            />
            <View style={s.divider} />
            <ToggleRow
              icon={<Mic color="#30D158" size={22} />}
              label="Sesli Anons"
              desc="Türkçe sesli rehber"
              value={settings.voiceEnabled}
              onToggle={() => toggle('voiceEnabled')}
            />
            <View style={s.divider} />
            <ToggleRow
              icon={<Vibrate color="#AF52DE" size={22} />}
              label="Titreşim"
              desc="Uyarıyla birlikte titreşim"
              value={settings.hapticEnabled}
              onToggle={() => toggle('hapticEnabled')}
            />
          </View>

          {/* ─── UYGULAMA HAKKINDA ─── */}
          <Text style={s.sectionTitle}>ℹ️ Hakkında</Text>
          <View style={s.card}>
            <View style={s.aboutRow}>
              <Text style={s.aboutLabel}>Veri Kaynağı</Text>
              <Text style={s.aboutVal}>EGM (Türkiye)</Text>
            </View>
            <View style={s.divider} />
            <View style={s.aboutRow}>
              <Text style={s.aboutLabel}>Radar Sayısı</Text>
              <Text style={s.aboutVal}>1.572 Nokta</Text>
            </View>
            <View style={s.divider} />
            <View style={s.aboutRow}>
              <Text style={s.aboutLabel}>Güncelleme</Text>
              <Text style={s.aboutVal}>Her 15 Dakika</Text>
            </View>
            <View style={s.divider} />
            <View style={s.aboutRow}>
              <Text style={s.aboutLabel}>Sürüm</Text>
              <Text style={s.aboutVal}>1.0.0</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </BlurView>
    </View>
  );
}

function ToggleRow({ icon, label, desc, value, onToggle }) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleIcon}>{icon}</View>
      <View style={s.toggleText}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#333', true: '#30D158' }}
        thumbColor="#fff"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  blur: { flex: 1, paddingTop: 55 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  scroll: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18, marginBottom: 24,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  // İstatistik
  statRow: { flexDirection: 'row', paddingVertical: 20 },
  statBox: { flex: 1, alignItems: 'center', gap: 6 },
  statNum: { color: '#fff', fontSize: 24, fontWeight: '800' },
  statLbl: { color: '#666', fontSize: 11 },
  statDivider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 10 },
  // Mesafe
  distRow: { flexDirection: 'row', gap: 8, padding: 12 },
  distBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', borderWidth: 1, borderColor: 'transparent',
  },
  distBtnActive: { backgroundColor: 'rgba(255,59,48,0.15)', borderColor: '#FF3B30' },
  distText: { color: '#888', fontWeight: '600', fontSize: 15 },
  distTextActive: { color: '#FF3B30' },
  hint: { color: '#555', fontSize: 12, textAlign: 'center', paddingBottom: 12 },
  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  toggleIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  toggleText: { flex: 1 },
  toggleLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  toggleDesc: { color: '#666', fontSize: 12, marginTop: 2 },
  divider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', marginLeft: 70 },
  // Hakkında
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  aboutLabel: { color: '#888', fontSize: 14 },
  aboutVal: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
