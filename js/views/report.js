// report.js — report view with date range picker and PDF export

import { getDaysInRange, getProfile, toDateStr } from '../store.js';
import { exportPDF } from '../lib/pdf.js';
import { CATEGORY_LABELS } from '../data.js';

export function renderReport(container) {
  container.innerHTML = buildReport('week');
  attachReportEvents(container);
}

function getRange(key) {
  const today = new Date(); today.setHours(0,0,0,0);
  const end = toDateStr(today);
  if (key === 'week') {
    const start = new Date(today); start.setDate(today.getDate() - 6);
    return { start: toDateStr(start), end, label: 'Last 7 days' };
  }
  if (key === '2week') {
    const start = new Date(today); start.setDate(today.getDate() - 13);
    return { start: toDateStr(start), end, label: 'Last 14 days' };
  }
  if (key === 'month') {
    const start = new Date(today); start.setDate(today.getDate() - 29);
    return { start: toDateStr(start), end, label: 'Last 30 days' };
  }
  return { start: end, end, label: 'Custom' };
}

function buildReport(rangeKey, customStart, customEnd) {
  const range = rangeKey === 'custom'
    ? { start: customStart, end: customEnd, label: `${customStart} to ${customEnd}` }
    : getRange(rangeKey);

  const days = getDaysInRange(range.start, range.end);
  const totalActivities = days.reduce((s, d) => s + d.activities.length, 0);
  const totalMins = days.reduce((s, d) => s + d.activities.reduce((m, a) => m + (a.duration||0), 0), 0);

  const previewRows = days.flatMap(day => {
    if (!day.activities.length && !day.dailyNote) return [];
    const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
    const rows = [];
    rows.push(`<tr class="report-day-header"><td colspan="5">${dateLabel}</td></tr>`);
    if (day.activities.length) {
      day.activities.forEach(a => {
        const cats = (a.categories||[]).map(c=>CATEGORY_LABELS[c]||c).join(', ');
        const dots = Array.from({length:5},(_,i)=>
          `<span class="energy-dot${i<(a.energy||0)?' filled':''}" style="width:8px;height:8px"></span>`
        ).join('');
        rows.push(`<tr>
          <td>${escHtml(a.name)}</td>
          <td style="font-size:12px">${escHtml(cats)}</td>
          <td style="white-space:nowrap">${fmtDur(a.duration)}</td>
          <td><span style="display:flex;gap:2px">${dots}</span></td>
          <td style="color:var(--text-muted);font-size:12px">${escHtml(a.note||'')}</td>
        </tr>`);
      });
    } else {
      rows.push(`<tr><td colspan="5" style="color:var(--text-muted);font-style:italic;font-size:12px">No activities</td></tr>`);
    }
    if (day.dailyNote) {
      rows.push(`<tr class="note-row"><td colspan="5">📝 ${escHtml(day.dailyNote)}</td></tr>`);
    }
    return rows;
  });

  const ranges = [
    { key:'week',  label:'Last 7 days' },
    { key:'2week', label:'Last 14 days' },
    { key:'month', label:'Last 30 days' },
    { key:'custom',label:'Custom' },
  ];

  const pills = ranges.map(r =>
    `<button class="range-pill${rangeKey===r.key?' selected':''}" data-range="${r.key}">${r.label}</button>`
  ).join('');

  const today = toDateStr(new Date());
  const twoWeeksAgo = (() => { const d=new Date(); d.setDate(d.getDate()-13); return toDateStr(d); })();

  return `
    <div class="view-header">
      <span class="view-title">Report</span>
    </div>

    <div class="report-section">
      <div class="section-heading">Date range</div>
      <div class="range-pills">${pills}</div>

      <div id="custom-range" style="display:${rangeKey==='custom'?'flex':'none'};gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <label class="field-label" style="flex:1;min-width:130px">From
          <input type="date" class="text-input" id="range-start" value="${customStart||twoWeeksAgo}" />
        </label>
        <label class="field-label" style="flex:1;min-width:130px">To
          <input type="date" class="text-input" id="range-end" value="${customEnd||today}" />
        </label>
        <div style="display:flex;align-items:flex-end;padding-bottom:14px">
          <button class="btn-secondary" id="apply-custom">Apply</button>
        </div>
      </div>

      <div style="display:flex;gap:16px;margin-bottom:16px">
        <div class="card" style="flex:1;margin:0;text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--primary)">${totalActivities}</div>
          <div style="font-size:12px;color:var(--text-muted)">Activities</div>
        </div>
        <div class="card" style="flex:1;margin:0;text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--primary)">${fmtDur(totalMins)}</div>
          <div style="font-size:12px;color:var(--text-muted)">Total time</div>
        </div>
      </div>

      ${previewRows.length
        ? `<div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius)">
            <table class="preview-table" style="min-width:480px">
              <thead><tr>
                <th>Activity</th><th>Categories</th><th style="white-space:nowrap">Dur.</th><th>Energy</th><th>Note</th>
              </tr></thead>
              <tbody>${previewRows.join('')}</tbody>
            </table>
          </div>`
        : `<div class="empty-state"><p>No activities logged in this period.</p></div>`
      }
    </div>

    <div class="report-section">
      <button class="btn-primary" id="export-pdf">Export PDF</button>
      <p class="text-muted" style="margin-top:8px;text-align:center;font-size:12px">
        Not a clinical document — parent-maintained activity record only.
      </p>
    </div>
  `;
}

function attachReportEvents(container) {
  let rangeKey = 'week';
  let customStart = null;
  let customEnd   = null;

  function rerender() {
    const scrollY = container.closest('main')?.scrollTop || 0;
    container.innerHTML = buildReport(rangeKey, customStart, customEnd);
    attachReportEvents(container);
    container.closest('main')?.scrollTo(0, scrollY);
  }

  container.querySelectorAll('.range-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      rangeKey = pill.dataset.range;
      rerender();
    });
  });

  container.querySelector('#apply-custom')?.addEventListener('click', () => {
    customStart = container.querySelector('#range-start').value;
    customEnd   = container.querySelector('#range-end').value;
    if (customStart && customEnd && customStart <= customEnd) rerender();
  });

  container.querySelector('#export-pdf')?.addEventListener('click', () => {
    const range = rangeKey === 'custom'
      ? { start: customStart, end: customEnd, label: `${customStart} to ${customEnd}` }
      : getRange(rangeKey);
    const days    = getDaysInRange(range.start, range.end);
    const profile = getProfile();
    exportPDF(days, profile, range.label);
  });
}

function fmtDur(m) {
  if (!m) return '0m';
  const h = Math.floor(m / 60), rem = m % 60;
  return h > 0 ? (rem > 0 ? `${h}h ${rem}m` : `${h}h`) : `${rem}m`;
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
