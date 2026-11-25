// profiles.js — multi-client management view

import {
  getProfiles, getActiveProfileId, setActiveProfileId,
  createProfile, updateProfile, deleteProfile
} from '../store.js';
import { navigate } from '../app.js';

export function renderProfiles(container) {
  container.innerHTML = buildProfiles();
  attachProfilesEvents(container);
}

function initials(name) {
  return (name || '?').split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function calcAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function buildProfiles() {
  const profiles   = getProfiles();
  const activeId   = getActiveProfileId();

  const cards = profiles.map(p => {
    const isActive = p.id === activeId;
    const age = calcAge(p.dob);
    return `
      <div class="profile-card${isActive ? ' active' : ''}" data-id="${p.id}">
        <div class="profile-card-left">
          <div class="profile-avatar-circle" style="background:${escHtml(p.color)}">${escHtml(initials(p.name))}</div>
          <div>
            <div class="profile-card-name">${escHtml(p.name)}</div>
            ${age !== null ? `<div class="profile-card-meta">${age} years old</div>` : ''}
            ${p.dob && age === null ? `<div class="profile-card-meta">${escHtml(p.dob)}</div>` : ''}
          </div>
        </div>
        <div class="profile-card-right">
          ${isActive ? `<span class="active-badge">Active</span>` : `<button class="btn-switch" data-id="${p.id}">Switch</button>`}
          <button class="profile-menu-btn" data-id="${p.id}" title="Edit / Delete">⋯</button>
        </div>
      </div>
      <div class="profile-edit-panel hidden" id="edit-${p.id}">
        <label class="field-label">Name
          <input type="text" class="text-input edit-name" data-id="${p.id}" value="${escHtml(p.name)}" />
        </label>
        <label class="field-label">Date of birth
          <input type="date" class="text-input edit-dob" data-id="${p.id}" value="${escHtml(p.dob || '')}" />
        </label>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn-secondary edit-save" data-id="${p.id}" style="flex:1">Save</button>
          <button class="btn-secondary edit-delete" data-id="${p.id}" style="flex:1;color:var(--danger);border-color:var(--danger)">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="view-header">
      <span class="view-title">Clients</span>
    </div>

    <div style="padding:12px 16px 0">
      ${profiles.length === 0
        ? `<p class="text-muted" style="text-align:center;padding:24px 0">No clients yet. Add your first one below.</p>`
        : cards
      }
    </div>

    <div class="divider" style="margin:16px 16px 0"></div>

    <div style="padding:0 16px 24px" id="add-client-section">
      <div class="section-heading" style="padding-top:16px">Add new client</div>
      <label class="field-label">Name
        <input type="text" class="text-input" id="new-name" placeholder="e.g. Sam" />
      </label>
      <label class="field-label">Date of birth (optional)
        <input type="date" class="text-input" id="new-dob" />
      </label>
      <button class="btn-primary" id="add-client-btn">Add client</button>
    </div>

    <div class="divider" style="margin:0 16px"></div>

    <div style="padding:16px">
      <div class="section-heading">About this app</div>
      <p class="text-muted" style="line-height:1.6">
        KidLog stores all data locally on this device. Nothing is sent to any server.
        It is not a clinical or diagnostic tool.
      </p>
    </div>
  `;
}

function attachProfilesEvents(container) {
  // Switch active client
  container.querySelectorAll('.btn-switch').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      setActiveProfileId(btn.dataset.id);
      navigate('daily');
    });
  });

  // Toggle edit panel
  container.querySelectorAll('.profile-menu-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const panel = container.querySelector(`#edit-${btn.dataset.id}`);
      panel?.classList.toggle('hidden');
    });
  });

  // Save edit
  container.querySelectorAll('.edit-save').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = container.querySelector(`.edit-name[data-id="${btn.dataset.id}"]`).value.trim();
      const dob  = container.querySelector(`.edit-dob[data-id="${btn.dataset.id}"]`).value;
      if (!name) return;
      updateProfile(btn.dataset.id, { name, dob });
      renderProfiles(container);
    });
  });

  // Delete client
  container.querySelectorAll('.edit-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const profiles = getProfiles();
      const p = profiles.find(x => x.id === btn.dataset.id);
      if (!confirm(`Delete all data for "${p?.name}"? This cannot be undone.`)) return;
      deleteProfile(btn.dataset.id);
      // If no profiles left, reload to show first-launch modal
      if (getProfiles().length === 0) { location.reload(); return; }
      renderProfiles(container);
    });
  });

  // Add new client
  container.querySelector('#add-client-btn')?.addEventListener('click', () => {
    const name = container.querySelector('#new-name').value.trim();
    if (!name) { container.querySelector('#new-name').focus(); return; }
    const dob = container.querySelector('#new-dob').value;
    createProfile(name, dob);
    import('../app.js').then(m => m.navigate('daily'));
  });
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
