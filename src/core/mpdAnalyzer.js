/**
 * MPD Analyzer - Main orchestrator for the canonical MPD analysis pipeline
 */

import { parseMPD } from "./parser.js";
import { normalizeMPD } from "./normalizer.js";
import { compareMPDs } from "./comparator.js";
import { runAllRules, DEFAULT_CONFIG } from "./rules.js";

/**
 * Analyze MPD XML string
 * @param {string} mpdXml - MPD XML content
 * @param {string} [prevMpdXml] - Previous MPD XML for comparison
 * @param {Object} [config] - Rule configuration
 * @returns {Object} Analysis result
 */
export function analyzeMPD(mpdXml, prevMpdXml = null, config = DEFAULT_CONFIG) {
  try {
    // Step 1: Parse XML to JavaScript
    const parsedMPD = parseMPD(mpdXml);
    const prevParsedMPD = prevMpdXml ? parseMPD(prevMpdXml) : null;

    // Step 2: Normalize to canonical model
    const normalizedMPD = normalizeMPD(parsedMPD);
    const prevNormalizedMPD = prevParsedMPD
      ? normalizeMPD(prevParsedMPD)
      : null;

    // Step 3: Compare MPDs (if previous available)
    const comparison = prevNormalizedMPD
      ? compareMPDs(prevNormalizedMPD, normalizedMPD)
      : null;

    // Step 4: Run validation rules
    const ruleResults = runAllRules(normalizedMPD, prevNormalizedMPD, config);

    // Step 5: Generate analysis result
    return {
      success: true,
      normalized: normalizedMPD,
      comparison,
      rules: ruleResults,
      summary: generateSummary(normalizedMPD, comparison, ruleResults),
      metadata: {
        timestamp: new Date().toISOString(),
        periodsCount: normalizedMPD.periods.length,
        hasComparison: !!comparison,
        rulesExecuted: ruleResults.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Generate analysis summary
 * @param {Object} mpd - Normalized MPD
 * @param {Object} comparison - Comparison result
 * @param {Array} rules - Rule results
 * @returns {Object} Summary object
 */
function generateSummary(mpd, comparison, rules) {
  const summary = {
    periods: {
      total: mpd.periods.length,
      withDRM: mpd.periods.filter((p) => p.drmPresent).length,
      withoutDRM: mpd.periods.filter((p) => !p.drmPresent).length,
    },
    adaptations: {
      video: 0,
      audio: 0,
    },
    segments: {
      total: 0,
      byType: { video: 0, audio: 0 },
    },
    rules: {
      total: rules.length,
      errors: rules.filter((r) => r.level === "error").length,
      warnings: rules.filter((r) => r.level === "warning").length,
    },
  };

  // Count adaptations and segments
  for (const period of mpd.periods) {
    for (const adaptation of period.adaptations) {
      summary.adaptations[adaptation.type]++;

      for (const representation of adaptation.representations) {
        summary.segments.total += representation.segments.length;
        summary.segments.byType[adaptation.type] +=
          representation.segments.length;
      }
    }
  }

  // Add comparison summary if available
  if (comparison) {
    summary.changes = {
      publishTimeChanged: comparison.publishTimeChanged,
      periodsAdded: comparison.periodsAdded.length,
      periodsRemoved: comparison.periodsRemoved.length,
      periodsModified: comparison.periodsModified.length,
      segmentsAdded: comparison.segmentChanges.totalAdded,
      segmentsRemoved: comparison.segmentChanges.totalRemoved,
    };
  }

  return summary;
}

/**
 * Analyze multiple MPDs for batch processing
 * @param {Array} mpdList - Array of {xml, id} objects
 * @param {Object} config - Rule configuration
 * @returns {Array} Array of analysis results
 */
export function analyzeMPDs(mpdList, config = DEFAULT_CONFIG) {
  const results = [];
  let prevMpd = null;

  for (const { xml, id } of mpdList) {
    const result = analyzeMPD(xml, prevMpd, config);
    result.id = id;
    results.push(result);

    if (result.success) {
      prevMpd = xml; // Use for next comparison
    }
  }

  return results;
}

/**
 * Get rule configuration with defaults
 * @param {Object} userConfig - User provided configuration
 * @returns {Object} Merged configuration
 */
export function getRuleConfig(userConfig = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };
}
