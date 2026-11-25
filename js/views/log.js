// log.js — add/edit activity bottom sheet

import { ACTIVITIES, CATEGORY_LABELS } from '../data.js';
import { addActivity, updateActivity, getCustomActivities, saveCustomActivity } from '../store.js';

let onDone = null;
let editMode = false;
let editDateStr = '';
let editId = '';

export function openLogSheet(dateStr, existingActivity, callback) {
  onDone = callback;
  // A nudge-chip prefill has _prefillCategory — treat as new log, not edit
  const isNudgePrefill = existingActivity?._prefillCategory;
  editMode    = !!existingActivity && !isNudgePrefill;
  editDateStr = dateStr;
  editId      = existingActivity?.id || '';

  const overlay = document.getElementById('log-overlay');
  const sheet   = document.getElementById('log-sheet');
  overlay.classList.remove('hidden');
  sheet.innerHTML = buildSheet(existingActivity);
  attachSheetEvents(sheet, dateStr, existingActivity);
}

function allActivities() {
  const custom = getCustomActivities().map(a => ({ ...a, custom: true }));
  return [...ACTIVITIES, ...custom];
}

function buildSheet(a) {
  const isNudge = a?._prefillCategory;
  const lib = allActivities();
  const selectedId  = (!isNudge && a) ? (lib.find(x => x.name === a.name)?.id || '') : '';
  const selectedDur = (!isNudge && a?.duration) || 30;
  const selectedEng = (!isNudge && a?.energy)   || 0;
  const noteVal     = (!isNudge && a?.note)      || '';
  // Pre-fill search with category label so the list filters automatically
  const searchVal   = isNudge ? (a._prefillLabel || '') : (a?.name || '');

  const presetDurations = [15, 30, 45, 60, 90, 120];
  const isPreset = presetDurations.includes(selectedDur);

  const durChips = presetDurations.map(d =>
    `<button class="chip-pick dur-pick${d === selectedDur ? ' selected' : ''}" data-dur="${d}">${d >= 60 ? (d/60)+'h' : d+'m'}</button>`
  ).join('');

  const engPicks = [1,2,3,4,5].map(n =>
    `<button class="energy-pick eng-pick${n <= selectedEng ? ' selected' : ''}" data-eng="${n}">${n}</button>`
  ).join('');

  const tagHtml = a ? categoryTags(a.categories || []) : '';

  return `
    <div class="sheet-header">
      <span class="sheet-title">${editMode ? 'Edit Activity' : 'Log Activity'}</span>
      <button class="close-btn" id="sheet-close">✕</button>
    </div>

    <label class="field-label">Activity
      <input type="text" class="search-input" id="act-search"
        placeholder="Search or type a custom activity…"
        value="${escHtml(searchVal)}"
        autocomplete="off" />
    </label>

    <div class="activity-list" id="act-list"></div>

    <div class="selected-activity-tags" id="cat-tags">${tagHtml}</div>

    <label class="field-label">Duration
      <div class="chip-picker" style="margin-bottom:8px">${durChips}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="number" class="text-input" id="custom-dur"
          placeholder="Other (mins)" min="1" max="480" step="5"
          value="${!isPreset && selectedDur ? selectedDur : ''}"
          style="width:140px" />
        <span style="font-size:13px;color:var(--text-muted)">or enter minutes</span>
      </div>
    </label>

    <label class="field-label">Energy level (1 = calm, 5 = very energetic)
      <div class="energy-picker">${engPicks}</div>
    </label>

    <label class="field-label">Note (optional)
      <input type="text" class="text-input" id="act-note"
        placeholder="e.g. needed lots of prompting, loved it"
        value="${escHtml(noteVal)}" />
    </label>

    <button class="btn-primary" id="sheet-save">${editMode ? 'Save changes' : 'Log activity'}</button>
  `;
}

function categoryTags(cats) {
  return cats.map(c => `<span class="chip chip-${c}">${CATEGORY_LABELS[c] || c}</span>`).join('');
}

