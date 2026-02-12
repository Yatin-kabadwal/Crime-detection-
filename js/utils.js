/**
 * utils.js — CrimeVision AI
 * Global helper functions, constants, formatters, toast & modal systems
 */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const APP_NAME = 'CrimeVision AI';
const APP_VERSION = '1.0.0';
const STORAGE_PREFIX = 'cv_';

const CRIME_TYPES = {
  violence:   { label: 'Violence',            color: '#ef4444', icon: 'sword' },
  weapon_detected: { label: 'Weapon Detected',  color: '#dc2626', icon: 'alert-triangle' }, 
  theft:      { label: 'Theft',               color: '#f59e0b', icon: 'hand' },
  fighting:   { label: 'Fighting',            color: '#f97316', icon: 'swords' },
  vandalism:  { label: 'Vandalism',           color: '#8b5cf6', icon: 'hammer' },
  robbery:    { label: 'Robbery',             color: '#dc2626', icon: 'banknote' },
  suspicious: { label: 'Suspicious Activity', color: '#6366f1', icon: 'eye' },
  normal:     { label: 'Normal',              color: '#22c55e', icon: 'shield-check' },
};

const STATUS_MAP = {
  new:       { label: 'New',       color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  reviewed:  { label: 'Reviewed',  color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  dismissed: { label: 'Dismissed', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  reported:  { label: 'Reported',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
};

const DEFAULT_SETTINGS = {
  globalConfThreshold: 75,
  alertConfThreshold: 80,
  maxDetections: 20,
  frameSkip: 2,
  inputResolution: 416,
  detectViolence: true,
  detectWeapon: true,
  detectTheft: true,
  detectFighting: true,
  detectVandalism: true,
  detectRobbery: true,
  detectSuspicious: true,
  enableBrowserNotif: true,
  enableEmailAlert: false,
  enableAudioAlert: true,
  enableFlashAlert: true,
  alertCooldown: 30,
  alertVolume: 70,
  emailjsPublicKey: '',
  emailjsServiceId: '',
  emailjsTemplateId: '',
  alertRecipientEmail: '',
  alertCCEmails: '',
  theme: 'dark',
  accent: '#3b82f6',
  compactSidebar: false,
  showFPS: true,
  enableAnimations: true,
  profileName: 'Operator',
  profileEmail: '',
  profileRole: 'operator',
  profileOrg: '',
};

// ============================================================
// STORAGE HELPERS
// ============================================================
const Storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage.set failed:', e);
      return false;
    }
  },
  remove(key) {
    localStorage.removeItem(STORAGE_PREFIX + key);
  },
  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
  getUsage() {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key) && key.startsWith(STORAGE_PREFIX)) {
        total += localStorage[key].length * 2;
      }
    }
    return total;
  },
};

// ============================================================
// SETTINGS HELPERS
// ============================================================
function getSettings() {
  return { ...DEFAULT_SETTINGS, ...Storage.get('settings', {}) };
}

function getSetting(key) {
  const s = getSettings();
  return s[key] !== undefined ? s[key] : DEFAULT_SETTINGS[key];
}

function saveSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  Storage.set('settings', s);
}

function saveSettings(obj) {
  const s = getSettings();
  Object.assign(s, obj);
  Storage.set('settings', s);
}

function resetSettings() {
  Storage.set('settings', { ...DEFAULT_SETTINGS });
}

// ============================================================
// DATE / TIME FORMATTERS
// ============================================================
function formatDateTime(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return date.toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

function formatDate(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatTimeAgo(date) {
  if (!(date instanceof Date)) date = new Date(date);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(date);
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================
// ID GENERATORS
// ============================================================
function generateId() {
  return 'det_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function generateShortId() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// ============================================================
// DOM HELPERS
// ============================================================
function $(sel, parent = document) { return parent.querySelector(sel); }
function $$(sel, parent = document) { return [...parent.querySelectorAll(sel)]; }

function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') el.className = val;
    else if (key === 'textContent') el.textContent = val;
    else if (key === 'innerHTML') el.innerHTML = val;
    else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
    else el.setAttribute(key, val);
  }
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  });
  return el;
}

