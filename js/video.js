/**
 * video.js — CrimeVision AI
 * Webcam stream handling, camera enumeration, recording, screenshots
 */

'use strict';

const VideoManager = {
  _stream: null,
  _videoEl: null,
  _mediaRecorder: null,
  _recordedChunks: [],
  isStreaming: false,
  isRecording: false,
  startTime: null,
  _uptimeInterval: null,

  // Callbacks
  onStreamStart: null,
  onStreamStop: null,
  onStreamError: null,

  // ---- CAMERA ENUMERATION ----

  async getCameras() {
    try {
      // Need to request permission first to get labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
          groupId: d.groupId,
        }));
    } catch (err) {
      console.error('Camera enumeration failed:', err);
      return [];
    }
  },

  async populateCameraSelect(selectElementId) {
    const select = document.getElementById(selectElementId);
    if (!select) return;

    const cameras = await this.getCameras();

    // Clear existing options (except placeholder)
    while (select.options.length > 1) select.remove(1);

    if (cameras.length === 0) {
      select.innerHTML = '<option value="" disabled selected>No cameras found</option>';
      return;
    }

    cameras.forEach(cam => {
      const opt = document.createElement('option');
      opt.value = cam.deviceId;
      opt.textContent = cam.label;
      select.appendChild(opt);
    });

    // Auto-select first camera
    if (cameras.length > 0) {
      select.value = cameras[0].deviceId;
    }
  },

  // ---- START / STOP STREAM ----

  async startCamera(videoElement, deviceId = null) {
    this._videoEl = videoElement;

    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    };

    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    }

    try {
      // Stop any existing stream
      this.stopCamera();

      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = this._stream;

      await new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play().then(resolve).catch(reject);
        };
        videoElement.onerror = reject;
      });

      this.isStreaming = true;
      this.startTime = Date.now();

      if (this.onStreamStart) {
        const track = this._stream.getVideoTracks()[0];
        const settings = track.getSettings();
        this.onStreamStart({
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          deviceId: settings.deviceId,
          label: track.label,
        });
      }

      return true;
    } catch (err) {
      console.error('Camera start failed:', err);
      this.isStreaming = false;

      let message = 'Camera access failed';
      if (err.name === 'NotAllowedError') message = 'Camera permission denied. Please allow camera access.';
      else if (err.name === 'NotFoundError') message = 'No camera found on this device.';
      else if (err.name === 'NotReadableError') message = 'Camera is already in use by another application.';
      else if (err.name === 'OverconstrainedError') message = 'Camera does not support the requested settings.';

      if (this.onStreamError) this.onStreamError(message, err);
      throw new Error(message);
    }
  },

  stopCamera() {
    if (this._stream) {
      this._stream.getTracks().forEach(track => track.stop());
      this._stream = null;
    }

    if (this._videoEl) {
      this._videoEl.srcObject = null;
    }

    if (this._mediaRecorder && this.isRecording) {
      this._mediaRecorder.stop();
    }

    this.isStreaming = false;
    this.isRecording = false;
    this.startTime = null;

    if (this.onStreamStop) this.onStreamStop();
  },

  // ---- UPTIME ----

  getUptime() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  },

  getUptimeFormatted() {
    return formatDuration(this.getUptime());
  },

  // ---- SCREENSHOTS ----

  takeScreenshot(videoElement, annotationCanvas = null) {
    const vEl = videoElement || this._videoEl;
    if (!vEl || vEl.readyState < 2) return null;

    const canvas = document.createElement('canvas');
    canvas.width = vEl.videoWidth;
    canvas.height = vEl.videoHeight;
    const ctx = canvas.getContext('2d');

    // Draw video frame
    ctx.drawImage(vEl, 0, 0);

    // Overlay annotations if available
    if (annotationCanvas && annotationCanvas.width > 0) {
      ctx.drawImage(annotationCanvas, 0, 0, canvas.width, canvas.height);
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      timestamp: new Date().toISOString(),
      width: canvas.width,
      height: canvas.height,
    };
  },

  downloadScreenshot(dataUrl, filename) {
    const name = filename || `crimevision-screenshot-${Date.now()}.png`;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  // ---- RECORDING ----

  startRecording() {
    if (!this._stream) return false;

    const options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }
    }

    try {
      this._recordedChunks = [];
      this._mediaRecorder = new MediaRecorder(this._stream, options);

      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this._recordedChunks.push(e.data);
      };

      this._mediaRecorder.onstop = () => {
        if (this._recordedChunks.length > 0) {
          const blob = new Blob(this._recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `crimevision-recording-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        this.isRecording = false;
      };

      this._mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      return true;
    } catch (err) {
      console.error('Recording failed:', err);
      return false;
    }
  },

  stopRecording() {
    if (this._mediaRecorder && this.isRecording) {
      this._mediaRecorder.stop();
    }
  },

  // ---- VIDEO FILE LOADING ----

  loadVideoFile(file, videoElement) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('video/')) {
        reject(new Error('Invalid video file'));
        return;
      }

      const url = URL.createObjectURL(file);
      videoElement.src = url;

      videoElement.onloadedmetadata = () => {
        resolve({
          duration: videoElement.duration,
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
          name: file.name,
          size: file.size,
          type: file.type,
          url,
        });
      };

      videoElement.onerror = () => reject(new Error('Failed to load video file'));
    });
  },

  // ---- STREAM INFO ----

  getStreamInfo() {
    if (!this._stream) return null;

    const track = this._stream.getVideoTracks()[0];
    if (!track) return null;

    const settings = track.getSettings();
    return {
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
    };
  },

  // ---- CHECKS ---- (FIXED: removed 'static')

  isCameraSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  },

  isRecordingSupported() {
    return typeof MediaRecorder !== 'undefined';
  },
};