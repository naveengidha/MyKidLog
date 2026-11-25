// store.js — all localStorage read/write, multi-profile aware

const BASE_DAYS    = 'kidlog_days';
const BASE_CUSTOM  = 'kidlog_custom';
const PROFILES_KEY = 'kidlog_profiles';
const ACTIVE_KEY   = 'kidlog_active_profile';

// ── Profile palette ────────────────────────────────────────
const PROFILE_COLORS = [
  '#4f46e5','#10b981','#f59e0b','#ec4899',
  '#06b6d4','#f97316','#8b5cf6','#14b8a6',
];

// ── Profile CRUD ───────────────────────────────────────────
export function getProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY)) || []; }
  catch { return []; }
}

export function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_KEY) || '';
}

export function setActiveProfileId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveProfile() {
  const id = getActiveProfileId();
  return getProfiles().find(p => p.id === id) || {};
}

export function createProfile(name, dob = '') {
  const profiles = getProfiles();
  const id = crypto.randomUUID().slice(0, 8);
  const color = PROFILE_COLORS[profiles.length % PROFILE_COLORS.length];
  const profile = { id, name: name || 'Client', dob, color };
  profiles.push(profile);
  saveProfiles(profiles);
  setActiveProfileId(id);
  return profile;
}

export function updateProfile(id, updates) {
  const profiles = getProfiles().map(p => p.id === id ? { ...p, ...updates } : p);
  saveProfiles(profiles);
}

export function deleteProfile(id) {
  // Remove all data keys for this profile
  localStorage.removeItem(`${BASE_DAYS}_${id}`);
  localStorage.removeItem(`${BASE_CUSTOM}_${id}`);
  const remaining = getProfiles().filter(p => p.id !== id);
  saveProfiles(remaining);
  // If deleted active, switch to first remaining
  if (getActiveProfileId() === id) {
    setActiveProfileId(remaining[0]?.id || '');
  }
}

// ── Migration: single-profile → multi-profile ─────────────
export function migrateIfNeeded() {
  if (getProfiles().length > 0) return; // already migrated
  const legacy = (() => {
    try { return JSON.parse(localStorage.getItem('kidlog_profile')) || null; }
    catch { return null; }
  })();

  if (legacy?.name) {
    // Port existing data into a namespaced profile
    const id = crypto.randomUUID().slice(0, 8);
    const profile = { id, name: legacy.name, dob: legacy.dob || '', color: PROFILE_COLORS[0] };
    saveProfiles([profile]);
    setActiveProfileId(id);
    // Move days
    const oldDays = localStorage.getItem('kidlog_days');
    if (oldDays) localStorage.setItem(`${BASE_DAYS}_${id}`, oldDays);
    // Move custom activities
    const oldCustom = localStorage.getItem('kidlog_custom_activities');
    if (oldCustom) localStorage.setItem(`${BASE_CUSTOM}_${id}`, oldCustom);
  } else {
    // Fresh install — no migration needed, app.js will trigger first-launch modal
  }
}

// ── Scoped key helper ──────────────────────────────────────
function _daysKey()   { return `${BASE_DAYS}_${getActiveProfileId()}`; }
function _customKey() { return `${BASE_CUSTOM}_${getActiveProfileId()}`; }

// ── Day / activity CRUD (profile-scoped) ──────────────────
export function getDays() {
  try { return JSON.parse(localStorage.getItem(_daysKey())) || {}; }
  catch { return {}; }
}

export function getDay(dateStr) {
  return getDays()[dateStr] || { activities: [], dailyNote: '' };
}

export function saveDay(dateStr, dayData) {
  const days = getDays();
  days[dateStr] = dayData;
  localStorage.setItem(_daysKey(), JSON.stringify(days));
}

export function addActivity(dateStr, activity) {
  const day = getDay(dateStr);
  activity.id = crypto.randomUUID();
  activity.timestamp = Date.now();
  day.activities = [...day.activities, activity];
  saveDay(dateStr, day);
  return activity;
}

export function updateActivity(dateStr, id, updates) {
  const day = getDay(dateStr);
  day.activities = day.activities.map(a => a.id === id ? { ...a, ...updates } : a);
  saveDay(dateStr, day);
}

export function deleteActivity(dateStr, id) {
  const day = getDay(dateStr);
  day.activities = day.activities.filter(a => a.id !== id);
  saveDay(dateStr, day);
}

export function saveDailyNote(dateStr, note) {
  const day = getDay(dateStr);
  day.dailyNote = note;
  saveDay(dateStr, day);
}

export function getDaysInRange(startStr, endStr) {
  const days = getDays();
  const result = [];
  const cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (cur <= end) {
    const key = toDateStr(cur);
    result.push({ date: key, ...(days[key] || { activities: [], dailyNote: '' }) });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// ── Custom activities (profile-scoped) ────────────────────
export function getCustomActivities() {
  try { return JSON.parse(localStorage.getItem(_customKey())) || []; }
  catch { return []; }
}

export function saveCustomActivity(activity) {
  const existing = getCustomActivities();
  if (existing.some(a => a.name.toLowerCase() === activity.name.toLowerCase())) return;
  existing.push(activity);
  localStorage.setItem(_customKey(), JSON.stringify(existing));
}

// ── Legacy getProfile / saveProfile shims ─────────────────
// report.js and pdf.js call these — keep them working
export function getProfile() { return getActiveProfile(); }
export function saveProfile(updates) {
  const id = getActiveProfileId();
  if (id) updateProfile(id, updates);
}

export function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}
