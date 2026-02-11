/**
 * history.js — CrimeVision AI
 * LocalStorage CRUD for detection records
 */

'use strict';

const DetectionStore = {
  STORAGE_KEY: 'detections',
  NOTIF_KEY: 'notifications',

  // ---- DETECTIONS CRUD ----

  getAll() {
    return Storage.get(this.STORAGE_KEY, []);
  },

  getById(id) {
    return this.getAll().find(d => d.id === id) || null;
  },

  add(detection) {
    const record = {
      id: generateId(),
      crimeType: detection.crimeType || 'suspicious',
      confidence: detection.confidence || 0,
      source: detection.source || 'webcam',
      sourceLabel: detection.sourceLabel || 'Webcam',
      timestamp: detection.timestamp || new Date().toISOString(),
      snapshot: detection.snapshot || '',
      objects: detection.objects || [],
      bbox: detection.bbox || null,
      status: 'new',
      notes: '',
      ...detection,
    };
    if (!record.id.startsWith('det_')) record.id = generateId();

    const all = this.getAll();
    all.unshift(record);

    // Limit to 500 records max (to avoid localStorage overflow)
    if (all.length > 500) {
      all.length = 500;
    }

    Storage.set(this.STORAGE_KEY, all);

    // Also add a notification
    this.addNotification({
      type: 'detection',
      crimeType: record.crimeType,
      confidence: record.confidence,
      timestamp: record.timestamp,
      detectionId: record.id,
      read: false,
    });

    return record;
  },

  update(id, updates) {
    const all = this.getAll();
    const idx = all.findIndex(d => d.id === id);
    if (idx === -1) return null;
    Object.assign(all[idx], updates);
    Storage.set(this.STORAGE_KEY, all);
    return all[idx];
  },

  remove(id) {
    const all = this.getAll();
    const filtered = all.filter(d => d.id !== id);
    Storage.set(this.STORAGE_KEY, filtered);
    return filtered.length < all.length;
  },

  bulkUpdate(ids, updates) {
    const all = this.getAll();
    let count = 0;
    all.forEach(d => {
      if (ids.includes(d.id)) {
        Object.assign(d, updates);
        count++;
      }
    });
    Storage.set(this.STORAGE_KEY, all);
    return count;
  },

  bulkDelete(ids) {
    const all = this.getAll();
    const filtered = all.filter(d => !ids.includes(d.id));
    Storage.set(this.STORAGE_KEY, filtered);
    return all.length - filtered.length;
  },

  clearAll() {
    Storage.set(this.STORAGE_KEY, []);
    Storage.set(this.NOTIF_KEY, []);
  },

  // ---- FILTERING & SORTING ----

  filter(options = {}) {
    let data = this.getAll();

    // Text search
    if (options.search) {
      const q = options.search.toLowerCase();
      data = data.filter(d =>
        d.crimeType.toLowerCase().includes(q) ||
        (d.sourceLabel || '').toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.notes || '').toLowerCase().includes(q)
      );
    }

    // Crime type
    if (options.type && options.type !== 'all') {
      data = data.filter(d => d.crimeType === options.type);
    }

    // Source
    if (options.source && options.source !== 'all') {
      data = data.filter(d => d.source === options.source);
    }

    // Status
    if (options.status && options.status !== 'all') {
      data = data.filter(d => d.status === options.status);
    }

    // Date range
    if (options.dateFrom) {
      const from = new Date(options.dateFrom).getTime();
      data = data.filter(d => new Date(d.timestamp).getTime() >= from);
    }
    if (options.dateTo) {
      const to = new Date(options.dateTo).getTime() + 86400000; // End of day
      data = data.filter(d => new Date(d.timestamp).getTime() <= to);
    }

    // Confidence range
    if (options.confMin !== undefined) {
      data = data.filter(d => d.confidence >= options.confMin);
    }
    if (options.confMax !== undefined) {
      data = data.filter(d => d.confidence <= options.confMax);
    }

    // Sort
    const sortKey = options.sortBy || 'timestamp';
    const sortDir = options.sortDir || 'desc';
    data.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      if (sortKey === 'timestamp') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  },

  paginate(data, page = 1, perPage = 25) {
    const total = data.length;
    const totalPages = Math.ceil(total / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return {
      data: data.slice(start, end),
      total,
      totalPages,
      page,
      perPage,
      start: start + 1,
      end: Math.min(end, total),
    };
  },

  // ---- STATISTICS ----

  getStats(timeRange = 'all') {
    let data = this.getAll();

    // Filter by time range
    if (timeRange !== 'all') {
      const now = Date.now();
      const ranges = {
        '24h': 86400000,
        '7d': 604800000,
        '30d': 2592000000,
      };
      const ms = ranges[timeRange] || 0;
      if (ms) data = data.filter(d => now - new Date(d.timestamp).getTime() <= ms);
    }

    const total = data.length;
    const critical = data.filter(d => d.confidence >= 80).length;
    const avgConf = total > 0 ? Math.round(data.reduce((s, d) => s + d.confidence, 0) / total) : 0;

    // By type
    const byType = {};
    data.forEach(d => {
      byType[d.crimeType] = (byType[d.crimeType] || 0) + 1;
    });

    // By hour
    const byHour = new Array(24).fill(0);
    data.forEach(d => {
      const h = new Date(d.timestamp).getHours();
      byHour[h]++;
    });

    // By day
    const byDay = {};
    data.forEach(d => {
      const day = new Date(d.timestamp).toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    });

    // Confidence distribution
    const confDist = { '50-60': 0, '60-70': 0, '70-80': 0, '80-90': 0, '90-100': 0 };
    data.forEach(d => {
      if (d.confidence >= 90) confDist['90-100']++;
      else if (d.confidence >= 80) confDist['80-90']++;
      else if (d.confidence >= 70) confDist['70-80']++;
      else if (d.confidence >= 60) confDist['60-70']++;
      else confDist['50-60']++;
    });

    return { total, critical, avgConf, byType, byHour, byDay, confDist };
  },

  getRecent(limit = 10) {
    return this.getAll().slice(0, limit);
  },

  // ---- NOTIFICATIONS ----

  getNotifications() {
    return Storage.get(this.NOTIF_KEY, []);
  },

  addNotification(notif) {
    const all = this.getNotifications();
    all.unshift({
      id: 'notif_' + Date.now().toString(36),
      ...notif,
      timestamp: notif.timestamp || new Date().toISOString(),
      read: false,
    });
    if (all.length > 100) all.length = 100;
    Storage.set(this.NOTIF_KEY, all);
  },

  markNotifRead(id) {
    const all = this.getNotifications();
    const n = all.find(x => x.id === id);
    if (n) { n.read = true; Storage.set(this.NOTIF_KEY, all); }
  },

  markAllNotifsRead() {
    const all = this.getNotifications();
    all.forEach(n => n.read = true);
    Storage.set(this.NOTIF_KEY, all);
  },

  getUnreadCount() {
    return this.getNotifications().filter(n => !n.read).length;
  },

  // ---- EXPORT ----

  exportAll(format = 'json') {
    const data = this.getAll().map(d => ({
      id: d.id,
      crimeType: d.crimeType,
      confidence: d.confidence,
      source: d.source,
      sourceLabel: d.sourceLabel,
      timestamp: d.timestamp,
      status: d.status,
      notes: d.notes,
      objects: (d.objects || []).join(', '),
    }));

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    if (format === 'csv') {
      exportToCSV(data, `crimevision-detections-${ts}.csv`);
    } else {
      exportToJSON(data, `crimevision-detections-${ts}.json`);
    }
  },
};