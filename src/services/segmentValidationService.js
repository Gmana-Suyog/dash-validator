/**
 * Segment Validation Service
 * Implements per-segment validation rules for DASH streams
 */

/**
 * @typedef {Object} SegmentInfo
 * @property {string} periodId
 * @property {string} adaptationSetId
 * @property {string} representationId
 * @property {number} segmentNumber
 * @property {number} startTimeSec
 * @property {number} durationSec
 * @property {number} [downloadTimeSec] - runtime, optional
 */

/**
 * @typedef {Object} SegmentValidationConfig
 * @property {number} maxDownloadRatio - usually 1.0
 * @property {number} minSegmentDurationSec
 * @property {number} maxSegmentDurationSec
 */

/**
 * @typedef {Object} SegmentViolation
 * @property {SegmentInfo} segment
 * @property {string} rule
 * @property {'CRITICAL'} severity
 * @property {string} message
 */

export class SegmentValidationService {
  constructor() {
    // Default configuration (sane for live DASH)
    this.defaultConfig = {
      maxDownloadRatio: 1.0, // download must be <= playback time
      minSegmentDurationSec: 1.5,
      maxSegmentDurationSec: 6.0,
      enableDownloadTimeForVOD: false, // VOD streams often don't need this check
    };
  }

  /**
   * Rule 1 — Download time > segment duration (CRITICAL)
   * Only evaluates if real download timing exists
   */
  violatesDownloadTimeRule(segment, config) {
    // MUST be disabled unless real download timing exists
    if (
      segment.downloadTimeSec == null ||
      segment.downloadTimeSec === undefined
    ) {
      return false; // Cannot evaluate - do not pretend it ran
    }

    // Guard against false positives

    // Case 1: First segment after refresh (TCP warm-up, DNS resolution)
    if (segment.segmentNumber === 0 || segment.isFirstInPeriod) {
      return false; // Skip Rule 1 for first segments
    }

    // Case 2: Cached segments (download time ≈ 0)
    if (segment.downloadTimeSec < 0.05) {
      // 50ms threshold
      return false; // Skip - likely cache hit
    }

    // Case 3: VOD streams (Rule 1 often meaningless unless explicitly enabled)
    if (segment.streamType === "VOD" && !config.enableDownloadTimeForVOD) {
      return false;
    }

    // ✅ Correct production logic: Use ratio-based evaluation
    const ratio = segment.downloadTimeSec / segment.durationSec;
    return ratio > config.maxDownloadRatio;
  }

  /**
   * Rule 2 — Segment duration too long (CRITICAL)
   */
  violatesMaxDuration(segment, config) {
    return segment.durationSec > config.maxSegmentDurationSec;
  }

  /**
   * Rule 3 — Segment duration too short (CRITICAL)
   */
  violatesMinDuration(segment, config) {
    return segment.durationSec < config.minSegmentDurationSec;
  }

  /**
   * Validate a single segment against all rules
   */
  validateSegment(segment, config = this.defaultConfig) {
    const violations = [];

    if (this.violatesDownloadTimeRule(segment, config)) {
      const ratio = segment.downloadTimeSec / segment.durationSec;
      violations.push({
        segment: segment,
        rule: "DOWNLOAD_TIME_EXCEEDED",
        severity: "CRITICAL",
        message: `Download time ratio: ${ratio.toFixed(
          2
        )}x (${segment.downloadTimeSec.toFixed(
          3
        )}s / ${segment.durationSec.toFixed(3)}s) exceeds max ${
          config.maxDownloadRatio
        }x`,
      });
    }

    if (this.violatesMaxDuration(segment, config)) {
      violations.push({
        segment: segment,
        rule: "SEGMENT_TOO_LONG",
        severity: "CRITICAL",
        message: `Segment duration ${segment.durationSec.toFixed(
          3
        )}s exceeds max ${config.maxSegmentDurationSec}s`,
      });
    }

    if (this.violatesMinDuration(segment, config)) {
      violations.push({
        segment: segment,
        rule: "SEGMENT_TOO_SHORT",
        severity: "CRITICAL",
        message: `Segment duration ${segment.durationSec.toFixed(
          3
        )}s below min ${config.minSegmentDurationSec}s`,
      });
    }

    return violations;
  }