function show(el) { if (el) el.hidden = false; }
function hide(el) { if (el) el.hidden = true; }
function toggle(el, visible) { if (el) el.hidden = !visible; }

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      this.container = createElement('div', { id: 'toastContainer', className: 'toast-container' });
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 4000) {
    if (!this.container) this.init();
    const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
    const toast = createElement('div', { className: `toast toast--${type}`, role: 'alert' });
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="toast__icon" aria-hidden="true"></i>
      <span class="toast__message">${escapeHtml(message)}</span>
      <button class="toast__close" aria-label="Dismiss"><i data-lucide="x"></i></button>
    `;
    this.container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });
    toast.querySelector('.toast__close').addEventListener('click', () => this.dismiss(toast));
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    if (duration > 0) setTimeout(() => this.dismiss(toast), duration);
    return toast;
  },

  dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--exiting');
    setTimeout(() => toast.remove(), 300);
  },

  success(msg, dur) { return this.show(msg, 'success', dur); },
  error(msg, dur)   { return this.show(msg, 'error', dur); },
  warning(msg, dur) { return this.show(msg, 'warning', dur); },
  info(msg, dur)    { return this.show(msg, 'info', dur); },
};

// ============================================================
// MODAL HELPERS
// ============================================================
const Modal = {
  open(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (!dialog) return;
    dialog.showModal();
    document.body.classList.add('modal-open');
    if (window.lucide) lucide.createIcons({ nodes: [dialog] });
  },

  close(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (!dialog) return;
    dialog.close();
    document.body.classList.remove('modal-open');
  },

  initCloseHandlers() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-close-modal]')) {
        const dialog = e.target.closest('dialog');
        if (dialog) { dialog.close(); document.body.classList.remove('modal-open'); }
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.body.classList.remove('modal-open');
    });
  },

  confirm(title, message, confirmText = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal') || document.getElementById('confirmDeleteModal');
      if (!modal) { resolve(false); return; }
      const titleEl = modal.querySelector('.modal__title');
      const textEl = modal.querySelector('.confirm-dialog__text');
      const confirmBtn = modal.querySelector('.btn--danger');
      if (titleEl) titleEl.textContent = title;
      if (textEl) textEl.textContent = message;
      if (confirmBtn) confirmBtn.innerHTML = `<i data-lucide="alert-triangle" aria-hidden="true"></i> ${escapeHtml(confirmText)}`;
      modal.showModal();
      document.body.classList.add('modal-open');
      if (window.lucide) lucide.createIcons({ nodes: [modal] });
      const handler = () => { modal.close(); document.body.classList.remove('modal-open'); resolve(true); };
      confirmBtn.addEventListener('click', handler, { once: true });
      modal.addEventListener('close', () => { confirmBtn.removeEventListener('click', handler); resolve(false); }, { once: true });
    });
  },
};

// ============================================================
// VALIDATION HELPERS
// ============================================================
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validatePassword(pw) { return pw && pw.length >= 6; }

function showFieldError(groupId, message) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.classList.add('form-group--error');
  const errorEl = group.querySelector('.form-error');
  if (errorEl) errorEl.textContent = message;
}

function clearFieldError(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.classList.remove('form-group--error');
  const errorEl = group.querySelector('.form-error');
  if (errorEl) errorEl.textContent = '';
}

function clearAllErrors(formEl) {
  if (!formEl) return;
  formEl.querySelectorAll('.form-group--error').forEach(g => g.classList.remove('form-group--error'));
  formEl.querySelectorAll('.form-error').forEach(e => e.textContent = '');
}

// ============================================================
// SECURITY HELPERS
// ============================================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// DEBOUNCE / THROTTLE
// ============================================================
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
}

function throttle(fn, limit = 100) {
  let waiting = false;
  return function (...args) {
    if (!waiting) { fn.apply(this, args); waiting = true; setTimeout(() => { waiting = false; }, limit); }
  };
}

// ============================================================
// EXPORT HELPERS
// ============================================================
function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = createElement('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportToCSV(data, filename = 'export.csv') {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      let val = row[h] ?? '';
      val = String(val);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) val = '"' + val.replace(/"/g, '""') + '"';
      return val;
    }).join(',')
  );
  downloadFile([headers.join(','), ...rows].join('\n'), filename, 'text/csv;charset=utf-8');
}

function exportToJSON(data, filename = 'export.json') {
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

// ============================================================
// CANVAS / MEDIA HELPERS
// ============================================================
function captureVideoFrame(videoEl, maxWidth = 640) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxWidth / videoEl.videoWidth);
  canvas.width = videoEl.videoWidth * scale;
  canvas.height = videoEl.videoHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75);
}

// ============================================================
// CONFIDENCE HELPERS
// ============================================================
function getConfidenceLevel(score) {
  if (score >= 90) return { level: 'critical', label: 'Critical', color: '#ef4444' };
  if (score >= 80) return { level: 'high', label: 'High', color: '#f97316' };
  if (score >= 65) return { level: 'medium', label: 'Medium', color: '#f59e0b' };
  if (score >= 50) return { level: 'low', label: 'Low', color: '#22c55e' };
  return { level: 'safe', label: 'Safe', color: '#94a3b8' };
}

function getConfidenceColor(score) {
  if (score >= 85) return '#ef4444';
  if (score >= 70) return '#f59e0b';
  if (score >= 50) return '#22c55e';
  return '#94a3b8';
}

// ============================================================
// CLOCK
// ============================================================
function startClock(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const update = () => {
    el.textContent = new Date().toLocaleString('en-IN', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
  };
  update();
  setInterval(update, 1000);
}

// ============================================================
// MISC
// ============================================================
function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }