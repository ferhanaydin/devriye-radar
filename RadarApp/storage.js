import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ALERT_DISTANCE: '@settings_alertDistance',
  SOUND_ENABLED: '@settings_soundEnabled',
  VOICE_ENABLED: '@settings_voiceEnabled',
  HAPTIC_ENABLED: '@settings_hapticEnabled',
  STATS: '@stats_data',
};

export const DEFAULT_SETTINGS = {
  alertDistance: 500,   // metre
  soundEnabled: true,
  voiceEnabled: true,
  hapticEnabled: true,
};

export async function loadSettings() {
  try {
    const [dist, sound, voice, haptic] = await Promise.all([
      AsyncStorage.getItem(KEYS.ALERT_DISTANCE),
      AsyncStorage.getItem(KEYS.SOUND_ENABLED),
      AsyncStorage.getItem(KEYS.VOICE_ENABLED),
      AsyncStorage.getItem(KEYS.HAPTIC_ENABLED),
    ]);
    return {
      alertDistance: dist ? parseInt(dist) : DEFAULT_SETTINGS.alertDistance,
      soundEnabled: sound !== null ? sound === 'true' : DEFAULT_SETTINGS.soundEnabled,
      voiceEnabled: voice !== null ? voice === 'true' : DEFAULT_SETTINGS.voiceEnabled,
      hapticEnabled: haptic !== null ? haptic === 'true' : DEFAULT_SETTINGS.hapticEnabled,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSetting(key, value) {
  const storageKey = KEYS[key];
  if (!storageKey) return;
  await AsyncStorage.setItem(storageKey, String(value));
}

// ─── İstatistikler ────────────────────────────────────────────────────────────
export async function loadStats() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STATS);
    return raw ? JSON.parse(raw) : { totalWarnings: 0, todayWarnings: 0, lastDate: null };
  } catch {
    return { totalWarnings: 0, todayWarnings: 0, lastDate: null };
  }
}

export async function incrementWarning() {
  const stats = await loadStats();
  const today = new Date().toDateString();
  const updated = {
    totalWarnings: stats.totalWarnings + 1,
    todayWarnings: stats.lastDate === today ? stats.todayWarnings + 1 : 1,
    lastDate: today,
  };
  await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(updated));
  return updated;
}
