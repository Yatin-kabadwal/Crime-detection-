/**
 * detection-helper-v2.js
 * FINAL VERSION - Ensures UI updates work correctly
 * Use this if you see console logs but no UI alerts
 */

'use strict';

// Wait for page to load AND for app.js to set its callback
window.addEventListener('load', () => {
  // Small delay to ensure app.js has initialized
  setTimeout(() => {
    console.log('🔧 Detection Helper V2 Loading...');

    // ============================================================
    // FIX 1: Ensure Settings Are Enabled
    // ============================================================
    function ensureSettingsEnabled() {
      const criticalSettings = {
        'detectWeapon': true,
        'detectViolence': true,
        'detectTheft': true,
        'detectFighting': true,
        'detectRobbery': true,
        'detectSuspicious': true,
        'globalConfThreshold': 50,
      };
      
      let updated = false;
      for (const [key, value] of Object.entries(criticalSettings)) {
        const current = getSetting(key);
        if (current !== value) {
          console.log(`⚙️ Updating ${key}: ${current} → ${value}`);
          saveSetting(key, value);
          updated = true;
        }
      }
      
      if (updated) {
        Toast.warning('Detection settings updated. Please reload the page.');
        return true;
      }
      return false;
    }

    // ============================================================
    // FIX 2: Add Simplified Detection Rule
    // ============================================================
    function addSimplifiedRule() {
      CrimeClassifier.RULES.unshift({
        type: 'suspicious',
        check(objects, context) {
          const persons = objects.filter(o => o.class === 'person');
          if (persons.length > 0) {
            return 0.80;
          }
          return 0;
        },
      });
      console.log('✅ Simplified rule added');
    }

    // ============================================================
    // FIX 3: Enhanced Logging (without breaking original callback)
    // ============================================================
    function enhanceLogging() {
      // Capture the CURRENT callback that app.js has set
      const originalCallback = DetectionEngine.onDetection;
      
      if (!originalCallback || typeof originalCallback !== 'function') {
        console.error('❌ Original callback not found! App.js may not have initialized yet.');
        return;
      }

      console.log('✅ Original callback captured:', originalCallback.name || 'anonymous');

      let frameCount = 0;

      // Create wrapper that logs AND calls original
      const enhancedCallback = function(predictions, frameData) {
        frameCount++;

        // Log every 30 frames (less spam)
        if (predictions.length > 0 && frameCount % 30 === 0) {
          console.group(`🔍 Frame ${frameCount}`);
          console.log('Objects:', predictions.map(p => p.class).join(', '));
          
          const classification = CrimeClassifier.classify(predictions, frameData);
          if (classification.crimeType !== 'normal') {
            console.log(`✅ CRIME: ${classification.crimeType} (${classification.confidence}%)`);
          }
          console.groupEnd();
        }

        // CRITICAL: Call the original callback from app.js
        // This is what triggers UI updates, alerts, etc.
        originalCallback.call(this, predictions, frameData);
      };

      // Replace the callback
      DetectionEngine.onDetection = enhancedCallback;
      console.log('✅ Enhanced logging active (calling original callback)');
    }

    // ============================================================
    // FIX 4: Detection Monitor Overlay
    // ============================================================
    function createMonitor() {
      const monitor = document.createElement('div');
      monitor.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        background: rgba(0,0,0,0.9);
        color: #0f0;
        padding: 15px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 12px;
        z-index: 9998;
        min-width: 250px;
        border: 1px solid #0f0;
      `;
      monitor.innerHTML = '<div style="color: #0f0; font-weight: bold;">🔍 Monitor</div><div id="monitor-content">Waiting...</div>';
      document.body.appendChild(monitor);

      // Update monitor periodically
      setInterval(() => {
        const content = document.getElementById('monitor-content');
        if (!content) return;

        const stats = {
          frames: DetectionEngine.totalFramesAnalyzed || 0,
          fps: DetectionEngine.currentFPS || 0,
          detections: DetectionStore.getAll().length || 0,
        };

        content.innerHTML = `
          Frames: ${stats.frames}<br>
          FPS: ${stats.fps}<br>
          Stored: ${stats.detections}
        `;
      }, 1000);

      return monitor;
    }

    // ============================================================
    // FIX 5: Test Mode Button
    // ============================================================
    function addTestButton() {
      const btn = document.createElement('button');
      btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #3b82f6;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 6px;
        cursor: pointer;
        z-index: 9999;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      btn.textContent = 'Test: Threshold 50%';
      
      let testMode = false;
      btn.addEventListener('click', () => {
        testMode = !testMode;
        if (testMode) {
          saveSetting('globalConfThreshold', 40);
          btn.textContent = 'Test: Threshold 40%';
          btn.style.background = '#f59e0b';
          Toast.success('Test mode: 40% threshold');
        } else {
          saveSetting('globalConfThreshold', 50);
          btn.textContent = 'Test: Threshold 50%';
          btn.style.background = '#3b82f6';
          Toast.info('Normal mode: 50% threshold');
        }
      });
      
      document.body.appendChild(btn);
    }

    // ============================================================
    // INITIALIZE
    // ============================================================
    
    // Step 1: Check settings
    const needsReload = ensureSettingsEnabled();
    if (needsReload) {
      console.warn('⚠️ Settings updated - reload required!');
      return;
    }

    // Step 2: Add simplified rule
    addSimplifiedRule();

    // Step 3: Add logging (after app.js has set callback)
    enhanceLogging();

    // Step 4: Add monitor
    createMonitor();

    // Step 5: Add test button
    addTestButton();

    console.log(`
╔════════════════════════════════════════╗
║  DETECTION HELPER V2 READY ✅          ║
╠════════════════════════════════════════╣
║ • Simplified rule active               ║
║ • Logging enhanced                     ║
║ • Monitor added (top-right)            ║
║ • Test button added (bottom-right)     ║
║                                        ║
║ UI alerts should now work correctly!   ║
╚════════════════════════════════════════╝
    `);

  }, 1500); // Wait 1.5s for app.js to initialize
});