/**
 * app.js — CrimeVision AI
 * Main application initialization, auth, sidebar, theme, page-specific boot
 */

'use strict';

const App = {

  currentPage: null,

  // ============================================================
  // BOOT
  // ============================================================

  init() {
    this.currentPage = this._detectPage();

    // Init icons
    if (window.lucide) lucide.createIcons();

    // Init toast & modal systems
    Toast.init();
    Modal.initCloseHandlers();

    // Theme
    this._applyTheme();

    // Preloader
    this._hidePreloader();

    // Page-specific init
    switch (this.currentPage) {
      case 'login':     this._initLoginPage(); break;
      case 'dashboard': this._initDashboardPage(); break;
      case 'monitor':   this._initMonitorPage(); break;
      case 'upload':    this._initUploadPage(); break;
      case 'history':   this._initHistoryPage(); break;
      case 'settings':  this._initSettingsPage(); break;
    }

    // Common UI (sidebar, topbar, etc.) for non-login pages
    if (this.currentPage !== 'login') {
      this._checkAuth();
      this._initSidebar();
      this._initTopbar();
      this._initUserInfo();
      startClock('currentDateTime');
    }

    console.log(`${APP_NAME} v${APP_VERSION} — ${this.currentPage} page initialized`);
  },

  _detectPage() {
    const body = document.body;
    if (body.classList.contains('page-login')) return 'login';
    if (body.classList.contains('page-dashboard')) return 'dashboard';
    if (body.classList.contains('page-monitor')) return 'monitor';
    if (body.classList.contains('page-upload')) return 'upload';
    if (body.classList.contains('page-history')) return 'history';
    if (body.classList.contains('page-settings')) return 'settings';
    return 'unknown';
  },

  _hidePreloader() {
    const preloader = document.getElementById('preloader');
    if (preloader) {
      setTimeout(() => {
        preloader.classList.add('preloader--hidden');
        setTimeout(() => preloader.remove(), 500);
      }, 800);
    }
  },

  // ============================================================
  // AUTH
  // ============================================================

  _checkAuth() {
    const user = Storage.get('user', null);
    if (!user && this.currentPage !== 'login') {
      window.location.href = 'index.html';
    }
  },

  _initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const demoBtn = document.getElementById('demoAccessBtn');
    const registerLink = document.getElementById('registerLink');
    const forgotLink = document.getElementById('forgotPasswordLink');
    const togglePw = document.getElementById('togglePassword');

    // Password visibility toggle
    if (togglePw) {
      togglePw.addEventListener('click', () => {
        const input = document.getElementById('loginPassword');
        const icon = document.getElementById('eyeIcon');
        if (input.type === 'password') {
          input.type = 'text';
          icon.setAttribute('data-lucide', 'eye-off');
        } else {
          input.type = 'password';
          icon.setAttribute('data-lucide', 'eye');
        }
        if (window.lucide) lucide.createIcons({ nodes: [togglePw] });
      });
    }

    // Login form
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearAllErrors(loginForm);

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        let valid = true;

        if (!email || !validateEmail(email)) {
          showFieldError('emailGroup', 'Please enter a valid email address');
          valid = false;
        }
        if (!password || !validatePassword(password)) {
          showFieldError('passwordGroup', 'Password must be at least 6 characters');
          valid = false;
        }

        if (!valid) return;

        // Check stored users or create first user
        const users = Storage.get('users', []);
        let user = users.find(u => u.email === email);

        if (user) {
          if (user.password !== password) {
            showFieldError('passwordGroup', 'Incorrect password');
            return;
          }
        } else {
          // Auto-register
          user = { email, password, name: email.split('@')[0], role: 'operator' };
          users.push(user);
          Storage.set('users', users);
        }

        // Save session
        Storage.set('user', { email: user.email, name: user.name, role: user.role });

        // Button loading state
        const btn = document.getElementById('loginBtn');
        btn.classList.add('btn--loading');

        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 600);
      });
    }

    // Demo access
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        Storage.set('user', { email: 'demo@crimevision.ai', name: 'Demo User', role: 'operator' });

        // Seed some demo data
        this._seedDemoData();

        demoBtn.classList.add('btn--loading');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 500);
      });
    }

    // Register modal
    if (registerLink) {
      registerLink.addEventListener('click', (e) => {
        e.preventDefault();
        Modal.open('registerModal');
      });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const role = document.getElementById('regRole').value;

        if (!name || !email || !password || !role) {
          Toast.error('Please fill all required fields');
          return;
        }

        const users = Storage.get('users', []);
        if (users.find(u => u.email === email)) {
          Toast.error('Email already registered');
          return;
        }

        users.push({ name, email, password, role });
        Storage.set('users', users);
        Modal.close('registerModal');
        Toast.success('Account created! You can now sign in.');

        document.getElementById('loginEmail').value = email;
      });
    }

    // Forgot password modal
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        Modal.open('forgotPasswordModal');
      });
    }

    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
      forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        Modal.close('forgotPasswordModal');
        Toast.info('If this email exists, a reset link has been sent.');
      });
    }
  },

  _seedDemoData() {
    if (DetectionStore.getAll().length > 0) return;

    const types = ['violence', 'theft', 'fighting', 'robbery', 'suspicious', 'vandalism'];
    const sources = ['webcam', 'upload'];
    const now = Date.now();

    for (let i = 0; i < 25; i++) {
      const ts = new Date(now - Math.random() * 7 * 86400000);
      DetectionStore.add({
        crimeType: types[Math.floor(Math.random() * types.length)],
        confidence: 55 + Math.floor(Math.random() * 40),
        source: sources[Math.floor(Math.random() * sources.length)],
        sourceLabel: sources[Math.floor(Math.random() * sources.length)] === 'webcam' ? 'Webcam' : 'Uploaded Video',
        timestamp: ts.toISOString(),
        objects: ['person'],
        status: ['new', 'reviewed', 'dismissed'][Math.floor(Math.random() * 3)],
      });
    }
  },

  // ============================================================
  // SIDEBAR
  // ============================================================

  _initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');

    // Desktop toggle
    if (toggle) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar--collapsed');
        const isCollapsed = sidebar.classList.contains('sidebar--collapsed');
        saveSetting('compactSidebar', isCollapsed);

        const icon = document.getElementById('sidebarToggleIcon');
        if (icon) {
          icon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
          if (window.lucide) lucide.createIcons({ nodes: [toggle] });
        }
      });

      // Apply saved state
      if (getSetting('compactSidebar')) {
        sidebar.classList.add('sidebar--collapsed');
      }
    }

    // Mobile menu
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('sidebar--mobile-open');
        if (overlay) show(overlay);
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('sidebar--mobile-open');
        hide(overlay);
      });
    }

    // Logout
    const logoutBtns = $$('#logoutBtn, #dropdownLogout');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        Storage.remove('user');
        window.location.href = 'index.html';
      });
    });
  },

  // ============================================================
  // TOPBAR
  // ============================================================

  _initTopbar() {
    // Theme toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = getSetting('theme');
        const next = current === 'dark' ? 'light' : 'dark';
        saveSetting('theme', next);
        this._applyTheme();
      });
    }

    // Fullscreen
    const fsBtn = document.getElementById('fullscreenBtn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen();
        }
      });
    }

    // User dropdown
    const dropdownBtn = document.getElementById('userDropdownBtn');
    const dropdownMenu = document.getElementById('userDropdownMenu');
    if (dropdownBtn && dropdownMenu) {
      dropdownBtn.addEventListener('click', () => {
        const isOpen = !dropdownMenu.hidden;
        dropdownMenu.hidden = isOpen;
        dropdownBtn.setAttribute('aria-expanded', !isOpen);
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#userDropdown')) {
          dropdownMenu.hidden = true;
          dropdownBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Notification panel
    const notifBtn = document.getElementById('notificationBtn');
    const notifPanel = document.getElementById('notificationPanel');
    const closeNotif = document.getElementById('closeNotifPanel');
    const markAllRead = document.getElementById('markAllReadBtn');

    if (notifBtn && notifPanel) {
      notifBtn.addEventListener('click', () => {
        const isOpen = !notifPanel.hidden;
        notifPanel.hidden = isOpen;
        if (!isOpen && typeof DashboardUI !== 'undefined') DashboardUI.renderNotifications();
      });
    }
    if (closeNotif) closeNotif.addEventListener('click', () => hide(notifPanel));
    if (markAllRead) {
      markAllRead.addEventListener('click', () => {
        DetectionStore.markAllNotifsRead();
        if (typeof DashboardUI !== 'undefined') DashboardUI.renderNotifications();
        Toast.success('All notifications marked as read');
      });
    }

    // Quick actions FAB
    const fabBtn = document.getElementById('quickActionsBtn');
    const fabMenu = document.getElementById('quickActionsMenu');
    if (fabBtn && fabMenu) {
      fabBtn.addEventListener('click', () => {
        const open = !fabMenu.hidden;
        fabMenu.hidden = open;
        fabBtn.setAttribute('aria-expanded', !open);
        fabBtn.classList.toggle('quick-actions__main--open', !open);
      });
    }
  },

  _initUserInfo() {
    const user = Storage.get('user', { name: 'Operator', role: 'operator' });

    const nameEls = $$('#userName, #dropdownUserName');
    const roleEls = $$('#userRole');
    const emailEls = $$('#dropdownUserEmail');

    nameEls.forEach(el => el.textContent = user.name || 'Operator');
    roleEls.forEach(el => el.textContent = user.role || 'Surveillance');
    emailEls.forEach(el => el.textContent = user.email || '');
  },

  // ============================================================
  // THEME
  // ============================================================

  _applyTheme() {
    let theme = getSetting('theme');
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);

    // Update icon
    const icon = document.getElementById('themeIcon');
    if (icon) {
      icon.setAttribute('data-lucide', theme === 'dark' ? 'moon' : 'sun');
      if (window.lucide) lucide.createIcons({ nodes: [icon.parentElement] });
    }

    // Accent color
    const accent = getSetting('accent');
    if (accent) document.documentElement.style.setProperty('--accent', accent);
  },

  // ============================================================
  // PAGE: DASHBOARD
  // ============================================================

  _initDashboardPage() {
    DashboardUI.init();
    DashboardUI.renderNotifications();
  },

  // ============================================================
  // PAGE: LIVE MONITOR
  // ============================================================

  _initMonitorPage() {
    const videoEl = document.getElementById('videoFeed');
    const canvasEl = document.getElementById('detectionCanvas');
    const modelLoader = document.getElementById('modelLoader');
    const monitorLayout = document.getElementById('monitorLayout');

    let sessionDetections = 0;
    let sessionAlerts = 0;
    let sessionConfSum = 0;
    let isDetecting = false;

    // ---- Camera select ----
    VideoManager.populateCameraSelect('cameraSelect');

    // ---- Model loading ----
    const loadModels = async () => {
      try {
        await DetectionEngine.loadModel((step, status) => {
          const stepEl = document.getElementById(
            step === 'tfjs' ? 'stepTFJS' :
            step === 'coco' ? 'stepCOCO' : 'stepClassifier'
          );
          if (stepEl) {
            stepEl.classList.toggle('model-loader__step--done', status === 'ready');
            stepEl.classList.toggle('model-loader__step--loading', status === 'loading');
          }
          const pct = step === 'tfjs' ? 20 : step === 'coco' ? 70 : 100;
          const bar = document.getElementById('modelLoadProgress');
          const pctEl = document.getElementById('modelLoadPercent');
          if (bar) bar.style.width = pct + '%';
          if (pctEl) pctEl.textContent = pct + '%';

          // Update status bar
          if (step === 'coco' && status === 'ready') {
            const dot = document.getElementById('cocoStatusDot');
            const text = document.getElementById('cocoStatusText');
            if (dot) dot.className = 'model-status-bar__dot model-status-bar__dot--online';
            if (text) text.textContent = 'Ready';
          }
        });

        // Show monitor layout
        if (modelLoader) hide(modelLoader);
        if (monitorLayout) show(monitorLayout);
        Toast.success('AI models loaded successfully');
      } catch (err) {
        Toast.error('Failed to load AI models: ' + err.message);
        const subtitle = document.querySelector('.model-loader__subtitle');
        if (subtitle) subtitle.textContent = 'Error: ' + err.message;
      }
    };
    loadModels();

    // ---- Canvas annotator ----
    CanvasAnnotator.init(canvasEl);

    // ---- Detection callback ----
    DetectionEngine.onDetection = (predictions, frameData) => {
      // Resize canvas to match video
      if (videoEl.videoWidth && videoEl.videoHeight) {
        CanvasAnnotator.resize(videoEl.videoWidth, videoEl.videoHeight);
      }

      // Classify
      const classification = CrimeClassifier.classify(predictions, {
        width: frameData.width,
        height: frameData.height,
      });

      // Draw annotations
      CanvasAnnotator.drawDetections(predictions, classification);

      // Update object list
      this._updateObjectList(predictions);

      // Update session frames count
      const framesEl = document.getElementById('sessionFrames');
      if (framesEl) framesEl.textContent = DetectionEngine.totalFramesAnalyzed;

      // Handle crime detection
      if (classification.crimeType !== 'normal' && classification.confidence >= getSetting('globalConfThreshold')) {
        sessionDetections++;
        sessionConfSum += classification.confidence;

        const det = document.getElementById('sessionDetections');
        if (det) det.textContent = sessionDetections;

        const avgEl = document.getElementById('sessionAvgConf');
        if (avgEl) avgEl.textContent = Math.round(sessionConfSum / sessionDetections) + '%';

        // Update status display
        this._updateDetectionStatus(classification, true);

        // Show current detection card
        this._showCurrentDetection(classification, predictions);

        // Update threat gauge
        this._updateThreatGauge(classification.confidence);

        // Log event
        this._addEventLog(classification);

        // Store detection
        const snapshot = captureVideoFrame(videoEl, 320);
        DetectionStore.add({
          crimeType: classification.crimeType,
          confidence: classification.confidence,
          source: 'webcam',
          sourceLabel: 'Webcam',
          objects: classification.objects,
          snapshot,
        });

        // Trigger alert
        AlertSystem.triggerAlert({
          crimeType: classification.crimeType,
          confidence: classification.confidence,
          source: 'webcam',
          sourceLabel: 'Webcam',
          timestamp: new Date().toISOString(),
        }).then(result => {
          if (result.triggered) sessionAlerts++;
          const alertEl = document.getElementById('sessionAlerts');
          if (alertEl) alertEl.textContent = sessionAlerts;
        });
      } else {
        this._updateDetectionStatus(classification, false);
        this._updateThreatGauge(0);
      }
    };

    DetectionEngine.onFPSUpdate = (fps) => {
      const fpsEl = document.getElementById('fpsDisplay');
      const fpsCounter = document.getElementById('fpsCounter');
      if (fpsEl) fpsEl.textContent = fps + ' FPS';
      if (fpsCounter) fpsCounter.textContent = fps;
    };

    // ---- Camera start/stop ----
    const startBtn = document.getElementById('startCameraBtn');
    const toggleDetBtn = document.getElementById('toggleDetectionBtn');
    const cameraSelect = document.getElementById('cameraSelect');
    const screenshotBtn = document.getElementById('screenshotBtn');
    const recordBtn = document.getElementById('recordBtn');
    const confSlider = document.getElementById('confidenceSlider');
    const confValue = document.getElementById('confidenceValue');
    const placeholder = document.getElementById('videoPlaceholder');

    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        if (VideoManager.isStreaming) {
          VideoManager.stopCamera();
          DetectionEngine.stopDetectionLoop();
          isDetecting = false;
          startBtn.innerHTML = '<i data-lucide="play" aria-hidden="true"></i><span>Start Camera</span>';
          if (toggleDetBtn) { toggleDetBtn.disabled = true; toggleDetBtn.innerHTML = '<i data-lucide="scan" aria-hidden="true"></i><span>Start Detection</span>'; }
          if (screenshotBtn) screenshotBtn.disabled = true;
          if (recordBtn) recordBtn.disabled = true;
          if (placeholder) show(placeholder);
          CanvasAnnotator.clear();

          const dot = document.getElementById('sourceStatusDot');
          const label = document.getElementById('sourceLabel');
          if (dot) dot.className = 'monitor-video__source-dot';
          if (label) label.textContent = 'No Source';

          if (window.lucide) lucide.createIcons({ nodes: [startBtn, toggleDetBtn] });
          Toast.info('Camera stopped');
          return;
        }

        try {
          const deviceId = cameraSelect ? cameraSelect.value : null;
          await VideoManager.startCamera(videoEl, deviceId || undefined);

          if (placeholder) hide(placeholder);
          startBtn.innerHTML = '<i data-lucide="square" aria-hidden="true"></i><span>Stop Camera</span>';
          if (toggleDetBtn) toggleDetBtn.disabled = false;
          if (screenshotBtn) screenshotBtn.disabled = false;
          if (recordBtn) recordBtn.disabled = false;

          const dot = document.getElementById('sourceStatusDot');
          const label = document.getElementById('sourceLabel');
          const resEl = document.getElementById('resolutionDisplay');
          if (dot) dot.className = 'monitor-video__source-dot monitor-video__source-dot--active';
          if (label) label.textContent = 'Webcam Active';
          const info = VideoManager.getStreamInfo();
          if (resEl && info) resEl.textContent = `${info.width}×${info.height}`;

          // Uptime counter
          setInterval(() => {
            const uptimeEl = document.getElementById('uptimeDisplay');
            if (uptimeEl && VideoManager.isStreaming) uptimeEl.textContent = VideoManager.getUptimeFormatted();
          }, 1000);

          if (window.lucide) lucide.createIcons({ nodes: [startBtn] });
          Toast.success('Camera started');
        } catch (err) {
          Toast.error(err.message);
        }
      });
    }

    // Start/stop detection
    if (toggleDetBtn) {
      toggleDetBtn.addEventListener('click', () => {
        if (isDetecting) {
          DetectionEngine.stopDetectionLoop();
          isDetecting = false;
          toggleDetBtn.innerHTML = '<i data-lucide="scan" aria-hidden="true"></i><span>Start Detection</span>';
          CanvasAnnotator.clear();
          Toast.info('Detection stopped');
        } else {
          const skip = getSetting('frameSkip');
          const threshold = confSlider ? parseInt(confSlider.value) : getSetting('globalConfThreshold');
          DetectionEngine.startDetectionLoop(videoEl, canvasEl, { frameSkip: skip, confThreshold: threshold });
          isDetecting = true;
          toggleDetBtn.innerHTML = '<i data-lucide="scan" aria-hidden="true"></i><span>Stop Detection</span>';
          Toast.success('Detection started');
        }
        if (window.lucide) lucide.createIcons({ nodes: [toggleDetBtn] });
      });
    }

    // Confidence slider
    if (confSlider && confValue) {
      confSlider.addEventListener('input', () => {
        confValue.textContent = confSlider.value + '%';
      });
    }

    // Screenshot
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => {
        const shot = VideoManager.takeScreenshot(videoEl, canvasEl);
        if (!shot) { Toast.error('Cannot capture screenshot'); return; }

        const preview = document.getElementById('screenshotPreview');
        const tsEl = document.getElementById('screenshotTimestamp');
        const resEl = document.getElementById('screenshotResolution');
        if (preview) preview.src = shot.dataUrl;
        if (tsEl) tsEl.textContent = formatDateTime(shot.timestamp);
        if (resEl) resEl.textContent = `${shot.width}×${shot.height}`;

        const dlBtn = document.getElementById('downloadScreenshot');
        if (dlBtn) {
          dlBtn.onclick = () => VideoManager.downloadScreenshot(shot.dataUrl);
        }

        Modal.open('screenshotModal');
      });
    }

    // Recording
    if (recordBtn) {
      recordBtn.addEventListener('click', () => {
        const indicator = document.getElementById('recordingIndicator');
        if (VideoManager.isRecording) {
          VideoManager.stopRecording();
          if (indicator) hide(indicator);
          recordBtn.innerHTML = '<i data-lucide="circle" aria-hidden="true"></i>';
          Toast.info('Recording saved');
        } else {
          if (VideoManager.startRecording()) {
            if (indicator) show(indicator);
            recordBtn.innerHTML = '<i data-lucide="circle" aria-hidden="true" style="color:#ef4444"></i>';
            Toast.success('Recording started');
          } else {
            Toast.error('Recording not supported');
          }
        }
        if (window.lucide) lucide.createIcons({ nodes: [recordBtn] });
      });
    }

    // Panel tabs
    this._initPanelTabs();

    // Alert system init
    AlertSystem.init();
    AlertSystem.requestPermission();
  },

  _updateDetectionStatus(classification, isCrime) {
    const iconContainer = document.getElementById('statusIconContainer');
    const statusText = document.getElementById('statusText');
    const statusSub = document.getElementById('statusSubtext');
    const statusIcon = document.getElementById('statusIcon');

    if (isCrime) {
      const crimeInfo = CRIME_TYPES[classification.crimeType] || CRIME_TYPES.suspicious;
      if (iconContainer) iconContainer.className = 'monitor-panel__status-icon monitor-panel__status-icon--danger';
      if (statusIcon) statusIcon.setAttribute('data-lucide', 'alert-triangle');
      if (statusText) statusText.textContent = crimeInfo.label + ' Detected';
      if (statusSub) statusSub.textContent = `${classification.confidence}% confidence`;
    } else {
      if (iconContainer) iconContainer.className = 'monitor-panel__status-icon monitor-panel__status-icon--safe';
      if (statusIcon) statusIcon.setAttribute('data-lucide', 'shield-check');
      if (statusText) statusText.textContent = 'All Clear';
      if (statusSub) statusSub.textContent = 'No threats detected';
    }
    if (window.lucide && iconContainer) lucide.createIcons({ nodes: [iconContainer] });
  },

  _showCurrentDetection(classification, predictions) {
    const card = document.getElementById('currentDetectionCard');
    if (!card) return;
    show(card);

    const crimeInfo = CRIME_TYPES[classification.crimeType] || CRIME_TYPES.suspicious;
    const typeEl = document.getElementById('currentCrimeType');
    const confEl = document.getElementById('currentConfidence');
    const timeEl = document.getElementById('currentDetTime');
    const objEl = document.getElementById('currentDetObjects');

    if (typeEl) { typeEl.textContent = crimeInfo.label; typeEl.style.background = crimeInfo.color; }
    if (confEl) confEl.textContent = classification.confidence + '%';
    if (timeEl) timeEl.textContent = formatTime(new Date());
    if (objEl) objEl.textContent = classification.objects.join(', ');
  },

  _updateThreatGauge(confidence) {
    const fill = document.getElementById('threatGaugeFill');
    if (fill) {
      fill.style.width = confidence + '%';
      if (confidence >= 80) fill.style.background = '#ef4444';
      else if (confidence >= 60) fill.style.background = '#f59e0b';
      else if (confidence >= 40) fill.style.background = '#22c55e';
      else fill.style.background = '#94a3b8';
    }
  },

  _updateObjectList(predictions) {
    const list = document.getElementById('objectList');
    if (!list) return;

    if (!predictions || predictions.length === 0) {
      list.innerHTML = '<div class="object-list__empty"><i data-lucide="box" aria-hidden="true"></i><p>No objects in frame</p></div>';
      if (window.lucide) lucide.createIcons({ nodes: [list] });
      return;
    }

    list.innerHTML = predictions.map(p => `
      <div class="object-list__item">
        <span class="object-list__name">${escapeHtml(p.class)}</span>
        <span class="object-list__score" style="color:${getConfidenceColor(p.score * 100)}">${Math.round(p.score * 100)}%</span>
      </div>
    `).join('');
  },

  _addEventLog(classification) {
    const log = document.getElementById('eventLog');
    if (!log) return;

    // Remove empty state
    const empty = log.querySelector('.event-log__empty');
    if (empty) empty.remove();

    const crimeInfo = CRIME_TYPES[classification.crimeType] || CRIME_TYPES.suspicious;
    const entry = createElement('div', { className: 'event-log__entry' });
    entry.innerHTML = `
      <span class="event-log__time">${formatTime(new Date())}</span>
      <span class="event-log__badge" style="color:${crimeInfo.color}">${crimeInfo.label}</span>
      <span class="event-log__conf">${classification.confidence}%</span>
    `;
    log.prepend(entry);

    // Limit entries
    while (log.children.length > 50) log.removeChild(log.lastChild);
  },

  _initPanelTabs() {
    const tabs = $$('.monitor-panel__tab');
    const panels = $$('.monitor-panel__content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => { t.classList.remove('monitor-panel__tab--active'); t.setAttribute('aria-selected', 'false'); });
        panels.forEach(p => hide(p));

        tab.classList.add('monitor-panel__tab--active');
        tab.setAttribute('aria-selected', 'true');

        const panelId = tab.getAttribute('aria-controls');
        const panel = document.getElementById(panelId);
        if (panel) show(panel);
      });
    });
  },

  // ============================================================
  // PAGE: UPLOAD & ANALYZE
  // ============================================================

  _initUploadPage() {
    const dropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('videoFileInput');
    const dropzoneContent = document.getElementById('dropzoneContent');
    const dropzoneSelected = document.getElementById('dropzoneSelected');
    const uploadOptions = document.getElementById('uploadOptions');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const startAnalysisBtn = document.getElementById('startAnalysisBtn');
    const uploadSection = document.getElementById('uploadSection');
    const analysisProgress = document.getElementById('analysisProgress');
    const analysisResults = document.getElementById('analysisResults');
    const uploadedVideo = document.getElementById('uploadedVideo');
    const uploadCanvas = document.getElementById('uploadCanvas');

    let selectedFile = null;

    // Drag & drop
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('upload-dropzone--active'); });
      });
      ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('upload-dropzone--active'); });
      });
      dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) handleFileSelect(file);
        else Toast.error('Please drop a valid video file');
      });
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter') fileInput.click(); });
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
      });
    }

    function handleFileSelect(file) {
      selectedFile = file;
      hide(dropzoneContent);
      show(dropzoneSelected);
      show(uploadOptions);

      document.getElementById('selectedFileName').textContent = file.name;
      document.getElementById('selectedFileSize').textContent = formatBytes(file.size);
    }

    if (removeFileBtn) {
      removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFile = null;
        fileInput.value = '';
        show(dropzoneContent);
        hide(dropzoneSelected);
        hide(uploadOptions);
      });
    }

    // Confidence slider
    const confSlider = document.getElementById('uploadConfThreshold');
    const confValue = document.getElementById('uploadConfValue');
    if (confSlider && confValue) {
      confSlider.addEventListener('input', () => confValue.textContent = confSlider.value + '%');
    }

    // Start analysis
    if (startAnalysisBtn) {
      startAnalysisBtn.addEventListener('click', async () => {
        if (!selectedFile) { Toast.error('Please select a video file'); return; }

        // Load model if needed
        if (!DetectionEngine.isLoaded) {
          Toast.info('Loading AI models...');
          try {
            await DetectionEngine.loadModel();
          } catch (e) {
            Toast.error('Failed to load AI models');
            return;
          }
        }

        // Load video
        try {
          await VideoManager.loadVideoFile(selectedFile, uploadedVideo);
        } catch (e) {
          Toast.error('Failed to load video: ' + e.message);
          return;
        }

        // Switch to progress view
        hide(uploadSection);
        show(analysisProgress);

        const mode = document.getElementById('analysisMode').value;
        const threshold = parseInt(confSlider.value);
        const startTime = Date.now();

        try {
          const result = await DetectionEngine.analyzeVideoFile(uploadedVideo, {
            mode,
            confThreshold: threshold,
            onProgress: (pct, frames, dets, currentTime, total) => {
              const fill = document.getElementById('analysisProgressFill');
              const pctEl = document.getElementById('analysisPercent');
              const framesEl = document.getElementById('analysisFrames');
              const detsEl = document.getElementById('analysisDetections');
              const elapsedEl = document.getElementById('analysisElapsed');
              const etaEl = document.getElementById('analysisETA');

              if (fill) fill.style.width = pct + '%';
              if (pctEl) pctEl.textContent = Math.round(pct) + '%';
              if (framesEl) framesEl.textContent = frames;
              if (detsEl) detsEl.textContent = dets;

              const elapsed = (Date.now() - startTime) / 1000;
              if (elapsedEl) elapsedEl.textContent = formatDuration(elapsed);
              if (etaEl && pct > 5) {
                const remaining = (elapsed / pct) * (100 - pct);
                etaEl.textContent = formatDuration(remaining);
              }
            },
            onFrameDetection: (det) => {
              // Classify for storage
              const classification = CrimeClassifier.classify(
                [{ class: det.objects[0] || 'person', score: det.confidence / 100, bbox: det.bbox }]
              );
              if (classification.crimeType !== 'normal') {
                DetectionStore.add({
                  crimeType: classification.crimeType,
                  confidence: det.confidence,
                  source: 'upload',
                  sourceLabel: selectedFile.name,
                  snapshot: det.snapshot,
                  objects: det.objects,
                });
              }
            },
          });

          // Show results
          hide(analysisProgress);
          show(analysisResults);
          this._renderAnalysisResults(result, selectedFile.name);
          Toast.success('Analysis complete!');
        } catch (e) {
          Toast.error('Analysis failed: ' + e.message);
          show(uploadSection);
          hide(analysisProgress);
        }
      });
    }

    // Pause/Stop controls
    const pauseBtn = document.getElementById('pauseAnalysisBtn');
    const stopBtn = document.getElementById('stopAnalysisBtn');
    let isPaused = false;

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        DetectionEngine.isRunning = !isPaused;
        pauseBtn.innerHTML = isPaused
          ? '<i data-lucide="play" aria-hidden="true"></i><span>Resume</span>'
          : '<i data-lucide="pause" aria-hidden="true"></i><span>Pause</span>';
        if (window.lucide) lucide.createIcons({ nodes: [pauseBtn] });
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        DetectionEngine.isRunning = false;
      });
    }

    // New analysis button
    const newBtn = document.getElementById('newAnalysisBtn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        hide(analysisResults);
        show(uploadSection);
        selectedFile = null;
        fileInput.value = '';
        show(dropzoneContent);
        hide(dropzoneSelected);
        hide(uploadOptions);
      });
    }

    // Export results
    const exportBtn = document.getElementById('exportResultsBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        DetectionStore.exportAll('csv');
        Toast.success('Results exported');
      });
    }
  },

  _renderAnalysisResults(result, filename) {
    const subtitle = document.getElementById('resultsSubtitle');
    if (subtitle) subtitle.textContent = `${filename} — Analyzed in ${formatDuration(result.elapsed)}`;

    const totalFrames = document.getElementById('resultTotalFrames');
    const totalDets = document.getElementById('resultTotalDetections');
    const duration = document.getElementById('resultDuration');
    const avgConf = document.getElementById('resultAvgConf');

    if (totalFrames) totalFrames.textContent = result.totalFrames;
    if (totalDets) totalDets.textContent = result.totalDetections;
    if (duration) duration.textContent = formatDuration(result.duration);
    if (avgConf) avgConf.textContent = result.avgConfidence + '%';
  },

  // ============================================================
  // PAGE: HISTORY
  // ============================================================

  _initHistoryPage() {
    let currentPage = 1;
    let currentPerPage = 25;
    let currentSort = { key: 'timestamp', dir: 'desc' };
    let selectedIds = new Set();

    const renderTable = () => {
      const filters = this._getHistoryFilters();
      const filtered = DetectionStore.filter({ ...filters, sortBy: currentSort.key, sortDir: currentSort.dir });
      const paged = DetectionStore.paginate(filtered, currentPage, currentPerPage);

      // Update count
      const countEl = document.getElementById('historyCount');
      if (countEl) countEl.textContent = `${paged.total} records`;

      const tbody = document.getElementById('historyTableBody');
      const emptyState = document.getElementById('historyEmptyState');
      if (!tbody) return;

      tbody.innerHTML = '';
      selectedIds.clear();
      this._updateBulkActions(selectedIds);

      if (paged.data.length === 0) {
        if (emptyState) show(emptyState);
        this._renderPagination(paged);
        return;
      }
      if (emptyState) hide(emptyState);

      paged.data.forEach(det => {
        const crimeInfo = CRIME_TYPES[det.crimeType] || CRIME_TYPES.suspicious;
        const statusInfo = STATUS_MAP[det.status] || STATUS_MAP.new;

        const tr = document.createElement('tr');
        tr.className = 'data-table__row';
        tr.dataset.id = det.id;

        tr.innerHTML = `
          <td class="data-table__td--check">
            <label class="form-checkbox form-checkbox--table">
              <input type="checkbox" class="row-checkbox" value="${det.id}">
              <span class="form-checkbox__mark"></span>
            </label>
          </td>
          <td class="data-table__td--id"><code>${det.id.slice(-8)}</code></td>
          <td class="data-table__td--snap">
            <div class="table-snapshot">
              ${det.snapshot
                ? `<img src="${det.snapshot}" alt="" class="table-snapshot__img" loading="lazy">`
                : '<div class="table-snapshot__placeholder"><i data-lucide="image-off"></i></div>'
              }
            </div>
          </td>
          <td>
            <span class="crime-badge" style="background:${crimeInfo.color}15;color:${crimeInfo.color};border:1px solid ${crimeInfo.color}33">
              ${crimeInfo.label}
            </span>
          </td>
          <td>
            <div class="confidence-bar confidence-bar--sm">
              <div class="confidence-bar__fill" style="width:${det.confidence}%;background:${getConfidenceColor(det.confidence)}"></div>
              <span class="confidence-bar__text">${Math.round(det.confidence)}%</span>
            </div>
          </td>
          <td>${escapeHtml(det.sourceLabel || det.source)}</td>
          <td><span title="${formatDateTime(det.timestamp)}">${formatTimeAgo(det.timestamp)}</span></td>
          <td><span class="status-badge" style="background:${statusInfo.bg};color:${statusInfo.color}">${statusInfo.label}</span></td>
          <td class="data-table__td--actions">
            <button class="btn btn--ghost btn--xs" data-action="view" data-id="${det.id}" title="View"><i data-lucide="eye"></i></button>
            <button class="btn btn--ghost btn--xs btn--danger" data-action="delete" data-id="${det.id}" title="Delete"><i data-lucide="trash-2"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      if (window.lucide) lucide.createIcons({ nodes: [tbody] });
      this._renderPagination(paged);
    };

    // Initial render
    renderTable();

    // Filters
    const filterEls = ['historySearch', 'historyTypeFilter', 'historySourceFilter', 'historyStatusFilter', 'historyDateFrom', 'historyDateTo', 'historyConfMin', 'historyConfMax'];
    filterEls.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const evt = el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change';
        el.addEventListener(evt, debounce(() => { currentPage = 1; renderTable(); }, 300));
      }
    });

    // Sort
    $$('.data-table__sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sort;
        if (currentSort.key === key) {
          currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort = { key, dir: 'desc' };
        }
        renderTable();
      });
    });

    // Per page
    const perPage = document.getElementById('perPageSelect');
    if (perPage) {
      perPage.addEventListener('change', () => {
        currentPerPage = parseInt(perPage.value);
        currentPage = 1;
        renderTable();
      });
    }

    // Pagination
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (btn) { currentPage = parseInt(btn.dataset.page); renderTable(); }
    });

    const pagFirst = document.getElementById('paginationFirst');
    const pagPrev = document.getElementById('paginationPrev');
    const pagNext = document.getElementById('paginationNext');
    const pagLast = document.getElementById('paginationLast');

    if (pagFirst) pagFirst.addEventListener('click', () => { currentPage = 1; renderTable(); });
    if (pagPrev) pagPrev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
    if (pagNext) pagNext.addEventListener('click', () => { currentPage++; renderTable(); });
    if (pagLast) pagLast.addEventListener('click', () => { /* set by pagination render */ });

    // Select all
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        const checkboxes = $$('.row-checkbox');
        checkboxes.forEach(cb => { cb.checked = selectAll.checked; });
        selectedIds = new Set(selectAll.checked ? checkboxes.map(cb => cb.value) : []);
        this._updateBulkActions(selectedIds);
      });
    }

    // Row checkboxes
    document.getElementById('historyTableBody')?.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-checkbox')) {
        if (e.target.checked) selectedIds.add(e.target.value);
        else selectedIds.delete(e.target.value);
        this._updateBulkActions(selectedIds);
      }
    });

    // Row actions
    document.getElementById('historyTableBody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'view') this._openHistoryDetail(id, renderTable);
      if (btn.dataset.action === 'delete') {
        Modal.confirm('Delete Detection', 'This will permanently delete this detection record.', 'Delete').then(ok => {
          if (ok) { DetectionStore.remove(id); renderTable(); Toast.success('Detection deleted'); }
        });
      }
    });

    // Bulk actions
    const bulkReview = document.getElementById('bulkReviewBtn');
    const bulkDismiss = document.getElementById('bulkDismissBtn');
    const bulkDelete = document.getElementById('bulkDeleteBtn');

    if (bulkReview) bulkReview.addEventListener('click', () => {
      DetectionStore.bulkUpdate([...selectedIds], { status: 'reviewed' });
      renderTable(); Toast.success(`${selectedIds.size} detections marked as reviewed`);
    });
    if (bulkDismiss) bulkDismiss.addEventListener('click', () => {
      DetectionStore.bulkUpdate([...selectedIds], { status: 'dismissed' });
      renderTable(); Toast.success(`${selectedIds.size} detections dismissed`);
    });
    if (bulkDelete) bulkDelete.addEventListener('click', () => {
      Modal.confirm('Delete Selected', `Delete ${selectedIds.size} detections?`, 'Delete All').then(ok => {
        if (ok) { DetectionStore.bulkDelete([...selectedIds]); renderTable(); Toast.success('Detections deleted'); }
      });
    });

    // Clear filters
    const clearBtn = document.getElementById('clearFiltersBtn');
    const emptyReset = document.getElementById('emptyResetFilters');
    [clearBtn, emptyReset].forEach(btn => {
      if (btn) btn.addEventListener('click', () => {
        filterEls.forEach(id => {
          const el = document.getElementById(id);
          if (el) { if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = ''; }
        });
        document.getElementById('historyConfMin').value = 0;
        document.getElementById('historyConfMax').value = 100;
        currentPage = 1;
        renderTable();
      });
    });

    // Export
    const exportCSV = document.getElementById('exportCSV');
    const exportJSON = document.getElementById('exportJSON');
    if (exportCSV) exportCSV.addEventListener('click', () => { DetectionStore.exportAll('csv'); Toast.success('CSV exported'); });
    if (exportJSON) exportJSON.addEventListener('click', () => { DetectionStore.exportAll('json'); Toast.success('JSON exported'); });

    // Export dropdown
    const expBtn = document.getElementById('exportDropdownBtn');
    const expMenu = document.getElementById('exportDropdownMenu');
    if (expBtn && expMenu) {
      expBtn.addEventListener('click', () => { expMenu.hidden = !expMenu.hidden; });
      document.addEventListener('click', (e) => { if (!e.target.closest('.history-toolbar__export')) expMenu.hidden = true; });
    }

    // View toggle (table/grid)
    const viewTableBtn = document.getElementById('viewTableBtn');
    const viewGridBtn = document.getElementById('viewGridBtn');
    if (viewTableBtn) viewTableBtn.addEventListener('click', () => {
      show(document.getElementById('historyTableView'));
      hide(document.getElementById('historyGridView'));
      viewTableBtn.classList.add('view-toggle__btn--active');
      viewGridBtn.classList.remove('view-toggle__btn--active');
    });
    if (viewGridBtn) viewGridBtn.addEventListener('click', () => {
      hide(document.getElementById('historyTableView'));
      show(document.getElementById('historyGridView'));
      viewGridBtn.classList.add('view-toggle__btn--active');
      viewTableBtn.classList.remove('view-toggle__btn--active');
    });

    // Keyboard shortcut: Ctrl+K to focus search
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('historySearch')?.focus();
      }
    });
  },

  _getHistoryFilters() {
    return {
      search: document.getElementById('historySearch')?.value || '',
      type: document.getElementById('historyTypeFilter')?.value || 'all',
      source: document.getElementById('historySourceFilter')?.value || 'all',
      status: document.getElementById('historyStatusFilter')?.value || 'all',
      dateFrom: document.getElementById('historyDateFrom')?.value || '',
      dateTo: document.getElementById('historyDateTo')?.value || '',
      confMin: parseInt(document.getElementById('historyConfMin')?.value || 0),
      confMax: parseInt(document.getElementById('historyConfMax')?.value || 100),
    };
  },

  _updateBulkActions(selectedIds) {
    const bulkEl = document.getElementById('bulkActions');
    const countEl = document.getElementById('bulkCount');
    if (bulkEl) toggle(bulkEl, selectedIds.size > 0);
    if (countEl) countEl.textContent = `${selectedIds.size} selected`;
  },

  _renderPagination(paged) {
    const infoEl = document.getElementById('paginationInfo');
    if (infoEl) infoEl.textContent = paged.total > 0 ? `Showing ${paged.start}-${paged.end} of ${paged.total}` : 'No results';

    const prevBtn = document.getElementById('paginationPrev');
    const nextBtn = document.getElementById('paginationNext');
    const firstBtn = document.getElementById('paginationFirst');
    const lastBtn = document.getElementById('paginationLast');

    if (prevBtn) prevBtn.disabled = paged.page <= 1;
    if (firstBtn) firstBtn.disabled = paged.page <= 1;
    if (nextBtn) nextBtn.disabled = paged.page >= paged.totalPages;
    if (lastBtn) { lastBtn.disabled = paged.page >= paged.totalPages; lastBtn.onclick = () => {}; }

    // Page numbers
    const pagesEl = document.getElementById('paginationPages');
    if (pagesEl) {
      pagesEl.innerHTML = '';
      const maxButtons = 5;
      let start = Math.max(1, paged.page - 2);
      let end = Math.min(paged.totalPages, start + maxButtons - 1);
      start = Math.max(1, end - maxButtons + 1);

      for (let i = start; i <= end; i++) {
        const btn = createElement('button', {
          className: `pagination__page-btn ${i === paged.page ? 'pagination__page-btn--active' : ''}`,
          textContent: String(i),
          'data-page': String(i),
        });
        pagesEl.appendChild(btn);
      }
    }
  },

  _openHistoryDetail(id, refreshFn) {
    const det = DetectionStore.getById(id);
    if (!det) return;

    const crimeInfo = CRIME_TYPES[det.crimeType] || CRIME_TYPES.suspicious;

    const map = {
      histDetId: det.id.slice(-8),
      histDetType: crimeInfo.label,
      histDetConf: Math.round(det.confidence) + '%',
      histDetSource: det.sourceLabel || det.source,
      histDetTime: formatDateTime(det.timestamp),
      histDetObjects: (det.objects || []).join(', ') || 'N/A',
    };

    Object.entries(map).forEach(([elId, val]) => {
      const el = document.getElementById(elId);
      if (el) el.textContent = val;
    });

    const snapshot = document.getElementById('histDetSnapshot');
    if (snapshot) snapshot.src = det.snapshot || '';

    const confBar = document.getElementById('histDetConfBar');
    if (confBar) confBar.style.width = det.confidence + '%';

    const statusSelect = document.getElementById('histDetStatusSelect');
    if (statusSelect) statusSelect.value = det.status || 'new';

    const notesEl = document.getElementById('histDetNotes');
    if (notesEl) notesEl.value = det.notes || '';

    // Save
    const saveBtn = document.getElementById('histDetSaveBtn');
    if (saveBtn) {
      saveBtn.onclick = () => {
        DetectionStore.update(id, {
          status: statusSelect.value,
          notes: notesEl.value,
        });
        Modal.close('detectionDetailModal');
        if (refreshFn) refreshFn();
        Toast.success('Detection updated');
      };
    }

    // Delete
    const deleteBtn = document.getElementById('histDetDeleteBtn');
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        Modal.close('detectionDetailModal');
        Modal.confirm('Delete', 'Delete this detection permanently?', 'Delete').then(ok => {
          if (ok) { DetectionStore.remove(id); if (refreshFn) refreshFn(); Toast.success('Deleted'); }
        });
      };
    }

    Modal.open('detectionDetailModal');
  },

  // ============================================================
  // PAGE: SETTINGS
  // ============================================================

  _initSettingsPage() {
    // Section navigation
    const navItems = $$('.settings-nav__item');
    const sections = $$('.settings-section');

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navItems.forEach(n => { n.classList.remove('settings-nav__item--active'); n.removeAttribute('aria-current'); });
        sections.forEach(s => hide(s));

        item.classList.add('settings-nav__item--active');
        item.setAttribute('aria-current', 'true');

        const sectionId = 'section-' + item.dataset.section;
        const section = document.getElementById(sectionId);
        if (section) show(section);
      });
    });

    // Load settings into form fields
    this._loadSettingsToForm();

    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings({
          profileName: document.getElementById('profileName').value,
          profileEmail: document.getElementById('profileEmail').value,
          profileRole: document.getElementById('profileRole').value,
          profileOrg: document.getElementById('profileOrg').value,
        });
        // Update user session
        const user = Storage.get('user', {});
        user.name = document.getElementById('profileName').value || user.name;
        user.role = document.getElementById('profileRole').value || user.role;
        Storage.set('user', user);
        Toast.success('Profile saved');
      });
    }

    // Detection form
    const detForm = document.getElementById('detectionSettingsForm');
    if (detForm) {
      // Range sliders
      this._bindRangeSlider('globalConfThreshold', 'globalConfValue');
      this._bindRangeSlider('alertConfThreshold', 'alertConfValue');

      detForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings({
          globalConfThreshold: parseInt(document.getElementById('globalConfThreshold').value),
          alertConfThreshold: parseInt(document.getElementById('alertConfThreshold').value),
          maxDetections: parseInt(document.getElementById('maxDetections').value),
          frameSkip: parseInt(document.getElementById('frameSkip').value),
          inputResolution: parseInt(document.getElementById('inputResolution').value),
          detectViolence: document.getElementById('detectViolence').checked,
          detectTheft: document.getElementById('detectTheft').checked,
          detectFighting: document.getElementById('detectFighting').checked,
          detectVandalism: document.getElementById('detectVandalism').checked,
          detectRobbery: document.getElementById('detectRobbery').checked,
          detectSuspicious: document.getElementById('detectSuspicious').checked,
        });
        Toast.success('Detection settings saved');
      });
    }

    // Alert form
    const alertForm = document.getElementById('alertSettingsForm');
    if (alertForm) {
      this._bindRangeSlider('alertVolume', 'alertVolumeValue');

      alertForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings({
          enableBrowserNotif: document.getElementById('enableBrowserNotif').checked,
          enableEmailAlert: document.getElementById('enableEmailAlert').checked,
          enableAudioAlert: document.getElementById('enableAudioAlert').checked,
          enableFlashAlert: document.getElementById('enableFlashAlert').checked,
          alertCooldown: parseInt(document.getElementById('alertCooldown').value),
          alertVolume: parseInt(document.getElementById('alertVolume').value),
        });
        Toast.success('Alert settings saved');
      });

      // Test buttons
      document.getElementById('testBrowserNotif')?.addEventListener('click', async () => {
        await AlertSystem.requestPermission();
        AlertSystem.sendBrowserNotification('Test Alert', 'Browser notifications are working!');
        Toast.info('Test notification sent');
      });
      document.getElementById('testAudioNotif')?.addEventListener('click', () => {
        AlertSystem.playAudioAlert();
      });
      document.getElementById('testEmailNotif')?.addEventListener('click', async () => {
        Toast.info('Sending test email...');
        const result = await AlertSystem.sendTestEmail();
        if (result.success) Toast.success('Test email sent!');
        else Toast.error('Email failed: ' + result.reason);
      });
    }

    // Email form
    const emailForm = document.getElementById('emailSettingsForm');
    if (emailForm) {
      emailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings({
          emailjsPublicKey: document.getElementById('emailjsPublicKey').value,
          emailjsServiceId: document.getElementById('emailjsServiceId').value,
          emailjsTemplateId: document.getElementById('emailjsTemplateId').value,
          alertRecipientEmail: document.getElementById('alertRecipientEmail').value,
          alertCCEmails: document.getElementById('alertCCEmails').value,
        });
        AlertSystem._emailInitialized = false;
        AlertSystem._initEmailJS();
        Toast.success('Email settings saved');
      });

      document.getElementById('testEmailSetup')?.addEventListener('click', async () => {
        // Save first
        emailForm.dispatchEvent(new Event('submit'));
        await sleep(200);
        const result = await AlertSystem.sendTestEmail();
        if (result.success) Toast.success('Test email sent successfully!');
        else Toast.error('Test failed: ' + result.reason);
      });
    }

    // Appearance form
    const appearForm = document.getElementById('appearanceSettingsForm');
    if (appearForm) {
      // Theme radio
      $$('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', () => {
          saveSetting('theme', radio.value);
          this._applyTheme();
        });
      });

      // Accent color radio
      $$('input[name="accent"]').forEach(radio => {
        radio.addEventListener('change', () => {
          saveSetting('accent', radio.value);
          document.documentElement.style.setProperty('--accent', radio.value);
        });
      });

      appearForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings({
          compactSidebar: document.getElementById('compactSidebar').checked,
          showFPS: document.getElementById('showFPS').checked,
          enableAnimations: document.getElementById('enableAnimations').checked,
        });
        Toast.success('Appearance settings saved');
      });
    }

    // Data management
    document.getElementById('exportAllCSV')?.addEventListener('click', () => { DetectionStore.exportAll('csv'); Toast.success('CSV exported'); });
    document.getElementById('exportAllJSON')?.addEventListener('click', () => { DetectionStore.exportAll('json'); Toast.success('JSON exported'); });
    document.getElementById('exportSettings')?.addEventListener('click', () => {
      exportToJSON(getSettings(), 'crimevision-settings.json');
      Toast.success('Settings exported');
    });

    document.getElementById('importDataBtn')?.addEventListener('click', () => {
      const file = document.getElementById('importFile')?.files[0];
      if (!file) { Toast.error('Select a JSON file'); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (Array.isArray(data)) {
            const existing = DetectionStore.getAll();
            Storage.set(DetectionStore.STORAGE_KEY, [...data, ...existing]);
            Toast.success(`Imported ${data.length} records`);
          } else if (data.profileName) {
            Storage.set('settings', data);
            this._loadSettingsToForm();
            Toast.success('Settings imported');
          }
        } catch { Toast.error('Invalid JSON file'); }
      };
      reader.readAsText(file);
    });

    document.getElementById('clearAllDetections')?.addEventListener('click', () => {
      Modal.confirm('Clear All', 'Delete ALL detection records? This cannot be undone.', 'Clear All').then(ok => {
        if (ok) { DetectionStore.clearAll(); Toast.success('All detections cleared'); this._updateStorageInfo(); }
      });
    });

    document.getElementById('resetAllSettings')?.addEventListener('click', () => {
      Modal.confirm('Reset Settings', 'Restore all settings to defaults?', 'Reset').then(ok => {
        if (ok) { resetSettings(); this._loadSettingsToForm(); this._applyTheme(); Toast.success('Settings reset'); }
      });
    });

    document.getElementById('factoryReset')?.addEventListener('click', () => {
      Modal.confirm('Factory Reset', 'This will erase ALL data, settings, and accounts. Are you absolutely sure?', 'Erase Everything').then(ok => {
        if (ok) { Storage.clear(); window.location.href = 'index.html'; }
      });
    });

    // Storage info
    this._updateStorageInfo();

    // System info
    this._loadSystemInfo();
  },

  _loadSettingsToForm() {
    const s = getSettings();

    // Profile
    const profileMap = { profileName: 'profileName', profileEmail: 'profileEmail', profileRole: 'profileRole', profileOrg: 'profileOrg' };
    Object.entries(profileMap).forEach(([formId, key]) => {
      const el = document.getElementById(formId);
      if (el) el.value = s[key] || '';
    });

    // Detection
    const rangeMap = { globalConfThreshold: 'globalConfValue', alertConfThreshold: 'alertConfValue', alertVolume: 'alertVolumeValue' };
    Object.entries(rangeMap).forEach(([sliderId, displayId]) => {
      const slider = document.getElementById(sliderId);
      const display = document.getElementById(displayId);
      if (slider) slider.value = s[sliderId] || DEFAULT_SETTINGS[sliderId];
      if (display) display.textContent = (s[sliderId] || DEFAULT_SETTINGS[sliderId]) + '%';
    });

    const numMap = { maxDetections: 'maxDetections', alertCooldown: 'alertCooldown' };
    Object.entries(numMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = s[key] || DEFAULT_SETTINGS[key];
    });

    const selectMap = { frameSkip: 'frameSkip', inputResolution: 'inputResolution' };
    Object.entries(selectMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = s[key] || DEFAULT_SETTINGS[key];
    });

    // Toggles
    const toggles = ['detectViolence', 'detectTheft', 'detectFighting', 'detectVandalism', 'detectRobbery', 'detectSuspicious',
      'enableBrowserNotif', 'enableEmailAlert', 'enableAudioAlert', 'enableFlashAlert', 'compactSidebar', 'showFPS', 'enableAnimations'];
    toggles.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = s[id] !== undefined ? s[id] : DEFAULT_SETTINGS[id];
    });

    // EmailJS
    ['emailjsPublicKey', 'emailjsServiceId', 'emailjsTemplateId', 'alertRecipientEmail', 'alertCCEmails'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = s[id] || '';
    });

    // Theme radio
    const themeRadio = document.querySelector(`input[name="theme"][value="${s.theme || 'dark'}"]`);
    if (themeRadio) themeRadio.checked = true;

    // Accent radio
    const accentRadio = document.querySelector(`input[name="accent"][value="${s.accent || '#3b82f6'}"]`);
    if (accentRadio) accentRadio.checked = true;
  },

  _bindRangeSlider(sliderId, displayId) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    if (slider && display) {
      slider.addEventListener('input', () => display.textContent = slider.value + '%');
    }
  },

  _updateStorageInfo() {
    const used = Storage.getUsage();
    const fill = document.getElementById('storageUsageFill');
    const usedEl = document.getElementById('storageUsed');
    const detsEl = document.getElementById('storageDetections');
    const snapEl = document.getElementById('storageSnapshots');

    if (usedEl) usedEl.textContent = formatBytes(used);
    if (fill) fill.style.width = Math.min(100, (used / (5 * 1024 * 1024)) * 100) + '%';

    const dets = DetectionStore.getAll();
    if (detsEl) detsEl.textContent = dets.length + ' records';
    if (snapEl) snapEl.textContent = dets.filter(d => d.snapshot).length + ' images';
  },

  _loadSystemInfo() {
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('infoBrowser', navigator.userAgent.split(' ').pop());
    setEl('appVersion', 'v' + APP_VERSION);

    // WebGL check
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      setEl('infoWebGL', gl ? 'Supported' : 'Not available');
    } catch { setEl('infoWebGL', 'Not available'); }

    // TF.js backend
    if (typeof tf !== 'undefined') {
      tf.ready().then(() => setEl('infoTFBackend', tf.getBackend()));
    } else { setEl('infoTFBackend', 'Not loaded'); }

    // Camera
    setEl('infoCameraAccess', navigator.mediaDevices ? 'Available' : 'Not available');
    setEl('infoNotifications', 'Notification' in window ? Notification.permission : 'Not supported');
  },
};

// ============================================================
// BOOT ON DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', () => App.init());