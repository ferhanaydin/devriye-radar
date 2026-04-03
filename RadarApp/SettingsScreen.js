import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ScrollView, Dimensions, Alert
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Bell, Volume2, Vibrate, MapPin, BarChart2, Trash2, ShieldAlert } from 'lucide-react-native';
import { saveSettings, loadWeeklyStats, loadStats, clearStats } from './storage';

const { width } = Dimensions.get('window');
const CHART_W = width - 64;

const DISTANCES = [
  { label: '200m', value: 200 },
  { label: '500m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
];

export default function SettingsScreen({ settings, onSettingsChange, onClose }) {
  const [weekly, setWeekly] = useState([]);
  const [stats,  setStats]  = useState({ totalWarnings: 0, todayWarnings: 0 });

  useEffect(() => {
    (async () => {
      const [w, s] = await Promise.all([loadWeeklyStats(), loadStats()]);
      setWeekly(w);
      setStats(s);
    })();
  }, []);

  const update = useCallback((key, value) => {
    const updated = { ...settings, [key]: value };
    onSettingsChange(updated);
    saveSettings(updated);
  }, [settings]);

  const handleClearStats = () => {
    Alert.alert('İstatistikleri Sıfırla', 'Tüm uyarı geçmişi silinecek. Emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sıfırla', style: 'destructive',
        onPress: async () => {
          await clearStats();
          setWeekly(weekly.map(d => ({ ...d, count: 0 })));
          setStats({ totalWarnings: 0, todayWarnings: 0 });
        }
      }
    ]);
  };

  // Grafik maksimum değeri
  const maxCount = Math.max(...weekly.map(d => d.count), 1);

  return (
    <View style={s.root}>
      {/* Header */}
      <BlurView intensity={90} tint="dark" style={s.header}>
        <Text style={s.headerTitle}>Ayarlar</Text>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <X color="#fff" size={20} />
        </TouchableOpacity>
      </BlurView>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* İstatistik Özeti */}
        <View style={s.statsRow}>
          <LinearGradient colors={['#FF3B3020', '#FF3B3005']} style={s.statCard}>
            <ShieldAlert color="#FF3B30" size={22} />
            <Text style={s.statNum}>{stats.todayWarnings}</Text>
            <Text style={s.statLbl}>Bugün</Text>
          </LinearGradient>
          <LinearGradient colors={['#FF950020', '#FF950005']} style={s.statCard}>
            <BarChart2 color="#FF9500" size={22} />
            <Text style={s.statNum}>{stats.totalWarnings}</Text>
            <Text style={s.statLbl}>Toplam</Text>
          </LinearGradient>
        </View>

        {/* Haftalık Grafik */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Son 7 Günlük Uyarı</Text>
          <View style={s.chartWrap}>
            {weekly.map((day, i) => {
              const barH = weekly.length > 0
                ? Math.max(4, (day.count / maxCount) * 100)
                : 4;
              const isToday = i === weekly.length - 1;
              return (
                <View key={day.key} style={s.barCol}>
                  {day.count > 0 && (
                    <Text style={s.barCount}>{day.count}</Text>
                  )}
                  <View style={s.barTrack}>
                    <LinearGradient
                      colors={isToday ? ['#FF3B30', '#FF9500'] : ['#333', '#222']}
                      style={[s.bar, { height: `${barH}%` }]}
                    />
                  </View>
                  <Text style={[s.barLabel, isToday && { color: '#FF9500' }]}>{day.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Uyarı Mesafesi */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            <MapPin color="#007AFF" size={14} />  Uyarı Mesafesi
          </Text>
          <View style={s.distRow}>
            {DISTANCES.map(d => (
              <TouchableOpacity
                key={d.value}
                style={[s.distBtn, settings.alertDistance === d.value && s.distBtnActive]}
                onPress={() => update('alertDistance', d.value)}
              >
                <Text style={[s.distTxt, settings.alertDistance === d.value && s.distTxtActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bildirim Ayarları */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Bildirimler</Text>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Volume2 color="#30D158" size={18} />
              <View style={{ marginLeft: 12 }}>
                <Text style={s.rowTitle}>Ses</Text>
                <Text style={s.rowSub}>Uyarı sesi çal</Text>
              </View>
            </View>
            <Switch value={settings.soundEnabled} onValueChange={v => update('soundEnabled', v)}
              trackColor={{ true: '#30D158' }} thumbColor="#fff" />
          </View>

          <View style={s.divider} />

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Bell color="#007AFF" size={18} />
              <View style={{ marginLeft: 12 }}>
                <Text style={s.rowTitle}>Sesli Anons</Text>
                <Text style={s.rowSub}>"Dikkat! Radar!" sesi</Text>
              </View>
            </View>
            <Switch value={settings.voiceEnabled} onValueChange={v => update('voiceEnabled', v)}
              trackColor={{ true: '#007AFF' }} thumbColor="#fff" />
          </View>

          <View style={s.divider} />

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Vibrate color="#FF9500" size={18} />
              <View style={{ marginLeft: 12 }}>
                <Text style={s.rowTitle}>Titreşim</Text>
                <Text style={s.rowSub}>Sessiz modda titreşim</Text>
              </View>
            </View>
            <Switch value={settings.hapticEnabled} onValueChange={v => update('hapticEnabled', v)}
              trackColor={{ true: '#FF9500' }} thumbColor="#fff" />
          </View>
        </View>

        {/* Sıfırla */}
        <TouchableOpacity style={s.clearBtn} onPress={handleClearStats}>
          <Trash2 color="#FF3B30" size={16} />
          <Text style={s.clearTxt}>İstatistikleri Sıfırla</Text>
        </TouchableOpacity>

        {/* Versiyon */}
        <Text style={s.version}>Devriye - EDS Radar v1.0.0 · EGM Verisi</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  header: { paddingTop: 60, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  closeBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  // İstatistik
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  statNum:  { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 8 },
  statLbl:  { color: '#666', fontSize: 12, marginTop: 4 },

  // Grafik
  section:      { marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  sectionTitle: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 16, letterSpacing: 0.3 },
  chartWrap:    { flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: 6 },
  barCol:       { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barCount:     { color: '#fff', fontSize: 10, fontWeight: '700', marginBottom: 4 },
  barTrack:     { width: '100%', flex: 1, justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  bar:          { width: '100%', borderRadius: 4 },
  barLabel:     { color: '#555', fontSize: 10, marginTop: 6 },

  // Mesafe
  distRow:      { flexDirection: 'row', gap: 8 },
  distBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  distBtnActive:{ backgroundColor: 'rgba(0,122,255,0.15)', borderColor: '#007AFF' },
  distTxt:      { color: '#666', fontSize: 13, fontWeight: '600' },
  distTxtActive:{ color: '#007AFF' },

  // Toggle Satırları
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowTitle:{ color: '#fff', fontSize: 15 },
  rowSub:  { color: '#555', fontSize: 12, marginTop: 2 },
  divider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 12 },

  // Sıfırla
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,59,48,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,59,48,0.3)', marginBottom: 20 },
  clearTxt: { color: '#FF3B30', fontSize: 15, fontWeight: '600' },
  version:  { color: '#333', fontSize: 11, textAlign: 'center' },
});
