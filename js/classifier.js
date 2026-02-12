/**
 * classifier.js — CrimeVision AI
 * Crime classification from COCO-SSD detection results
 *
 * Uses object co-occurrence, proximity, and count heuristics to classify
 * crime types from object detection outputs (person, knife, etc.)
 */

'use strict';

const CrimeClassifier = {

  // ---- COCO-SSD class → threat mapping ----

  WEAPON_CLASSES: ['knife', 'scissors', 'baseball bat'],
  PERSON_CLASS: 'person',
  VEHICLE_CLASSES: ['car', 'truck', 'motorcycle', 'bicycle'],
  VALUABLE_CLASSES: ['handbag', 'backpack', 'suitcase', 'laptop', 'cell phone'],

  // Crime classification rules based on detected objects
  RULES: [
    // NEW RULE: Detect weapons even without person present
    {
      type: 'weapon_detected',
      check(objects, context) {
        const weapons = objects.filter(o => CrimeClassifier.WEAPON_CLASSES.includes(o.class));
        if (weapons.length > 0) {
          const maxWeaponScore = Math.max(...weapons.map(w => w.score || 0.5));
          const baseConfidence = 0.85;
          const scoreBonus = maxWeaponScore * 0.10;
          return Math.min(baseConfidence + scoreBonus, 0.95);
        }
        return 0;
      },
    },
    // EXISTING RULES (unchanged)
    {
      type: 'robbery',
      check(objects, context) {
        const hasWeapon = objects.some(o => CrimeClassifier.WEAPON_CLASSES.includes(o.class));
        const hasPerson = objects.filter(o => o.class === 'person').length >= 1;
        const hasValuable = objects.some(o => CrimeClassifier.VALUABLE_CLASSES.includes(o.class));
        if (hasWeapon && hasPerson && hasValuable) return 0.88;
        if (hasWeapon && hasPerson) return 0.75;
        return 0;
      },
    },
    {
      type: 'violence',
      check(objects, context) {
        const persons = objects.filter(o => o.class === 'person');
        const hasWeapon = objects.some(o => CrimeClassifier.WEAPON_CLASSES.includes(o.class));

        // Weapon near person
        if (hasWeapon && persons.length >= 1) return 0.82;

        // Multiple persons in close proximity (potential violence)
        if (persons.length >= 2) {
          const closeProximity = CrimeClassifier._checkProximity(persons, 0.3);
          if (closeProximity && hasWeapon) return 0.90;
          if (closeProximity) return 0.65;
        }
        return 0;
      },
    },
    {
      type: 'fighting',
      check(objects, context) {
        const persons = objects.filter(o => o.class === 'person');
        if (persons.length >= 2) {
          // Multiple people very close together
          const veryClose = CrimeClassifier._checkProximity(persons, 0.2);
          if (veryClose) {
            // Higher confidence with more people
            const base = 0.70;
            const bonus = Math.min((persons.length - 2) * 0.05, 0.15);
            return base + bonus;
          }
          // Moderate proximity
          const moderate = CrimeClassifier._checkProximity(persons, 0.35);
          if (moderate && persons.length >= 3) return 0.60;
        }
        return 0;
      },
    },
    {
      type: 'theft',
      check(objects, context) {
        const persons = objects.filter(o => o.class === 'person');
        const valuables = objects.filter(o => CrimeClassifier.VALUABLE_CLASSES.includes(o.class));

        if (persons.length >= 1 && valuables.length >= 1) {
          // Person near valuable item
          const personNearValuable = CrimeClassifier._checkObjectProximity(persons, valuables, 0.4);
          if (personNearValuable && persons.length >= 2) return 0.72;
          if (personNearValuable) return 0.55;
        }
        return 0;
      },
    },
    {
      type: 'suspicious',
      check(objects, context) {
        const persons = objects.filter(o => o.class === 'person');

        // Single person with weapon
        if (persons.length === 1) {
          const hasWeapon = objects.some(o => CrimeClassifier.WEAPON_CLASSES.includes(o.class));
          if (hasWeapon) return 0.78;
        }

        // Unusual number of people
        if (persons.length >= 5) return 0.55;

        // Person near vehicle (potential break-in)
        const vehicles = objects.filter(o => CrimeClassifier.VEHICLE_CLASSES.includes(o.class));
        if (persons.length >= 1 && vehicles.length >= 1) {
          const nearVehicle = CrimeClassifier._checkObjectProximity(persons, vehicles, 0.25);
          if (nearVehicle) return 0.50;
        }

        return 0;
      },
    },
  ],

  // ---- MAIN CLASSIFY FUNCTION ----

  /**
   * Classify crime from an array of COCO-SSD predictions
   * @param {Array} predictions - [{class, score, bbox}, ...]
   * @param {Object} context - {width, height, frameNumber, ...}
   * @returns {Object} { crimeType, confidence, objects, details }
   */
  classify(predictions, context = {}) {
    if (!predictions || predictions.length === 0) {
      return { crimeType: 'normal', confidence: 0, objects: [], details: 'No objects detected' };
    }

    const objects = predictions.map(p => ({
      class: p.class,
      score: p.score,
      bbox: p.bbox, // [x, y, width, height]
    }));

    const enabledTypes = this._getEnabledTypes();
    let bestMatch = { type: 'normal', confidence: 0 };

    // Run all rules, keep the highest confidence match
    for (const rule of this.RULES) {
      if (!enabledTypes.includes(rule.type)) continue;

      const confidence = rule.check(objects, context);
      if (confidence > bestMatch.confidence) {
        bestMatch = { type: rule.type, confidence };
      }
    }

    // Scale confidence (our heuristic 0-1 → mapped to a percentage)
    const finalConfidence = Math.round(bestMatch.confidence * 100);
    const detectedClasses = [...new Set(objects.map(o => o.class))];

    return {
      crimeType: bestMatch.confidence > 0 ? bestMatch.type : 'normal',
      confidence: finalConfidence,
      objects: detectedClasses,
      objectDetails: objects,
      details: bestMatch.confidence > 0
        ? `${CRIME_TYPES[bestMatch.type]?.label || bestMatch.type} detected with ${finalConfidence}% confidence`
        : 'Scene appears normal',
    };
  },

  // ---- PROXIMITY HELPERS ----

  /**
   * Check if any two persons are within threshold distance (normalized)
   */
  _checkProximity(personObjects, threshold) {
    for (let i = 0; i < personObjects.length; i++) {
      for (let j = i + 1; j < personObjects.length; j++) {
        const dist = this._bboxDistance(personObjects[i].bbox, personObjects[j].bbox);
        if (dist < threshold) return true;
      }
    }
    return false;
  },

  /**
   * Check if any object from group A is near any object from group B
   */
  _checkObjectProximity(groupA, groupB, threshold) {
    for (const a of groupA) {
      for (const b of groupB) {
        const dist = this._bboxDistance(a.bbox, b.bbox);
        if (dist < threshold) return true;
      }
    }
    return false;
  },

  /**
   * Calculate normalized center distance between two bboxes
   * bbox format: [x, y, width, height]
   */
  _bboxDistance(bboxA, bboxB) {
    if (!bboxA || !bboxB) return Infinity;
    const [ax, ay, aw, ah] = bboxA;
    const [bx, by, bw, bh] = bboxB;
    const acx = ax + aw / 2;
    const acy = ay + ah / 2;
    const bcx = bx + bw / 2;
    const bcy = by + bh / 2;

    // Normalize by average bbox size
    const avgSize = ((aw + ah + bw + bh) / 4) || 1;
    const dx = (acx - bcx) / avgSize;
    const dy = (acy - bcy) / avgSize;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Check if two bboxes overlap (IoU > 0)
   */
  _bboxOverlap(bboxA, bboxB) {
    if (!bboxA || !bboxB) return false;
    const [ax, ay, aw, ah] = bboxA;
    const [bx, by, bw, bh] = bboxB;
    return !(ax + aw < bx || bx + bw < ax || ay + ah < by || by + bh < ay);
  },

  // ---- ENABLED TYPES ----

  _getEnabledTypes() {
    const types = [];
    if (getSetting('detectWeapon'))     types.push('weapon_detected'); // NEW
    if (getSetting('detectViolence'))   types.push('violence');
    if (getSetting('detectTheft'))      types.push('theft');
    if (getSetting('detectFighting'))   types.push('fighting');
    if (getSetting('detectVandalism'))  types.push('vandalism');
    if (getSetting('detectRobbery'))    types.push('robbery');
    if (getSetting('detectSuspicious')) types.push('suspicious');
    return types;
  },
};