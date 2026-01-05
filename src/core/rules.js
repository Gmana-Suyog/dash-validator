/**
 * Rule Engine - Configurable validation rules
 */

import { segmentsEqual } from "./comparator.js";

/**
 * Default rule configuration
 */
export const DEFAULT_CONFIG = {
  maxDownloadTime: 30, // seconds
  minSegmentDuration: 1, // seconds
  maxSegmentDuration: 10, // seconds
};

/**
 * Run all validation rules on normalized MPD
 * @param {Object} mpd - Normalized MPD
 * @param {Object} prevMPD - Previous normalized MPD (optional)
 * @param {Object} config - Rule configuration
 * @returns {Array} Array of rule results
 */
export function runAllRules(mpd, prevMPD = null, config = DEFAULT_CONFIG) {
  const results = [];

  // Single MPD rules
  results.push(...checkSegmentDuration(mpd, config));
  results.push(...checkDRM(mpd));
  results.push(...checkProfileAlignment(mpd));
  results.push(...compareAudioVideoDuration(mpd));

  // Comparison rules (if previous MPD available)
  if (prevMPD) {
    results.push(...comparePeriodStartTimes(prevMPD, mpd));
    results.push(...comparePeriodIds(prevMPD, mpd));
  }

  return results.filter(Boolean);
}

/**
 * A) Check segment duration thresholds
 * @param {Object} mpd - Normalized MPD
 * @param {Object} config - Rule configuration
 * @returns {Array} Rule results
 */
export function checkSegmentDuration(mpd, config) {
  const results = [];

  for (const period of mpd.periods) {
    for (const adaptation of period.adaptations) {
      for (const representation of adaptation.representations) {
        for (const segment of representation.segments) {
          if (
            config.minSegmentDuration &&
            segment.d < config.minSegmentDuration
          ) {
            results.push({
              ruleId: "SEGMENT_TOO_SHORT",
              level: "error",
              message: `Segment duration ${segment.d}s below threshold ${config.minSegmentDuration}s`,
              details: {
                periodId: period.id,
                adaptationType: adaptation.type,
                representationId: representation.id,
                segmentStart: segment.t,
                duration: segment.d,
                threshold: config.minSegmentDuration,
              },
              highlightSegments: [segment],
            });
          }

          if (
            config.maxSegmentDuration &&
            segment.d > config.maxSegmentDuration
          ) {
            results.push({
              ruleId: "SEGMENT_TOO_LONG",
              level: "error",
              message: `Segment duration ${segment.d}s above threshold ${config.maxSegmentDuration}s`,
              details: {
                periodId: period.id,
                adaptationType: adaptation.type,
                representationId: representation.id,
                segmentStart: segment.t,
                duration: segment.d,
                threshold: config.maxSegmentDuration,
              },
              highlightSegments: [segment],
            });
          }
        }
      }
    }
  }

  return results;
}

/**
 * B) Compare start times between periods
 * @param {Object} prev - Previous normalized MPD
 * @param {Object} curr - Current normalized MPD
 * @returns {Array} Rule results
 */
export function comparePeriodStartTimes(prev, curr) {
  const results = [];

  for (let i = 0; i < curr.periods.length; i++) {
    const currPeriod = curr.periods[i];
    const prevPeriod = prev.periods[i];

    if (!prevPeriod) continue;

    if (currPeriod.start !== prevPeriod.start) {
      results.push({
        ruleId: "PERIOD_START_CHANGED",
        level: "warning",
        message: `Period ${currPeriod.id || i} start time changed`,
        details: {
          periodId: currPeriod.id,
          periodIndex: i,
          prev: prevPeriod.start,
          curr: currPeriod.start,
          diff: currPeriod.start - prevPeriod.start,
        },
      });
    }
  }

  return results;
}

/**
 * C) Check DRM presence per Period
 * @param {Object} mpd - Normalized MPD
 * @returns {Array} Rule results
 */
export function checkDRM(mpd) {
  const results = [];

  for (const period of mpd.periods) {
    if (!period.drmPresent) {
      results.push({
        ruleId: "DRM_MISSING",
        level: "error",
        message: `DRM protection missing in Period ${period.id || "unknown"}`,
        details: {
          periodId: period.id,
        },
      });
    }
  }

  return results;
}

/**
 * D) Check that all segments are the same across profiles
 * @param {Object} mpd - Normalized MPD
 * @returns {Array} Rule results
 */
export function checkProfileAlignment(mpd) {
  const results = [];

  for (const period of mpd.periods) {
    for (const adaptation of period.adaptations) {
      if (adaptation.representations.length < 2) continue;

      const baseSegments = adaptation.representations[0].segments;

      for (let i = 1; i < adaptation.representations.length; i++) {
        const repSegments = adaptation.representations[i].segments;

        if (!segmentsEqual(baseSegments, repSegments)) {
          results.push({
            ruleId: "PROFILE_MISMATCH",
            level: "error",
            message: `Segments differ across profiles in ${adaptation.type} adaptation`,
            details: {
              periodId: period.id,
              adaptationType: adaptation.type,
              baseRepId: adaptation.representations[0].id,
              mismatchRepId: adaptation.representations[i].id,
              baseSegmentCount: baseSegments.length,
              mismatchSegmentCount: repSegments.length,
            },
          });
        }
      }
    }
  }

  return results;
}

/**
 * E) Compare video vs audio segment duration
 * @param {Object} mpd - Normalized MPD
 * @returns {Array} Rule results
 */
export function compareAudioVideoDuration(mpd) {
  const results = [];

  for (const period of mpd.periods) {
    const videoAdaptation = period.adaptations.find((a) => a.type === "video");
    const audioAdaptation = period.adaptations.find((a) => a.type === "audio");

    if (!videoAdaptation || !audioAdaptation) continue;

    const videoSegments = videoAdaptation.representations[0]?.segments || [];
    const audioSegments = audioAdaptation.representations[0]?.segments || [];

    if (videoSegments.length === 0 || audioSegments.length === 0) continue;

    const videoDuration = videoSegments[0].d;
    const audioDuration = audioSegments[0].d;

    if (Math.abs(videoDuration - audioDuration) > 1e-6) {
      results.push({
        ruleId: "AV_DURATION_MISMATCH",
        level: "warning",
        message: `Audio and video segment durations differ in Period ${
          period.id || "unknown"
        }`,
        details: {
          periodId: period.id,
          videoDuration,
          audioDuration,
          difference: Math.abs(videoDuration - audioDuration),
        },
      });
    }
  }

  return results;
}

/**
 * F) Verify Period IDs unchanged
 * @param {Object} prev - Previous normalized MPD
 * @param {Object} curr - Current normalized MPD
 * @returns {Array} Rule results
 */
export function comparePeriodIds(prev, curr) {
  const results = [];

  for (let i = 0; i < Math.max(prev.periods.length, curr.periods.length); i++) {
    const prevPeriod = prev.periods[i];
    const currPeriod = curr.periods[i];

    if (!prevPeriod || !currPeriod) continue;

    if (prevPeriod.id !== currPeriod.id) {
      results.push({
        ruleId: "PERIOD_ID_CHANGED",
        level: "error",
        message: `Period ID changed at index ${i}`,
        details: {
          periodIndex: i,
          prev: prevPeriod.id,
          curr: currPeriod.id,
        },
      });
    }
  }

  return results;
}