  /**
   * Validate all segments
   */
  validateAllSegments(segments, config = this.defaultConfig) {
    const violations = segments.flatMap((seg) =>
      this.validateSegment(seg, config)
    );

    // Count unique segments with violations, not total violations
    const uniqueViolatingSegments = new Set(
      violations.map(
        (v) =>
          `${v.segment.periodId}-${v.segment.adaptationSetId}-${v.segment.representationId}-${v.segment.segmentNumber}`
      )
    );

    return {
      hasCritical: violations.length > 0,
      violations,
      totalSegments: segments.length,
      violatingSegments: uniqueViolatingSegments.size, // Count segments, not violations
    };
  }

  /**
   * Extract segment information from MPD periods
   */
  extractSegmentInfo(periods) {
    const segments = [];

    periods.forEach((period, periodIndex) => {
      const periodId =
        period.id?.parsed ||
        period.id?.raw ||
        period.id ||
        `period_${periodIndex}`;
      const adaptationSets = this.ensureArray(period.AdaptationSet);

      adaptationSets.forEach((as, asIndex) => {
        const adaptationSetId =
          as.id?.parsed || as.id?.raw || as.id || `as_${asIndex}`;
        const contentType =
          as.contentType?.parsed || this.inferContentType(as.mimeType?.parsed);
        const representations = this.ensureArray(as.Representation);

        representations.forEach((rep, repIndex) => {
          const representationId =
            rep.id?.parsed || rep.id?.raw || rep.id || `rep_${repIndex}`;

          if (rep.SegmentTemplate && rep.SegmentTemplate.SegmentTimeline) {
            const timescale = rep.SegmentTemplate.timescale?.parsed || 1;
            const sElements = this.ensureArray(
              rep.SegmentTemplate.SegmentTimeline.S
            );

            let currentTime = 0;
            let segmentNumber = 0;

            sElements.forEach((s) => {
              const t = s.t?.parsed;
              const d = s.d?.parsed;
              const r = s.r?.parsed || 0;

              if (t !== undefined) {
                currentTime = t;
              }

              // Process each segment (including repeats)
              for (let i = 0; i <= r; i++) {
                const startTimeSec = currentTime / timescale;
                const durationSec = d / timescale;

                segments.push({
                  periodId,
                  adaptationSetId,
                  representationId,
                  contentType,
                  segmentNumber,
                  startTimeSec,
                  durationSec,
                  downloadTimeSec: null, // Will be populated during actual downloads
                  isFirstInPeriod: segmentNumber === 0, // Mark first segments to avoid false positives
                  streamType: null, // Will be determined from MPD type attribute
                });

                currentTime += d;
                segmentNumber++;
              }
            });
          }
        });
      });
    });

    return segments;
  }

  /**
   * Format segment details for display
   */
  formatSegmentDetails(violation) {
    const seg = violation.segment;
    return `Period: ${seg.periodId} | AdaptationSet: ${
      seg.contentType || seg.adaptationSetId
    } | Representation: ${seg.representationId} | Segment #: ${
      seg.segmentNumber
    } | Start time: ${seg.startTimeSec.toFixed(
      3
    )}s | Duration: ${seg.durationSec.toFixed(3)}s${
      seg.downloadTimeSec
        ? ` | Download time: ${seg.downloadTimeSec.toFixed(3)}s`
        : ""
    } | Violation: ${violation.message}`;
  }

  /**
   * Helper method to ensure array
   */
  ensureArray(item) {
    if (!item) return [];
    return Array.isArray(item) ? item : [item];
  }

  /**
   * Infer content type from mime type
   */
  inferContentType(mimeType) {
    if (!mimeType) return "unknown";
    if (mimeType.includes("video")) return "video";
    if (mimeType.includes("audio")) return "audio";
    if (mimeType.includes("text") || mimeType.includes("application"))
      return "text";
    return "unknown";
  }
}

export default SegmentValidationService;