function attachSheetEvents(sheet, dateStr, existing) {
  const isNudge = existing?._prefillCategory;
  const lib = allActivities();
  let selectedActivityId = (!isNudge && existing)
    ? (lib.find(x => x.name === existing.name)?.id || null)
    : null;
  let selectedCategories = (!isNudge && existing?.categories) || [];
  let selectedDur = (!isNudge && existing?.duration) || 30;
  let selectedEng = (!isNudge && existing?.energy)   || 0;

  const searchEl  = sheet.querySelector('#act-search');
  const listEl    = sheet.querySelector('#act-list');
  const tagsEl    = sheet.querySelector('#cat-tags');
  const customDurEl = sheet.querySelector('#custom-dur');
  const saveBtn   = sheet.querySelector('#sheet-save');

  function renderList(query) {
    const q = query.toLowerCase();
    const current = allActivities(); // re-read in case custom was just added
    const matches = current.filter(a =>
      !q || a.name.toLowerCase().includes(q) ||
      a.categories.some(c => CATEGORY_LABELS[c]?.toLowerCase().includes(q))
    );

    if (!matches.length) {
      const name = searchEl.value.trim();
      listEl.innerHTML = name
        ? `<div class="activity-option custom-hint" style="color:var(--text-muted);cursor:default;font-style:italic">
            "${escHtml(name)}" will be saved as a new custom activity
           </div>`
        : '';
      if (name) renderCategoryPicker(); else hideCategoryPicker();
      return;
    }
    hideCategoryPicker();

    listEl.innerHTML = matches.map(a =>
      `<div class="activity-option${a.id === selectedActivityId ? ' selected' : ''}" data-id="${a.id}">
        <span>${escHtml(a.name)}</span>
        ${a.custom ? '<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:8px;font-weight:600">custom</span>' : ''}
        <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${a.categories.map(c=>CATEGORY_LABELS[c]).join(', ')}</span>
      </div>`
    ).join('');
  }

  function selectActivity(id) {
    selectedActivityId = id;
    const act = allActivities().find(a => a.id === id);
    if (act) {
      selectedCategories = act.categories;
      selectedDur = act.defaultDuration || selectedDur;
      searchEl.value = act.name;
      // reflect duration in chips / custom field
      syncDurationUI(selectedDur);
    }
    tagsEl.innerHTML = categoryTags(selectedCategories);
    renderList(searchEl.value);
  }

  function syncDurationUI(dur) {
    const presets = [15,30,45,60,90,120];
    sheet.querySelectorAll('.dur-pick').forEach(b => {
      b.classList.toggle('selected', parseInt(b.dataset.dur) === dur);
    });
    if (!presets.includes(dur)) {
      customDurEl.value = dur;
    } else {
      customDurEl.value = '';
    }
  }

  function isCustomMode() {
    const name = searchEl.value.trim();
    return name && !allActivities().some(a => a.name.toLowerCase() === name.toLowerCase());
  }

  function renderCategoryPicker() {
    let picker = sheet.querySelector('#custom-cat-picker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'custom-cat-picker';
      picker.style.cssText = 'margin-bottom:14px';
      tagsEl.insertAdjacentElement('beforebegin', picker);
    }
    const chips = Object.entries(CATEGORY_LABELS).map(([key, label]) =>
      `<button class="chip-pick cat-pick${selectedCategories.includes(key) ? ' selected' : ''}" data-cat="${key}">${label}</button>`
    ).join('');
    picker.innerHTML = `
      <div class="field-label" style="margin-bottom:6px">
        Categories <span style="color:var(--danger);font-size:12px" id="cat-required-hint">${selectedCategories.length === 0 ? '(required)' : ''}</span>
        <div class="chip-picker" style="margin-top:4px">${chips}</div>
      </div>
    `;
    picker.querySelectorAll('.cat-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        if (selectedCategories.includes(cat)) {
          selectedCategories = selectedCategories.filter(c => c !== cat);
        } else {
          selectedCategories = [...selectedCategories, cat];
        }
        tagsEl.innerHTML = categoryTags(selectedCategories);
        renderCategoryPicker();
        updateSaveBtn();
      });
    });
    updateSaveBtn();
  }

  function hideCategoryPicker() {
    sheet.querySelector('#custom-cat-picker')?.remove();
    updateSaveBtn();
  }

  function updateSaveBtn() {
    saveBtn.disabled = isCustomMode() && selectedCategories.length === 0;
  }

  renderList('');
  updateSaveBtn();

  searchEl.addEventListener('input', () => {
    selectedActivityId = null;
    selectedCategories = [];
    tagsEl.innerHTML = '';
    renderList(searchEl.value);
  });

  listEl.addEventListener('click', e => {
    const opt = e.target.closest('.activity-option[data-id]');
    if (opt) selectActivity(opt.dataset.id);
  });

  // Duration preset chips
  sheet.querySelectorAll('.dur-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('.dur-pick').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedDur = parseInt(btn.dataset.dur);
      customDurEl.value = '';
    });
  });

  // Custom duration input overrides chips
  customDurEl.addEventListener('input', () => {
    const val = parseInt(customDurEl.value);
    if (val > 0) {
      sheet.querySelectorAll('.dur-pick').forEach(b => b.classList.remove('selected'));
      selectedDur = val;
    }
  });

  // Energy
  sheet.querySelectorAll('.eng-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.eng);
      selectedEng = val;
      sheet.querySelectorAll('.eng-pick').forEach(b => {
        b.classList.toggle('selected', parseInt(b.dataset.eng) <= val);
      });
    });
  });

  // Close
  sheet.querySelector('#sheet-close').addEventListener('click', closeSheet);
  document.getElementById('log-overlay').addEventListener('click', e => {
    if (e.target.id === 'log-overlay') closeSheet();
  });

  // Save
  saveBtn.addEventListener('click', () => {
    const name = searchEl.value.trim();
    if (!name) { searchEl.focus(); return; }

    // Resolve final duration
    const customVal = parseInt(customDurEl.value);
    const finalDur = (customVal > 0) ? customVal : selectedDur || 30;

    // If this is a brand-new name not in any list, persist it as a custom activity
    const isKnown = allActivities().some(a => a.name.toLowerCase() === name.toLowerCase());
    if (!isKnown) {
      saveCustomActivity({
        id: 'custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        name,
        categories: selectedCategories,
        defaultDuration: finalDur,
        custom: true,
      });
    }

    const activity = {
      name,
      categories: selectedCategories,
      duration:   finalDur,
      energy:     selectedEng,
      note:       sheet.querySelector('#act-note').value.trim(),
    };

    if (editMode) {
      updateActivity(editDateStr, editId, activity);
    } else {
      addActivity(dateStr, activity);
    }

    closeSheet();
    onDone?.();
  });
}

function closeSheet() {
  document.getElementById('log-overlay').classList.add('hidden');
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
