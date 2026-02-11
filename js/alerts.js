/**
 * alerts.js — CrimeVision AI
 * Browser notifications, EmailJS email alerts, audio alerts, screen flash
 */

'use strict';

const AlertSystem = {
  _cooldowns: {},
  _audioEl: null,
  _emailInitialized: false,

  init() {
    this._audioEl = document.getElementById('alertAudio');
    this._initEmailJS();
  },

  // ---- BROWSER NOTIFICATIONS ----

  async requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission();
    return result;
  },

  async sendBrowserNotification(title, body, options = {}) {
    if (!getSetting('enableBrowserNotif')) return;
    if (!('Notification' in window)) return;

    if (Notification.permission !== 'granted') {
      const perm = await this.requestPermission();
      if (perm !== 'granted') return;
    }

    const notif = new Notification(title, {
      body,
      icon: options.icon || 'assets/images/favicon.ico',
      badge: options.badge || 'assets/images/favicon.ico',
      tag: options.tag || 'crimevision-alert',
      requireInteraction: options.requireInteraction || false,
      silent: false,
    });

    notif.onclick = () => {
      window.focus();
      if (options.onClick) options.onClick();
      notif.close();
    };

    setTimeout(() => notif.close(), 10000);
    return notif;
  },

  // ---- EMAIL ALERTS (EmailJS) ----

  _initEmailJS() {
    const publicKey = getSetting('emailjsPublicKey');
    if (publicKey && window.emailjs) {
      try {
        emailjs.init(publicKey);
        this._emailInitialized = true;
      } catch (e) {
        console.warn('EmailJS init failed:', e);
        this._emailInitialized = false;
      }
    }
  },

  async sendEmailAlert(detection) {
    if (!getSetting('enableEmailAlert')) return { success: false, reason: 'disabled' };

    const serviceId = getSetting('emailjsServiceId');
    const templateId = getSetting('emailjsTemplateId');
    const recipientEmail = getSetting('alertRecipientEmail');
    const publicKey = getSetting('emailjsPublicKey');

    if (!serviceId || !templateId || !recipientEmail || !publicKey) {
      return { success: false, reason: 'not_configured' };
    }

    if (!this._emailInitialized) {
      this._initEmailJS();
      if (!this._emailInitialized) return { success: false, reason: 'init_failed' };
    }

    const crimeInfo = CRIME_TYPES[detection.crimeType] || CRIME_TYPES.suspicious;

    const templateParams = {
      crime_type: crimeInfo.label,
      confidence: Math.round(detection.confidence) + '%',
      timestamp: formatDateTime(detection.timestamp),
      source: detection.sourceLabel || detection.source || 'Unknown',
      location: detection.location || 'Camera Feed',
      snapshot_url: detection.snapshot || 'N/A',
      to_email: recipientEmail,
      system_name: APP_NAME,
      detection_id: detection.id || 'N/A',
    };

    try {
      const result = await emailjs.send(serviceId, templateId, templateParams);
      console.log('Email sent:', result);
      return { success: true, result };
    } catch (error) {
      console.error('Email send failed:', error);
      return { success: false, reason: 'send_failed', error };
    }
  },

  async sendTestEmail() {
    const testDetection = {
      crimeType: 'violence',
      confidence: 92,
      timestamp: new Date().toISOString(),
      source: 'test',
      sourceLabel: 'Test Alert',
      location: 'System Test',
      id: 'TEST_' + generateShortId(),
    };
    return this.sendEmailAlert(testDetection);
  },

  // ---- AUDIO ALERT ----

  playAudioAlert() {
    if (!getSetting('enableAudioAlert')) return;

    if (!this._audioEl) {
      this._audioEl = document.getElementById('alertAudio');
    }

    if (this._audioEl) {
      this._audioEl.volume = getSetting('alertVolume') / 100;
      this._audioEl.currentTime = 0;
      this._audioEl.play().catch(() => {
        // Autoplay blocked — create fallback beep
        this._playBeep();
      });
    } else {
      this._playBeep();
    }
  },

  _playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const vol = getSetting('alertVolume') / 100;

      // Urgent two-tone alert
      [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = vol * 0.3;
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.15);
      });

      setTimeout(() => ctx.close(), 1000);
    } catch (e) {
      // Audio not available
    }
  },

  // ---- SCREEN FLASH ----

  triggerFlash(containerId = 'videoContainer') {
    if (!getSetting('enableFlashAlert')) return;
    const el = document.getElementById(containerId);
    if (!el) return;
    el.classList.add('alert-flash-active');
    setTimeout(() => el.classList.remove('alert-flash-active'), 1500);
  },

  showAlertBanner(text = 'CRIME DETECTED', containerId = 'alertFlash') {
    const el = document.getElementById(containerId);
    if (!el) return;
    const textEl = document.getElementById('alertFlashText');
    if (textEl) textEl.textContent = text;
    show(el);
    setTimeout(() => hide(el), 3000);
  },

  // ---- COOLDOWN MANAGEMENT ----

  canAlert(crimeType) {
    const cooldown = getSetting('alertCooldown') * 1000;
    const lastTime = this._cooldowns[crimeType] || 0;
    return Date.now() - lastTime >= cooldown;
  },

  recordAlert(crimeType) {
    this._cooldowns[crimeType] = Date.now();
  },

  // ---- MAIN ALERT DISPATCHER ----

  async triggerAlert(detection) {
    const crimeType = detection.crimeType || 'suspicious';

    // Check cooldown
    if (!this.canAlert(crimeType)) {
      return { triggered: false, reason: 'cooldown' };
    }

    // Check threshold
    const threshold = getSetting('alertConfThreshold');
    if (detection.confidence < threshold) {
      return { triggered: false, reason: 'below_threshold' };
    }

    // Record cooldown
    this.recordAlert(crimeType);

    const crimeInfo = CRIME_TYPES[crimeType] || CRIME_TYPES.suspicious;
    const results = { triggered: true, channels: {} };

    // Browser notification
    this.sendBrowserNotification(
      `⚠️ ${crimeInfo.label} Detected`,
      `Confidence: ${Math.round(detection.confidence)}% | Source: ${detection.sourceLabel || detection.source}`,
      {
        tag: `cv-${crimeType}-${Date.now()}`,
        requireInteraction: detection.confidence >= 90,
      }
    );
    results.channels.browser = true;

    // Audio
    this.playAudioAlert();
    results.channels.audio = true;

    // Screen flash
    this.triggerFlash();
    this.showAlertBanner(`${crimeInfo.label.toUpperCase()} DETECTED — ${Math.round(detection.confidence)}%`);
    results.channels.flash = true;

    // Email (async, don't block)
    if (getSetting('enableEmailAlert')) {
      this.sendEmailAlert(detection).then(r => {
        results.channels.email = r.success;
        if (!r.success) console.warn('Email alert failed:', r.reason);
      });
    }

    // Toast
    Toast.warning(`${crimeInfo.label} detected — ${Math.round(detection.confidence)}% confidence`);

    return results;
  },
};