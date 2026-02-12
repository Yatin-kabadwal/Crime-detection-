/**
 * fix-detection.js
 * Quick fixes for common detection issues
 * Add this AFTER your other scripts in live-monitor.html
 */

'use strict';

// WAIT for page load
document.addEventListener('DOMContentLoaded', () => {
  
  // FIX 1: Ensure all detection types are enabled
  function ensureSettingsEnabled() {
    const criticalSettings = {
      'detectWeapon': true,
      'detectViolence': true,
      'detectTheft': true,
      'detectFighting': true,
      'detectRobbery': true,
      'detectSuspicious': true,
      'globalConfThreshold': 50, // Lower threshold for testing
    };
    
    let updated = false;
    for (const [key, value] of Object.entries(criticalSettings)) {
      const current = getSetting(key);
      if (current !== value) {
        console.log(`⚙️ Updating setting ${key}: ${current} → ${value}`);
        saveSetting(key, value);
        updated = true;
      }
    }
    
    if (updated) {
      console.log('✅ Settings updated. Reload the page for changes to take effect.');
      Toast.warning('Detection settings updated. Please reload the page.');
    } else {
      console.log('✅ All detection settings are correctly configured');
    }
  }
  
  // FIX 2: Add a simplified detection rule for testing
  function addSimplifiedRule() {
    // Check if test rule already exists
    if (CrimeClassifier.RULES.some(r => r.type === 'test_person_detection')) {
      return;
    }
    
    // Add at the START so it gets checked first
    CrimeClassifier.RULES.unshift({
      type: 'suspicious', // Use existing type
      check(objects, context) {
        const persons = objects.filter(o => o.class === 'person');
        
        // Simple rule: ANY person detection = suspicious
        if (persons.length > 0) {
          console.log('✓ Simplified rule triggered: Person(s) detected');
          return 0.80; // 80% confidence
        }
        
        return 0;
      },
    });
    
    console.log('✅ Added simplified detection rule');
  }
  
  // FIX 3: Check what COCO-SSD can detect
  function showDetectableObjects() {
    const cocoClasses = [
      'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
      'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
      'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
      'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
      'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
      'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
      'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
      'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
      'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
      'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
    ];
    
    console.group('📋 COCO-SSD Detectable Objects');
    console.log('Total classes:', cocoClasses.length);
    console.log('Weapon classes defined in your code:', CrimeClassifier.WEAPON_CLASSES);
    console.log('Valuable classes:', CrimeClassifier.VALUABLE_CLASSES);
    console.log('\n⚠️ NOTE: COCO-SSD can detect these weapons:', 
      cocoClasses.filter(c => CrimeClassifier.WEAPON_CLASSES.includes(c)));
    console.groupEnd();
  }
  
  // FIX 4: Monitor detections in real-time
  function addDetectionMonitor() {
    // Add stats overlay
    const statsDiv = document.createElement('div');
    statsDiv.id = 'detection-stats-overlay';
    statsDiv.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      color: #fff;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 9998;
      min-width: 300px;
      display: none;
    `;
    statsDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; color: #3b82f6;">
        🔍 Detection Monitor
      </div>
      <div id="stats-content">Waiting for detections...</div>
    `;
    document.body.appendChild(statsDiv);
    
    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn--secondary';
    toggleBtn.innerHTML = '<i data-lucide="monitor"></i>';
    toggleBtn.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 9999;';
    toggleBtn.title = 'Toggle Detection Monitor';
    
    let isVisible = false;
    toggleBtn.addEventListener('click', () => {
      isVisible = !isVisible;
      statsDiv.style.display = isVisible ? 'block' : 'none';
    });
    
    document.body.appendChild(toggleBtn);
    if (window.lucide) lucide.createIcons({ nodes: [toggleBtn] });
    
    // Update stats every detection - using a wrapper approach
    let lastUpdate = 0;
    let savedOriginalCallback = null;
    
    const monitorWrapper = function(predictions, frameData) {
      const now = Date.now();
      if (now - lastUpdate > 500) { // Update every 500ms
        const statsContent = document.getElementById('stats-content');
        if (statsContent && predictions.length > 0) {
          const grouped = {};
          predictions.forEach(p => {
            if (!grouped[p.class]) grouped[p.class] = [];
            grouped[p.class].push(Math.round(p.score * 100));
          });
          
          const html = Object.entries(grouped).map(([cls, scores]) => 
            `<div style="margin: 5px 0;">
              <span style="color: #22c55e;">${cls}</span>: 
              ${scores.join('%, ')}%
            </div>`
          ).join('');
          
          statsContent.innerHTML = html || 'No objects detected';
        }
        lastUpdate = now;
      }
      
      // Call the original callback
      if (savedOriginalCallback) {
        savedOriginalCallback.call(this, predictions, frameData);
      }
    };
    
    // Wrap the callback setter
    const currentCallback = DetectionEngine.onDetection;
    if (currentCallback && typeof currentCallback === 'function') {
      savedOriginalCallback = currentCallback;
    }
    
    Object.defineProperty(DetectionEngine, 'onDetection', {
      get() {
        return monitorWrapper;
      },
      set(fn) {
        savedOriginalCallback = fn;
      },
      configurable: true
    });
  }
  
  // RUN ALL FIXES
  console.log('🔧 Running detection fixes...');
  ensureSettingsEnabled();
  addSimplifiedRule();
  showDetectableObjects();
  addDetectionMonitor();
  
  console.log(`
╔════════════════════════════════════════════╗
║   DETECTION SYSTEM FIXES APPLIED           ║
╠════════════════════════════════════════════╣
║ ✓ Settings checked/updated                 ║
║ ✓ Simplified rule added                    ║
║ ✓ Detection monitor enabled                ║
║                                            ║
║ NEXT STEPS:                                ║
║ 1. Reload the page if settings changed     ║
║ 2. Start camera and detection              ║
║ 3. Click monitor icon (top right)          ║
║ 4. Check browser console for logs          ║
╚════════════════════════════════════════════╝
  `);
});