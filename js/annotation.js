/**
 * annotation.js — CrimeVision AI
 * Canvas overlay for drawing bounding boxes, labels, confidence on video
 */

'use strict';

const CanvasAnnotator = {

  _canvas: null,
  _ctx: null,
  _width: 0,
  _height: 0,

  init(canvasElement) {
    this._canvas = canvasElement;
    this._ctx = canvasElement.getContext('2d');
  },

  /**
   * Sync canvas size to video dimensions
   */
  resize(width, height) {
    if (!this._canvas) return;
    this._width = width;
    this._height = height;
    this._canvas.width = width;
    this._canvas.height = height;
  },

  /**
   * Clear entire canvas
   */
  clear() {
    if (!this._ctx) return;
    this._ctx.clearRect(0, 0, this._width, this._height);
  },

  /**
   * Draw all detections on canvas
   * @param {Array} predictions - COCO-SSD predictions [{class, score, bbox}]
   * @param {Object} classification - From CrimeClassifier.classify()
   * @param {Object} options
   */
  drawDetections(predictions, classification = null, options = {}) {
    if (!this._ctx) return;
    this.clear();

    const ctx = this._ctx;
    const isCrime = classification && classification.crimeType !== 'normal' && classification.confidence > 0;

    // Draw each bounding box
    predictions.forEach(pred => {
      const [x, y, w, h] = pred.bbox;
      const score = Math.round(pred.score * 100);
      const label = pred.class;
      const isWeapon = CrimeClassifier.WEAPON_CLASSES.includes(pred.class);
      const isPerson = pred.class === 'person';

      // Color based on object type
      let color = '#22c55e'; // green (normal)
      if (isWeapon) color = '#ef4444'; // red
      else if (isPerson && isCrime) color = '#f97316'; // orange
      else if (isPerson) color = '#3b82f6'; // blue

      // Bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(x, y, w, h);

      // Semi-transparent fill
      ctx.fillStyle = color.replace(')', ', 0.08)').replace('rgb', 'rgba').replace('#', '');
      // Convert hex to rgba
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.08)`;
      ctx.fillRect(x, y, w, h);

      // Label background
      const labelText = `${label} ${score}%`;
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      const labelHeight = 20;
      const labelY = y > labelHeight ? y - labelHeight : y;

      ctx.fillStyle = color;
      ctx.fillRect(x, labelY, textWidth + 12, labelHeight);

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x + 6, labelY + 14);

      // Corner markers
      this._drawCorners(ctx, x, y, w, h, color, 10);
    });

    // Crime classification overlay
    if (isCrime && classification) {
      this._drawCrimeOverlay(ctx, classification);
    }

    // Timestamp watermark
    if (options.showTimestamp !== false) {
      this._drawTimestamp(ctx);
    }
  },

  /**
   * Draw corner brackets on bounding box
   */
  _drawCorners(ctx, x, y, w, h, color, len) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
    ctx.stroke();
  },

  /**
   * Draw crime classification banner at top of canvas
   */
  _drawCrimeOverlay(ctx, classification) {
    const crimeInfo = CRIME_TYPES[classification.crimeType] || CRIME_TYPES.suspicious;
    const text = `⚠ ${crimeInfo.label.toUpperCase()} — ${classification.confidence}%`;

    // Banner background
    const bannerHeight = 36;
    ctx.fillStyle = 'rgba(220, 38, 38, 0.85)';
    ctx.fillRect(0, 0, this._width, bannerHeight);

    // Banner text
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(text, this._width / 2, bannerHeight / 2 + 5);
    ctx.textAlign = 'start';

    // Pulsing border
    const alpha = 0.4 + 0.3 * Math.sin(Date.now() / 200);
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, this._width - 4, this._height - 4);
  },

  /**
   * Draw timestamp watermark
   */
  _drawTimestamp(ctx) {
    const now = new Date();
    const text = now.toLocaleString('en-IN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });

    ctx.font = '11px JetBrains Mono, monospace';
    const textWidth = ctx.measureText(text).width;
    const x = this._width - textWidth - 12;
    const y = this._height - 10;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 6, y - 14, textWidth + 12, 20);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
  },

  /**
   * Draw a snapshot with annotations (for saving)
   */
  drawSnapshotAnnotated(videoElement, predictions, classification) {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');

    // Draw video frame
    ctx.drawImage(videoElement, 0, 0);

    // Temporarily swap context
    const origCanvas = this._canvas;
    const origCtx = this._ctx;
    const origW = this._width;
    const origH = this._height;

    this._canvas = canvas;
    this._ctx = ctx;
    this._width = canvas.width;
    this._height = canvas.height;

    this.drawDetections(predictions, classification, { showTimestamp: true });

    // Restore
    this._canvas = origCanvas;
    this._ctx = origCtx;
    this._width = origW;
    this._height = origH;

    return canvas.toDataURL('image/jpeg', 0.85);
  },
};