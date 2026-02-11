/**
 * dashboard.js — CrimeVision AI
 * Dashboard charts, stats, recent detections table rendering
 */

'use strict';

const DashboardUI = {
  charts: {},
  _refreshInterval: null,

  init() {
    this.renderStats();
    this.renderCharts();
    this.renderRecentDetections();
    this.bindEvents();
    this._startAutoRefresh();
  },

  // ---- STATS CARDS ----

  renderStats(range = '7d') {
    const stats = DetectionStore.getStats(range);

    const totalEl = document.getElementById('totalDetectionsValue');
    const criticalEl = document.getElementById('criticalAlertsValue');
    const camerasEl = document.getElementById('activeCamerasValue');
    const accuracyEl = document.getElementById('accuracyValue');

    if (totalEl) totalEl.textContent = stats.total;
    if (criticalEl) criticalEl.textContent = stats.critical;
    if (camerasEl) camerasEl.textContent = '1'; // Single webcam mode
    if (accuracyEl) accuracyEl.textContent = stats.avgConf ? stats.avgConf + '%' : '—%';

    const cameraSubEl = document.getElementById('activeCamerasSub');
    if (cameraSubEl) cameraSubEl.textContent = 'of 1 total';
  },

  // ---- CHARTS ----

  renderCharts() {
    this._renderTimelineChart();
    this._renderDistributionChart();
    this._renderConfidenceChart();
    this._renderHeatmapChart();
  },

  _renderTimelineChart() {
    const canvas = document.getElementById('timelineChart');
    if (!canvas) return;

    const stats = DetectionStore.getStats('7d');
    const sortedDays = Object.keys(stats.byDay).sort();

    // Fill missing days in range
    const labels = [];
    const data = [];
    if (sortedDays.length > 0) {
      const start = new Date(sortedDays[0]);
      const end = new Date(sortedDays[sortedDays.length - 1]);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        labels.push(key);
        data.push(stats.byDay[key] || 0);
      }
    } else {
      // Show last 7 days with zeros
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toISOString().split('T')[0]);
        data.push(0);
      }
    }

    if (this.charts.timeline) this.charts.timeline.destroy();

    this.charts.timeline = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels.map(l => {
          const d = new Date(l);
          return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        }),
        datasets: [{
          label: 'Detections',
          data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3b82f6',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: '#94a3b8', font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: '#94a3b8', font: { size: 11 }, stepSize: 1 },
          },
        },
      },
    });
  },

  _renderDistributionChart() {
    const canvas = document.getElementById('distributionChart');
    if (!canvas) return;

    const stats = DetectionStore.getStats('all');
    const types = Object.keys(stats.byType);
    const labels = types.map(t => CRIME_TYPES[t]?.label || t);
    const data = types.map(t => stats.byType[t]);
    const colors = types.map(t => CRIME_TYPES[t]?.color || '#94a3b8');

    if (this.charts.distribution) this.charts.distribution.destroy();

    if (data.length === 0) {
      // Empty state
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', canvas.width / 2, canvas.height / 2);
      return;
    }

    this.charts.distribution = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: 'rgba(15, 23, 42, 0.8)',
          borderWidth: 2,
          hoverBorderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', padding: 12, font: { size: 11 } },
          },
        },
      },
    });
  },

  _renderConfidenceChart() {
    const canvas = document.getElementById('confidenceChart');
    if (!canvas) return;

    const stats = DetectionStore.getStats('all');
    const labels = Object.keys(stats.confDist);
    const data = Object.values(stats.confDist);
    const colors = ['#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];

    if (this.charts.confidence) this.charts.confidence.destroy();

    this.charts.confidence = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels.map(l => l + '%'),
        datasets: [{
          label: 'Detections',
          data,
          backgroundColor: colors.map(c => c + 'cc'),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: '#94a3b8', font: { size: 11 }, stepSize: 1 },
          },
        },
      },
    });
  },

  _renderHeatmapChart() {
    const canvas = document.getElementById('heatmapChart');
    if (!canvas) return;

    const stats = DetectionStore.getStats('all');
    const labels = Array.from({ length: 24 }, (_, i) => `${pad(i)}:00`);

    if (this.charts.heatmap) this.charts.heatmap.destroy();

    this.charts.heatmap = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Detections',
          data: stats.byHour,
          backgroundColor: stats.byHour.map(v => {
            if (v === 0) return 'rgba(148,163,184,0.15)';
            const intensity = Math.min(v / (Math.max(...stats.byHour) || 1), 1);
            return `rgba(239, 68, 68, ${0.2 + intensity * 0.7})`;
          }),
          borderRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 45 },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: '#94a3b8', font: { size: 11 }, stepSize: 1 },
          },
        },
      },
    });
  },

  // ---- RECENT DETECTIONS TABLE ----

  renderRecentDetections(filter = 'all') {
    const tbody = document.getElementById('recentDetectionsBody');
    const emptyRow = document.getElementById('emptyTableRow');
    if (!tbody) return;

    let recent = DetectionStore.getRecent(10);

    if (filter && filter !== 'all') {
      recent = recent.filter(d => d.crimeType === filter);
    }

    // Clear existing rows (except empty state)
    const existingRows = tbody.querySelectorAll('tr:not(#emptyTableRow)');
    existingRows.forEach(r => r.remove());

    if (recent.length === 0) {
      if (emptyRow) show(emptyRow);
      return;
    }

    if (emptyRow) hide(emptyRow);

    recent.forEach(det => {
      const crimeInfo = CRIME_TYPES[det.crimeType] || CRIME_TYPES.suspicious;
      const statusInfo = STATUS_MAP[det.status] || STATUS_MAP.new;
      const confLevel = getConfidenceLevel(det.confidence);

      const tr = document.createElement('tr');
      tr.className = 'data-table__row';
      tr.dataset.id = det.id;

      tr.innerHTML = `
        <td class="data-table__td--snap">
          <div class="table-snapshot">
            ${det.snapshot
              ? `<img src="${det.snapshot}" alt="Snapshot" class="table-snapshot__img" loading="lazy">`
              : `<div class="table-snapshot__placeholder"><i data-lucide="image-off" aria-hidden="true"></i></div>`
            }
          </div>
        </td>
        <td>
          <span class="crime-badge" style="background:${crimeInfo.color}15;color:${crimeInfo.color};border:1px solid ${crimeInfo.color}33">
            ${escapeHtml(crimeInfo.label)}
          </span>
        </td>
        <td>
          <div class="confidence-bar confidence-bar--sm">
            <div class="confidence-bar__fill" style="width:${det.confidence}%;background:${confLevel.color}"></div>
            <span class="confidence-bar__text">${Math.round(det.confidence)}%</span>
          </div>
        </td>
        <td class="data-table__td--source">${escapeHtml(det.sourceLabel || det.source)}</td>
        <td class="data-table__td--time">
          <span title="${formatDateTime(det.timestamp)}">${formatTimeAgo(det.timestamp)}</span>
        </td>
        <td>
          <span class="status-badge" style="background:${statusInfo.bg};color:${statusInfo.color}">
            ${statusInfo.label}
          </span>
        </td>
        <td class="data-table__td--actions">
          <button class="btn btn--ghost btn--xs" data-action="view" data-id="${det.id}" title="View details">
            <i data-lucide="eye" aria-hidden="true"></i>
          </button>
          <button class="btn btn--ghost btn--xs" data-action="dismiss" data-id="${det.id}" title="Dismiss">
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons({ nodes: [tbody] });
  },

  // ---- EVENTS ----

  bindEvents() {
    // Timeline range selector
    const rangeSelect = document.getElementById('timelineRange');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', () => {
        this.renderStats(rangeSelect.value);
        this._renderTimelineChart();
      });
    }

    // Detection type filter
    const typeFilter = document.getElementById('detectionTypeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', () => {
        this.renderRecentDetections(typeFilter.value);
      });
    }

    // Table action clicks
    const tbody = document.getElementById('recentDetectionsBody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'view') {
          this.showDetectionDetail(id);
        } else if (action === 'dismiss') {
          DetectionStore.update(id, { status: 'dismissed' });
          this.renderRecentDetections();
          Toast.info('Detection dismissed');
        }
      });
    }

    // Quick export
    const quickExport = document.getElementById('quickExport');
    if (quickExport) {
      quickExport.addEventListener('click', () => {
        DetectionStore.exportAll('csv');
        Toast.success('CSV exported');
      });
    }
  },

  // ---- DETECTION DETAIL MODAL ----

  showDetectionDetail(id) {
    const det = DetectionStore.getById(id);
    if (!det) return;

    const crimeInfo = CRIME_TYPES[det.crimeType] || CRIME_TYPES.suspicious;

    const els = {
      snapshot: document.getElementById('detDetailSnapshot'),
      type: document.getElementById('detDetailType'),
      confBar: document.getElementById('detDetailConfBar'),
      conf: document.getElementById('detDetailConf'),
      source: document.getElementById('detDetailSource'),
      time: document.getElementById('detDetailTime'),
      objects: document.getElementById('detDetailObjects'),
      status: document.getElementById('detDetailStatus'),
    };

    if (els.snapshot) els.snapshot.src = det.snapshot || '';
    if (els.type) {
      els.type.innerHTML = `<span class="crime-badge" style="background:${crimeInfo.color}15;color:${crimeInfo.color}">${crimeInfo.label}</span>`;
    }
    if (els.confBar) els.confBar.style.width = det.confidence + '%';
    if (els.conf) els.conf.textContent = Math.round(det.confidence) + '%';
    if (els.source) els.source.textContent = det.sourceLabel || det.source;
    if (els.time) els.time.textContent = formatDateTime(det.timestamp);
    if (els.objects) els.objects.textContent = (det.objects || []).join(', ') || 'N/A';
    if (els.status) {
      const si = STATUS_MAP[det.status] || STATUS_MAP.new;
      els.status.innerHTML = `<span class="status-badge" style="background:${si.bg};color:${si.color}">${si.label}</span>`;
    }

    // Dismiss button
    const dismissBtn = document.getElementById('detDetailDismiss');
    if (dismissBtn) {
      dismissBtn.onclick = () => {
        DetectionStore.update(id, { status: 'dismissed' });
        Modal.close('detectionDetailModal');
        this.renderRecentDetections();
        Toast.info('Detection dismissed');
      };
    }

    Modal.open('detectionDetailModal');
  },

  // ---- NOTIFICATION PANEL ----

  renderNotifications() {
    const list = document.getElementById('notificationList');
    const emptyEl = document.getElementById('emptyNotifications');
    const badge = document.getElementById('notifBadge');
    if (!list) return;

    const notifications = DetectionStore.getNotifications().slice(0, 20);
    const unread = DetectionStore.getUnreadCount();

    // Badge
    if (badge) {
      badge.textContent = unread;
      toggle(badge, unread > 0);
    }

    // Clear existing items (keep empty state)
    list.querySelectorAll('.notification-item').forEach(el => el.remove());

    if (notifications.length === 0) {
      if (emptyEl) show(emptyEl);
      return;
    }

    if (emptyEl) hide(emptyEl);

    notifications.forEach(n => {
      const crimeInfo = CRIME_TYPES[n.crimeType] || CRIME_TYPES.suspicious;
      const item = createElement('div', {
        className: `notification-item ${n.read ? '' : 'notification-item--unread'}`,
      });
      item.innerHTML = `
        <div class="notification-item__dot" style="background:${crimeInfo.color}"></div>
        <div class="notification-item__content">
          <span class="notification-item__title">${crimeInfo.label} Detected</span>
          <span class="notification-item__meta">${Math.round(n.confidence)}% — ${formatTimeAgo(n.timestamp)}</span>
        </div>
      `;
      item.addEventListener('click', () => {
        DetectionStore.markNotifRead(n.id);
        if (n.detectionId) this.showDetectionDetail(n.detectionId);
        this.renderNotifications();
      });
      list.appendChild(item);
    });
  },

  // ---- AUTO REFRESH ----

  _startAutoRefresh() {
    this._refreshInterval = setInterval(() => {
      this.renderStats();
      this.renderRecentDetections();
      this.renderNotifications();
    }, 30000); // every 30s
  },

  destroy() {
    if (this._refreshInterval) clearInterval(this._refreshInterval);
    Object.values(this.charts).forEach(c => c && c.destroy());
  },
};