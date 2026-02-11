/**
 * detection.js — CrimeVision AI
 * TensorFlow.js model loading & inference pipeline
 */

'use strict';

const DetectionEngine = {
  model: null,
  isLoaded: false,
  isRunning: false,
  _animFrameId: null,
  _frameCount: 0,
  _skipCounter: 0,
  _fpsTimestamp: 0,
  _fpsCount: 0,
  currentFPS: 0,
  totalFramesAnalyzed: 0,

  // Callbacks
  onDetection: null,    // (detections, frameData) => {}
  onFPSUpdate: null,    // (fps) => {}
  onStatusChange: null, // (status) => {}

  // ---- MODEL LOADING ----

  async loadModel(onProgress) {
    if (this.isLoaded && this.model) return this.model;

    try {
      // Step 1: TF.js ready
      if (onProgress) onProgress('tfjs', 'loading');
      await tf.ready();
      if (onProgress) onProgress('tfjs', 'ready');

      // Log backend
      console.log('TF.js backend:', tf.getBackend());

      // Step 2: COCO-SSD
      if (onProgress) onProgress('coco', 'loading');

      if (typeof cocoSsd === 'undefined') {
        throw new Error('COCO-SSD library not loaded. Check CDN script.');
      }

      this.model = await cocoSsd.load({
        base: 'lite_mobilenet_v2', // Fastest option for browser
      });

      if (onProgress) onProgress('coco', 'ready');

      // Step 3: Classifier ready
      if (onProgress) onProgress('classifier', 'ready');

      this.isLoaded = true;
      if (this.onStatusChange) this.onStatusChange('loaded');

      console.log('Detection engine loaded successfully');
      return this.model;
    } catch (error) {
      console.error('Model loading failed:', error);
      if (onProgress) onProgress('error', error.message);
      if (this.onStatusChange) this.onStatusChange('error');
      throw error;
    }
  },

  // ---- SINGLE FRAME DETECTION ----

  async detectFrame(imageSource) {
    if (!this.model || !this.isLoaded) {
      console.warn('Model not loaded');
      return [];
    }

    try {
      const maxDetections = getSetting('maxDetections') || 20;
      const predictions = await this.model.detect(imageSource, maxDetections);
      return predictions;
    } catch (error) {
      console.error('Detection error:', error);
      return [];
    }
  },

  // ---- CONTINUOUS DETECTION LOOP ----

  startDetectionLoop(videoElement, canvasElement, options = {}) {
    if (this.isRunning) return;
    if (!this.isLoaded || !this.model) {
      console.error('Cannot start: model not loaded');
      return;
    }

    this.isRunning = true;
    this._frameCount = 0;
    this._skipCounter = 0;
    this._fpsTimestamp = performance.now();
    this._fpsCount = 0;

    const frameSkip = options.frameSkip ?? getSetting('frameSkip') ?? 2;
    const confThreshold = options.confThreshold ?? getSetting('globalConfThreshold') ?? 75;

    if (this.onStatusChange) this.onStatusChange('running');

    const processFrame = async () => {
      if (!this.isRunning) return;

      // FPS calculation
      this._fpsCount++;
      const now = performance.now();
      if (now - this._fpsTimestamp >= 1000) {
        this.currentFPS = this._fpsCount;
        this._fpsCount = 0;
        this._fpsTimestamp = now;
        if (this.onFPSUpdate) this.onFPSUpdate(this.currentFPS);
      }

      // Frame skip for performance
      this._skipCounter++;
      if (this._skipCounter <= frameSkip) {
        this._animFrameId = requestAnimationFrame(processFrame);
        return;
      }
      this._skipCounter = 0;

      // Check video is playing
      if (videoElement.readyState < 2 || videoElement.paused) {
        this._animFrameId = requestAnimationFrame(processFrame);
        return;
      }

      try {
        // Run detection
        const predictions = await this.detectFrame(videoElement);
        this.totalFramesAnalyzed++;
        this._frameCount++;

        // Filter by confidence threshold (COCO-SSD scores are 0-1, convert to %)
        const filtered = predictions.filter(p => (p.score * 100) >= confThreshold);

        // Build frame data
        const frameData = {
          frameNumber: this._frameCount,
          timestamp: Date.now(),
          videoTime: videoElement.currentTime,
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
          allPredictions: predictions,
        };

        // Fire callback with filtered results
        if (this.onDetection) {
          this.onDetection(filtered, frameData);
        }

      } catch (err) {
        // Silently continue on frame errors
        if (err.message && !err.message.includes('disposed')) {
          console.warn('Frame detection error:', err);
        }
      }

      this._animFrameId = requestAnimationFrame(processFrame);
    };

    this._animFrameId = requestAnimationFrame(processFrame);
  },

  stopDetectionLoop() {
    this.isRunning = false;
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
    if (this.onStatusChange) this.onStatusChange('stopped');
  },

  // ---- VIDEO FILE ANALYSIS ----

  async analyzeVideoFile(videoElement, options = {}) {
    if (!this.isLoaded || !this.model) {
      throw new Error('Model not loaded');
    }

    const mode = options.mode || 'fast';
    const confThreshold = options.confThreshold || getSetting('globalConfThreshold') || 75;
    const onProgress = options.onProgress || (() => {});
    const onFrameDetection = options.onFrameDetection || (() => {});
    const onComplete = options.onComplete || (() => {});

    // Calculate frame interval based on mode
    const fps = 25;
    let frameInterval;
    switch (mode) {
      case 'full': frameInterval = 1 / fps; break;       // Every frame
      case 'fast': frameInterval = 5 / fps; break;        // Every 5th frame
      case 'keyframe': frameInterval = 30 / fps; break;   // Every 30th frame (~1/sec)
      default: frameInterval = 5 / fps;
    }

    const duration = videoElement.duration;
    const totalFrames = Math.ceil(duration / frameInterval);
    const detections = [];
    let processedFrames = 0;
    let currentTime = 0;

    // Hidden canvas for frame extraction
    const canvas = document.createElement('canvas');
    canvas.width = options.width || getSetting('inputResolution') || 416;
    const scale = canvas.width / videoElement.videoWidth;
    canvas.height = videoElement.videoHeight * scale;
    const ctx = canvas.getContext('2d');

    this.isRunning = true;

    const processNextFrame = () => {
      return new Promise((resolve) => {
        if (!this.isRunning || currentTime >= duration) {
          resolve();
          return;
        }

        videoElement.currentTime = currentTime;

        videoElement.onseeked = async () => {
          try {
            // Draw frame to canvas
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            // Run detection
            const predictions = await this.detectFrame(canvas);
            processedFrames++;

            // Filter by confidence
            const filtered = predictions.filter(p => (p.score * 100) >= confThreshold);

            if (filtered.length > 0) {
              // Capture snapshot
              const snapshot = canvas.toDataURL('image/jpeg', 0.6);

              filtered.forEach(pred => {
                const det = {
                  videoTime: currentTime,
                  confidence: pred.score * 100,
                  objects: [pred.class],
                  bbox: pred.bbox,
                  snapshot,
                };
                detections.push(det);
                onFrameDetection(det, processedFrames);
              });
            }

            // Progress
            const progress = Math.min(100, (currentTime / duration) * 100);
            onProgress(progress, processedFrames, detections.length, currentTime, duration);

            // Move to next frame
            currentTime += frameInterval;
            resolve();
          } catch (err) {
            console.warn('Frame analysis error:', err);
            currentTime += frameInterval;
            resolve();
          }
        };
      });
    };

    // Process frames sequentially
    const startTime = Date.now();
    while (this.isRunning && currentTime < duration) {
      await processNextFrame();
      // Yield to UI thread
      await sleep(1);
    }

    this.isRunning = false;
    const elapsed = (Date.now() - startTime) / 1000;

    const result = {
      totalFrames: processedFrames,
      totalDetections: detections.length,
      detections,
      duration,
      elapsed,
      avgConfidence: detections.length > 0
        ? Math.round(detections.reduce((s, d) => s + d.confidence, 0) / detections.length)
        : 0,
    };

    onComplete(result);
    return result;
  },

  // ---- CLEANUP ----

  dispose() {
    this.stopDetectionLoop();
    if (this.model) {
      this.model = null;
    }
    this.isLoaded = false;
  },

  // ---- STATUS ----

  getStatus() {
    return {
      loaded: this.isLoaded,
      running: this.isRunning,
      fps: this.currentFPS,
      framesAnalyzed: this.totalFramesAnalyzed,
      backend: typeof tf !== 'undefined' ? tf.getBackend() : 'N/A',
    };
  },
};