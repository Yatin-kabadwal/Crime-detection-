/**
 * debug-detection.js
 * Add this to your HTML BEFORE app.js to enable debugging
 */

'use strict';

// Override the detection callback to add logging
const OriginalDetectionEngine = DetectionEngine;

// Intercept and log all detections
(function() {
  // Store the original callback when it gets set
  let savedOriginalCallback = null;
  
  // Create a wrapper that will be called
  const debugWrapper = function(predictions, frameData) {
    // LOG 1: What COCO-SSD detected
    console.group('🔍 Frame Detection Debug');
    console.log('Raw predictions from COCO-SSD:', predictions);
    console.log('Prediction count:', predictions.length);
    
    if (predictions.length > 0) {
      console.log('Detected classes:', predictions.map(p => ({
        class: p.class,
        confidence: Math.round(p.score * 100) + '%'
      })));
    }
    
    // LOG 2: Check enabled crime types
    const enabledTypes = {
      detectWeapon: getSetting('detectWeapon'),
      detectViolence: getSetting('detectViolence'),
      detectTheft: getSetting('detectTheft'),
      detectFighting: getSetting('detectFighting'),
      detectRobbery: getSetting('detectRobbery'),
      detectSuspicious: getSetting('detectSuspicious'),
    };
    console.log('Enabled detection types:', enabledTypes);
    
    // LOG 3: Confidence threshold
    const threshold = getSetting('globalConfThreshold');
    console.log('Global confidence threshold:', threshold + '%');
    
    // LOG 4: Run classification
    const classification = CrimeClassifier.classify(predictions, {
      width: frameData.width,
      height: frameData.height,
    });
    
    console.log('Classification result:', classification);
    
    // LOG 5: Check why it didn't trigger
    if (classification.crimeType === 'normal') {
      console.warn('❌ No crime detected - classified as NORMAL');
      console.log('Objects detected:', classification.objects);
    } else if (classification.confidence < threshold) {
      console.warn('❌ Crime detected but confidence too low:', 
        `${classification.confidence}% < ${threshold}%`);
    } else {
      console.log('✅ CRIME DETECTED:', classification.crimeType, 
        classification.confidence + '%');
    }
    
    console.groupEnd();
    
    // Call the saved original handler if it exists
    if (savedOriginalCallback) {
      savedOriginalCallback.call(this, predictions, frameData);
    }
  };
  
  // Override the setter to intercept when app.js sets the callback
  Object.defineProperty(DetectionEngine, 'onDetection', {
    get() {
      return debugWrapper;
    },
    set(fn) {
      // Save the original function that app.js is trying to set
      savedOriginalCallback = fn;
    },
    configurable: true
  });
})();

// Add a button to test with a simpler rule
function addTestMode() {
  // Create test mode toggle
  const testButton = document.createElement('button');
  testButton.className = 'btn btn--secondary';
  testButton.innerHTML = '<i data-lucide="bug"></i> Enable Test Mode (Detect ANY Person)';
  testButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999;';
  
  let testModeEnabled = false;
  
  testButton.addEventListener('click', () => {
    testModeEnabled = !testModeEnabled;
    
    if (testModeEnabled) {
      testButton.innerHTML = '<i data-lucide="bug-off"></i> Disable Test Mode';
      testButton.classList.add('btn--warning');
      
      // Add a simple rule that triggers on ANY person detection
      CrimeClassifier.RULES.unshift({
        type: 'suspicious',
        check(objects, context) {
          const persons = objects.filter(o => o.class === 'person');
          if (persons.length > 0) {
            console.log('🧪 TEST MODE: Person detected, triggering alert');
            return 0.85; // High confidence
          }
          return 0;
        },
      });
      
      Toast.success('Test mode enabled - will detect ANY person as suspicious');
    } else {
      testButton.innerHTML = '<i data-lucide="bug"></i> Enable Test Mode';
      testButton.classList.remove('btn--warning');
      
      // Remove test rule
      CrimeClassifier.RULES.shift();
      
      Toast.info('Test mode disabled');
    }
    
    if (window.lucide) lucide.createIcons({ nodes: [testButton] });
  });
  
  document.body.appendChild(testButton);
  if (window.lucide) lucide.createIcons({ nodes: [testButton] });
}

// Add test mode button when page loads
window.addEventListener('load', () => {
  setTimeout(addTestMode, 1000);
});

console.log('🐛 Debug mode activated - Check console for detailed logs');