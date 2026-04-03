import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@devriye_settings';
const STATS_KEY    = '@devriye_stats';
const WEEKLY_KEY   = '@devriye_weekly';

export const DEFAULT_SETTINGS = {
  alertDistance: 500,
  soundEnabled:  true,
  voiceEnabled:  true,
  hapticEnabled: true,
};

// ─── Ayarlar ─────────────────────────────────────────────────────────────────
export async function loadSettings() {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    return json ? { ...DEFAULT_SETTINGS, ...JSON.parse(json) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export async function saveSettings(settings) {
  try { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  catch {}
}

// ─── Genel İstatistikler ──────────────────────────────────────────────────────
export async function loadStats() {
  try {
    const json = await AsyncStorage.getItem(STATS_KEY);
    const stats = json ? JSON.parse(json) : { totalWarnings: 0, todayWarnings: 0, lastDate: null };
    // Gün geçtiyse bugünküyü sıfırla
    const today = new Date().toDateString();
    if (stats.lastDate !== today) {
      stats.todayWarnings = 0;
      stats.lastDate = today;
    }
    return stats;
  } catch { return { totalWarnings: 0, todayWarnings: 0, lastDate: null }; }
}

export async function incrementWarning() {
  try {
    const stats = await loadStats();
    stats.totalWarnings += 1;
    stats.todayWarnings += 1;
    stats.lastDate = new Date().toDateString();
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));

    // Haftalık veriye de ekle
    await addWeeklyWarning();
    return stats;
  } catch { return { totalWarnings: 0, todayWarnings: 0 }; }
}

// ─── Haftalık İstatistikler ───────────────────────────────────────────────────
// Format: { "2026-04-03": 5, "2026-04-02": 3, ... }
export async function loadWeeklyStats() {
  try {
    const json = await AsyncStorage.getItem(WEEKLY_KEY);
    const data = json ? JSON.parse(json) : {};

    // Son 7 günü düzenli al
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key  = d.toISOString().split('T')[0]; // "2026-04-03"
      const label = d.toLocaleDateString('tr-TR', { weekday: 'short' }); // "Prş"
      result.push({ key, label, count: data[key] || 0 });
    }
    return result;
  } catch { return []; }
}

async function addWeeklyWarning() {
  try {
    const json = await AsyncStorage.getItem(WEEKLY_KEY);
    const data = json ? JSON.parse(json) : {};
    const today = new Date().toISOString().split('T')[0];
    data[today] = (data[today] || 0) + 1;

    // Sadece son 30 günü sakla (temizlik)
    const keys = Object.keys(data).sort().reverse();
    const trimmed = {};
    keys.slice(0, 30).forEach(k => { trimmed[k] = data[k]; });

    await AsyncStorage.setItem(WEEKLY_KEY, JSON.stringify(trimmed));
  } catch {}
}

export async function clearStats() {
  try {
    await AsyncStorage.multiRemove([STATS_KEY, WEEKLY_KEY]);
  } catch {}
}
