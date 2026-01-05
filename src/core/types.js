/**
 * Core types for the canonical MPD model and rule engine
 */

/**
 * @typedef {Object} NormalizedMPD
 * @property {number} [publishTime] - MPD publish time
 * @property {Period[]} periods - Array of periods
 */

/**
 * @typedef {Object} Period
 * @property {string} [id] - Period ID
 * @property {number} [start] - Period start time
 * @property {boolean} drmPresent - Whether DRM is present
 * @property {AdaptationSet[]} adaptations - Array of adaptation sets
 */

/**
 * @typedef {Object} AdaptationSet
 * @property {'video'|'audio'} type - Content type
 * @property {Representation[]} representations - Array of representations
 */

/**
 * @typedef {Object} Representation
 * @property {string} id - Representation ID
 * @property {number} [bandwidth] - Bandwidth
 * @property {Segment[]} segments - Array of segments
 */

/**
 * @typedef {Object} Segment
 * @property {number} t - Start time
 * @property {number} d - Duration
 * @property {string} [url] - Segment URL
 */

/**
 * @typedef {Object} RuleResult
 * @property {string} ruleId - Rule identifier
 * @property {'error'|'warning'} level - Severity level
 * @property {string} message - Human readable message
 * @property {any} [details] - Additional details
 * @property {Segment[]} [highlightSegments] - Segments to highlight in UI
 */

/**
 * @typedef {Object} RuleConfig
 * @property {number} [maxDownloadTime] - Maximum download time threshold
 * @property {number} [minSegmentDuration] - Minimum segment duration threshold
 * @property {number} [maxSegmentDuration] - Maximum segment duration threshold
 */

export {};
