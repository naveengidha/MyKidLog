// daily.js — daily view

import { getDay, saveDailyNote, deleteActivity } from '../store.js';
import { CATEGORY_LABELS } from '../data.js';
import { openLogSheet } from './log.js';
import { toDateStr } from '../store.js';
import { getWeekCoverage, getMissingCategories, getSuggestionsForCategory } from '../utils/coverage.js';

// Category colours for nudge chips (matches CSS tokens)
const CAT_COLORS = {
  gross:   '#10b981', fine:    '#f59e0b', cog:     '#3b82f6',
  exec:    '#8b5cf6', comm:    '#ec4899', social:  '#06b6d4',
  emo:     '#f97316', sensory: '#84cc16', acad:    '#6366f1',
  create:  '#d946ef', life:    '#14b8a6',
};

let currentDate = new Date();
currentDate.setHours(0, 0, 0, 0);

export function renderDaily(container) {
  container.innerHTML = buildDaily();
  attachDailyEvents(container);
}

function getWeekDaysForDate(date) {
  // Get Mon–Sun containing the given date
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = (dow === 0) ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(mon);
    day.setDate(mon.getDate() + i);
    days.push(getDay(toDateStr(day)));
  }
  return days;
}

function buildNudgeBanner(isToday) {
  if (!isToday) return '';

  const weekDays = getWeekDaysForDate(currentDate);
  const covered  = getWeekCoverage(weekDays);
  const missing  = getMissingCategories(covered);

  if (missing.length === 0) {
    return `<div class="nudge-banner all-covered">
      <div class="nudge-banner-title">Great variety this week — all 11 categories covered!</div>
    </div>`;
  }

  // Only nudge when there are gaps; show up to 5 missing chips to avoid overwhelming
  const shown = missing.slice(0, 5);
  const chips = shown.map(({ key, label }) => {
    const color = CAT_COLORS[key] || '#6b7280';
    const suggestions = getSuggestionsForCategory(key).join(', ');
    return `<button class="nudge-chip" data-cat="${key}" data-label="${escHtml(label)}"
      style="color:${color};border-color:${color}"
      title="Try: ${escHtml(suggestions)}"
    >${escHtml(label)}</button>`;
  }).join('');

  const remaining = missing.length - shown.length;
  const tail = remaining > 0
    ? `<span style="font-size:12px;color:var(--text-muted);align-self:center">+${remaining} more</span>`
    : '';

  return `<div class="nudge-banner">
    <div class="nudge-banner-title">Not tried yet this week — tap a category to log one</div>
    <div class="nudge-chips">${chips}${tail}</div>
  </div>`;
}

function buildDaily() {
  const dateStr = toDateStr(currentDate);
  const day = getDay(dateStr);
  const isToday = dateStr === toDateStr(new Date());

  const dateLabel = currentDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  const activitiesHtml = day.activities.length
    ? day.activities.map(a => activityCard(a, dateStr)).join('')
    : `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>No activities logged yet.<br>Tap <strong>+</strong> to add one.</p>
      </div>`;

  return `
    <div class="view-header">
      <div class="date-nav">
        <button class="date-nav-btn" id="prev-day">&#8249;</button>
        <span class="date-label">${dateLabel}</span>
        <button class="date-nav-btn" id="next-day">&#8250;</button>
      </div>
      ${!isToday ? `<button class="today-btn" id="go-today">Today</button>` : ''}
    </div>

    ${buildNudgeBanner(isToday)}

    <div id="activity-list" style="padding-top:4px">
      ${activitiesHtml}
    </div>

    <div class="daily-note-section">
      <div class="divider"></div>
      <div class="daily-note-label">Daily note</div>
      <textarea
        class="daily-note-textarea"
        id="daily-note"
        placeholder="e.g. Still had energy left at bedtime, passed out an hour early, was distracted today…"
      >${escHtml(day.dailyNote)}</textarea>
      <div class="saved-hint" id="note-saved"></div>
    </div>

    <button class="fab" id="fab-add" aria-label="Log activity">+</button>
  `;
}

function activityCard(a, dateStr) {
  const catChips = (a.categories || [])
    .map(c => `<span class="chip chip-${c}">${CATEGORY_LABELS[c] || c}</span>`)
    .join('');
  const dots = Array.from({ length: 5 }, (_, i) =>
    `<span class="energy-dot ${i < (a.energy || 0) ? 'filled' : ''}"></span>`
  ).join('');
  return `
    <div class="card" data-id="${a.id}">
      <div class="card-row">
        <span class="card-title">${escHtml(a.name)}</span>
        <div style="display:flex;gap:4px">
          <button class="icon-btn edit-btn" data-id="${a.id}" data-date="${dateStr}" title="Edit">✏️</button>
          <button class="icon-btn danger del-btn" data-id="${a.id}" data-date="${dateStr}" title="Delete">🗑</button>
        </div>
      </div>
      <div class="card-meta">
        <span class="chip chip-duration">${fmtDur(a.duration)}</span>
        ${catChips}
        <div class="energy-dots" title="Energy: ${a.energy}/5">${dots}</div>
      </div>
      ${a.note ? `<div class="card-note">${escHtml(a.note)}</div>` : ''}
    </div>
  `;
}

function attachDailyEvents(container) {
  const dateStr = toDateStr(currentDate);

  container.querySelector('#prev-day')?.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    renderDaily(container);
  });
  container.querySelector('#next-day')?.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 1);
    renderDaily(container);
  });
  container.querySelector('#go-today')?.addEventListener('click', () => {
    currentDate = new Date(); currentDate.setHours(0,0,0,0);
    renderDaily(container);
  });

  container.querySelector('#fab-add')?.addEventListener('click', () => {
    openLogSheet(dateStr, null, () => renderDaily(container));
  });

  // Nudge chip → open log sheet pre-filtered to that category
  container.querySelectorAll('.nudge-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      openLogSheet(dateStr, { _prefillCategory: btn.dataset.cat, _prefillLabel: btn.dataset.label }, () => renderDaily(container));
    });
  });

  // Delete
  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this activity?')) {
        deleteActivity(btn.dataset.date, btn.dataset.id);
        renderDaily(container);
      }
    });
  });

  // Edit
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = getDay(btn.dataset.date);
      const act = day.activities.find(a => a.id === btn.dataset.id);
      if (act) openLogSheet(btn.dataset.date, act, () => renderDaily(container));
    });
  });

  // Daily note auto-save
  let noteTimer;
  const noteEl = container.querySelector('#daily-note');
  const hintEl = container.querySelector('#note-saved');
  noteEl?.addEventListener('input', () => {
    clearTimeout(noteTimer);
    hintEl.textContent = '';
    noteTimer = setTimeout(() => {
      saveDailyNote(toDateStr(currentDate), noteEl.value);
      hintEl.textContent = 'Saved';
      setTimeout(() => { hintEl.textContent = ''; }, 1500);
    }, 600);
  });
}

export function jumpToDate(dateStr) {
  currentDate = new Date(dateStr + 'T00:00:00');
}

function fmtDur(m) {
  if (!m) return '0m';
  const h = Math.floor(m / 60), rem = m % 60;
  return h > 0 ? (rem > 0 ? `${h}h ${rem}m` : `${h}h`) : `${rem}m`;
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
