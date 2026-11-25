// weekly.js — weekly view (mobile-first vertical rows)

import { getDay } from '../store.js';
import { CATEGORY_LABELS } from '../data.js';
import { navigate } from '../app.js';
import { jumpToDate } from './daily.js';
import { toDateStr } from '../store.js';
import { getWeekCoverage, countForCategory, CAT_SHORT } from '../utils/coverage.js';

const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const CAT_COLORS = {
  gross:   '#10b981', fine:    '#f59e0b', cog:     '#3b82f6',
  exec:    '#8b5cf6', comm:    '#ec4899', social:  '#06b6d4',
  emo:     '#f97316', sensory: '#84cc16', acad:    '#6366f1',
  create:  '#d946ef', life:    '#14b8a6',
};

let weekStart = getMonday(new Date());

export function renderWeekly(container) {
  container.innerHTML = buildWeekly();
  attachWeeklyEvents(container);
}

function getMonday(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function buildRing(catKey, count) {
  const color = CAT_COLORS[catKey] || '#94a3b8';
  const grey  = '#e4e7ec';
  const r = 17, cx = 22, cy = 22;
  const circumference = 2 * Math.PI * r;

  let strokeDash, strokeColor, fillColor;
  if (count === 0) {
    strokeDash  = `${circumference} ${circumference}`;
    strokeColor = grey;
    fillColor   = 'none';
  } else if (count === 1) {
    strokeDash  = `${circumference * 0.55} ${circumference}`;
    strokeColor = color;
    fillColor   = 'none';
  } else {
    strokeDash  = `${circumference} ${circumference}`;
    strokeColor = color;
    fillColor   = color + '22';
  }

  const coveredClass = count > 0 ? ' covered' : '';
  const title = `${CATEGORY_LABELS[catKey]}: ${count} activit${count === 1 ? 'y' : 'ies'} this week`;

  return `
    <div class="coverage-ring${coveredClass}" title="${title}">
      <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${grey}" stroke-width="4" fill="none"/>
        <circle cx="${cx}" cy="${cy}" r="${r}"
          stroke="${strokeColor}" stroke-width="4"
          fill="${fillColor}"
          stroke-dasharray="${strokeDash}"
          stroke-dashoffset="0"
          stroke-linecap="round"
          transform="rotate(-90 ${cx} ${cy})"
        />
        ${count >= 2
          ? `<text x="${cx}" y="${cy+1}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="${color}">${count}</text>`
          : count === 1
          ? `<circle cx="${cx}" cy="${cy}" r="3" fill="${color}"/>`
          : ''
        }
      </svg>
      <span class="coverage-ring-label">${CAT_SHORT[catKey] || catKey}</span>
    </div>
  `;
}

function buildWeekly() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const todayStr  = toDateStr(new Date());
  const weekLabel = `${days[0].toLocaleDateString('en-AU',{day:'numeric',month:'short'})} – ${days[6].toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`;

  const weekDayData = days.map(d => getDay(toDateStr(d)));
  const covered     = getWeekCoverage(weekDayData);
  const coveredCount = covered.size;

  const allRings = Object.keys(CAT_COLORS).map(key =>
    buildRing(key, countForCategory(weekDayData, key))
  );
  const rings = `
    <div class="coverage-row-line">${allRings.slice(0, 6).join('')}</div>
    <div class="coverage-row-line">${allRings.slice(6).join('')}</div>
  `;

  // Vertical rows — one per day
  const rows = days.map((d, i) => {
    const dStr    = toDateStr(d);
    const isToday = dStr === todayStr;
    const dayData = getDay(dStr);
    const count   = dayData.activities.length;
    const mins    = dayData.activities.reduce((s, a) => s + (a.duration || 0), 0);

    const chips = dayData.activities.map(a => {
      const cat = a.categories?.[0] || 'cog';
      return `<span class="week-chip chip-${cat}">${escHtml(a.name)}</span>`;
    }).join('');

    const summary = count > 0
      ? `<strong>${count}</strong> act · ${fmtDur(mins)}`
      : `<span style="color:var(--text-muted)">nothing logged</span>`;

    return `
      <div class="week-row${isToday ? ' today' : ''}" data-date="${dStr}">
        <div class="week-row-header">
          <div class="week-row-day">
            <span class="week-day-name">${DAY_NAMES[i]}</span>
            <span class="week-day-num">${d.getDate()}</span>
          </div>
          <div class="week-row-summary">${summary}</div>
        </div>
        ${count > 0
          ? `<div class="week-row-chips">${chips}</div>`
          : `<div class="week-row-empty">Tap to add activities</div>`
        }
      </div>
    `;
  }).join('');

  return `
    <div class="view-header">
      <button class="date-nav-btn" id="prev-week">&#8249;</button>
      <span class="date-label" style="font-size:14px">${weekLabel}</span>
      <button class="date-nav-btn" id="next-week">&#8250;</button>
    </div>

    <div class="coverage-section">
      <div class="coverage-heading">${coveredCount}/11 categories this week</div>
      <div class="coverage-row">${rings}</div>
    </div>

    <div class="week-rows">${rows}</div>
  `;
}

function attachWeeklyEvents(container) {
  container.querySelector('#prev-week')?.addEventListener('click', () => {
    weekStart.setDate(weekStart.getDate() - 7);
    renderWeekly(container);
  });
  container.querySelector('#next-week')?.addEventListener('click', () => {
    weekStart.setDate(weekStart.getDate() + 7);
    renderWeekly(container);
  });

  // Tap a row → jump to that day in daily view
  container.querySelectorAll('.week-row').forEach(row => {
    row.addEventListener('click', () => {
      jumpToDate(row.dataset.date);
      navigate('daily');
    });
  });
}

function fmtDur(m) {
  if (!m) return '0m';
  const h = Math.floor(m / 60), rem = m % 60;
  return h > 0 ? (rem > 0 ? `${h}h ${rem}m` : `${h}h`) : `${rem}m`;
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
