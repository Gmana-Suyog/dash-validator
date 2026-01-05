/**
 * MPD Normalizer - Converts parsed MPD to canonical model
 */

import { expandTimeline } from "./parser.js";

/**
 * Normalize parsed MPD to canonical model
 * @param {Object} parsedMPD - Parsed MPD object
 * @returns {Object} Normalized MPD
 */
export function normalizeMPD(parsedMPD) {
  const normalized = {
    publishTime: extractPublishTime(parsedMPD),
    periods: [],
  };

  // Extract periods
  const periods = ensureArray(parsedMPD.Period);
  for (const period of periods) {
    normalized.periods.push(normalizePeriod(period));
  }

  return normalized;
}

/**
 * Extract publish time from MPD
 * @param {Object} mpd - Parsed MPD
 * @returns {number|undefined} Publish time as timestamp
 */
function extractPublishTime(mpd) {
  if (mpd.publishTime) {
    return new Date(mpd.publishTime).getTime();
  }
  return undefined;
}

/**
 * Normalize a Period
 * @param {Object} period - Parsed period
 * @returns {Object} Normalized period
 */
function normalizePeriod(period) {
  const normalized = {
    id: period.id,
    start: period.start ? parseFloat(period.start) : undefined,
    drmPresent: checkDRMPresence(period),
    adaptations: [],
  };

  // Extract adaptation sets
  const adaptationSets = ensureArray(period.AdaptationSet);
  for (const as of adaptationSets) {
    const normalizedAS = normalizeAdaptationSet(as);
    if (normalizedAS) {
      normalized.adaptations.push(normalizedAS);
    }
  }

  return normalized;
}

/**
 * Check if DRM is present in period
 * @param {Object} period - Parsed period
 * @returns {boolean} True if DRM is present
 */
function checkDRMPresence(period) {
  // Check for ContentProtection elements
  const adaptationSets = ensureArray(period.AdaptationSet);

  for (const as of adaptationSets) {
    if (as.ContentProtection) {
      return true;
    }

    const representations = ensureArray(as.Representation);
    for (const rep of representations) {
      if (rep.ContentProtection) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Normalize an AdaptationSet
 * @param {Object} as - Parsed adaptation set
 * @returns {Object|null} Normalized adaptation set or null if invalid
 */
function normalizeAdaptationSet(as) {
  const contentType = inferContentType(as);
  if (!contentType) {
    return null; // Skip unknown content types
  }

  const normalized = {
    type: contentType,
    representations: [],
  };

  // Extract representations
  const representations = ensureArray(as.Representation);
  for (const rep of representations) {
    const normalizedRep = normalizeRepresentation(rep, as);
    if (normalizedRep) {
      normalized.representations.push(normalizedRep);
    }
  }

  return normalized.representations.length > 0 ? normalized : null;
}

/**
 * Infer content type from adaptation set
 * @param {Object} as - Adaptation set
 * @returns {string|null} Content type ('video' or 'audio') or null
 */
function inferContentType(as) {
  // Check contentType attribute
  if (as.contentType) {
    if (as.contentType.includes("video")) return "video";
    if (as.contentType.includes("audio")) return "audio";
  }

  // Check mimeType
  if (as.mimeType) {
    if (as.mimeType.includes("video")) return "video";
    if (as.mimeType.includes("audio")) return "audio";
  }

  // Check representations
  const representations = ensureArray(as.Representation);
  for (const rep of representations) {
    if (rep.mimeType) {
      if (rep.mimeType.includes("video")) return "video";
      if (rep.mimeType.includes("audio")) return "audio";
    }
  }

  return null;
}

/**
 * Normalize a Representation
 * @param {Object} rep - Parsed representation
 * @param {Object} as - Parent adaptation set
 * @returns {Object|null} Normalized representation or null if invalid
 */
function normalizeRepresentation(rep, as) {
  const normalized = {
    id: rep.id || `rep_${Math.random().toString(36).substr(2, 9)}`,
    bandwidth: rep.bandwidth ? parseInt(rep.bandwidth) : undefined,
    segments: [],
  };

  // Extract segments from SegmentTemplate
  if (rep.SegmentTemplate || as.SegmentTemplate) {
    const segmentTemplate = rep.SegmentTemplate || as.SegmentTemplate;
    normalized.segments = extractSegments(segmentTemplate);
  }

  return normalized;
}

/**
 * Extract segments from SegmentTemplate
 * @param {Object} segmentTemplate - SegmentTemplate object
 * @returns {Array} Array of segments
 */
function extractSegments(segmentTemplate) {
  if (!segmentTemplate.SegmentTimeline) {
    return [];
  }

  const timescale = segmentTemplate.timescale || 1;
  const timeline = ensureArray(segmentTemplate.SegmentTimeline.S);

  return expandTimeline(timeline, timescale);
}

/**
 * Ensure value is an array
 * @param {any} value - Value to check
 * @returns {Array} Array value
 */
function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
