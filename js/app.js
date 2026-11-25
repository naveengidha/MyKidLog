// app.js — router, nav, boot

import { renderDaily }    from './views/daily.js';
import { renderWeekly }   from './views/weekly.js';
import { renderReport }   from './views/report.js';
import { renderProfiles } from './views/profiles.js';
import { migrateIfNeeded, getProfiles, createProfile } from './store.js';

const view     = document.getElementById('view');
const navItems = document.querySelectorAll('.nav-item');

let currentView = 'daily';

export function navigate(viewName) {
  currentView = viewName;
  navItems.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  view.innerHTML = '';
  switch (viewName) {
    case 'daily':   renderDaily(view);    break;
    case 'weekly':  renderWeekly(view);   break;
    case 'report':  renderReport(view);   break;
    case 'profile': renderProfiles(view); break;
  }
}

export function getCurrentView() { return currentView; }

// Nav click
navItems.forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));

// ── Boot ───────────────────────────────────────────────────
migrateIfNeeded();

const profiles = getProfiles();

if (profiles.length === 0) {
  // First launch — show setup modal
  const modal = document.getElementById('profile-modal');
  modal.classList.remove('hidden');
  document.getElementById('profile-save').addEventListener('click', () => {
    const name = document.getElementById('profile-name').value.trim() || 'Client';
    const dob  = document.getElementById('profile-dob').value || '';
    createProfile(name, dob);
    modal.classList.add('hidden');
    navigate('daily');
  });
} else {
  navigate('daily');
}
