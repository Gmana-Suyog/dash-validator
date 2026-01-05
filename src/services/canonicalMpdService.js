/**
 * Canonical MPD Service - Integration layer between new architecture and Vue components
 */

import { analyzeMPD, getRuleConfig } from "../core/mpdAnalyzer.js";

/**
 * Service for canonical MPD analysis
 */
export class CanonicalMpdService {
  constructor() {
    this.config = getRuleConfig();
    this.previousMpdXml = null;
  }

  /**
   * Set rule configuration
   * @param {Object} config - Rule configuration
   */
  setConfig(config) {
    this.config = getRuleConfig(config);
  }

  /**
   * Analyze MPD and return Vue-compatible results
   * @param {string} mpdXml - MPD XML content
   * @returns {Object} Analysis results formatted for Vue components
   */
  async analyzeMpdForVue(mpdXml) {
    const analysis = analyzeMPD(mpdXml, this.previousMpdXml, this.config);

    if (!analysis.success) {
      throw new Error(analysis.error);
    }

    // Store for next comparison
    this.previousMpdXml = mpdXml;

    // Convert to Vue-compatible format
    return this.convertToVueFormat(analysis);
  }

  /**
   * Convert analysis result to Vue component format
   * @param {Object} analysis - Analysis result from core
   * @returns {Object} Vue-compatible format
   */
  convertToVueFormat(analysis) {
    const { normalized, comparison, rules, summary } = analysis;

    // Convert to the format expected by SingleComparison.vue
    const vueFormat = [];

    // Basic metrics
    vueFormat.push({
      metric: "Total Periods",
      value: summary.periods.total.toString(),
      status: "OK",
      statusClass: "status-ok",
      hasDifference: false,
    });

    vueFormat.push({
      metric: "Content Periods",
      value: summary.periods.withoutDRM.toString(),
      status: "OK",
      statusClass: "status-ok",
      hasDifference: false,
    });

    vueFormat.push({
      metric: "Ad Periods",
      value: summary.periods.withDRM.toString(),
      status: summary.periods.withDRM > 0 ? "INFO" : "OK",
      statusClass: summary.periods.withDRM > 0 ? "status-info" : "status-ok",
      hasDifference: false,
    });

    // Comparison metrics (if available)
    if (comparison) {
      vueFormat.push({
        metric: "Number Period Added (provide Id)",
        value: this.formatPeriodsAdded(comparison.periodsAdded),
        status: comparison.periodsAdded.length > 0 ? "ADDED" : "OK",
        statusClass:
          comparison.periodsAdded.length > 0 ? "status-added" : "status-ok",
        hasDifference: comparison.periodsAdded.length > 0,
      });

      vueFormat.push({
        metric: "Number of Period Removed",
        value: this.formatPeriodsRemoved(comparison.periodsRemoved),
        status: comparison.periodsRemoved.length > 0 ? "REMOVED" : "OK",
        statusClass:
          comparison.periodsRemoved.length > 0 ? "status-removed" : "status-ok",
        hasDifference: comparison.periodsRemoved.length > 0,
      });

      vueFormat.push({
        metric: "Number of Segments Added",
        value: comparison.segmentChanges.totalAdded.toString(),
        status: comparison.segmentChanges.totalAdded > 0 ? "ADDED" : "OK",
        statusClass:
          comparison.segmentChanges.totalAdded > 0
            ? "status-added"
            : "status-ok",
        hasDifference: comparison.segmentChanges.totalAdded > 0,
      });

      vueFormat.push({
        metric: "Number of Segments Removed",
        value: comparison.segmentChanges.totalRemoved.toString(),
        status: comparison.segmentChanges.totalRemoved > 0 ? "REMOVED" : "OK",
        statusClass:
          comparison.segmentChanges.totalRemoved > 0
            ? "status-removed"
            : "status-ok",
        hasDifference: comparison.segmentChanges.totalRemoved > 0,
      });
    }

    // Rule-based metrics
    const profileRule = rules.find((r) => r.ruleId === "PROFILE_MISMATCH");
    vueFormat.push({
      metric: "Profile same in all Periods",
      value: profileRule ? "No" : "Yes",
      status: profileRule ? "INCONSISTENT" : "OK",
      statusClass: profileRule ? "status-error-red" : "status-ok",
      hasDifference: !!profileRule,
      tooltip: profileRule
        ? profileRule.message
        : "All periods have consistent profiles",
    });

    const avDurationRule = rules.find(
      (r) => r.ruleId === "AV_DURATION_MISMATCH"
    );
    vueFormat.push({
      metric: "Video and Audio Duration are Same",
      value: avDurationRule ? "No" : "Yes",
      status: avDurationRule ? "MISMATCH" : "OK",
      statusClass: avDurationRule ? "status-error-red" : "status-ok",
      hasDifference: !!avDurationRule,
      tooltip: avDurationRule
        ? avDurationRule.message
        : "All video and audio durations match",
    });

    // Start time validation
    const startTimeRules = rules.filter(
      (r) => r.ruleId === "PERIOD_START_CHANGED"
    );
    vueFormat.push({
      metric: "Start Time Correct?",
      value: this.formatStartTimeResults(normalized.periods, startTimeRules),
      status: startTimeRules.length > 0 ? "INCORRECT" : "OK",
      statusClass: startTimeRules.length > 0 ? "status-error" : "status-ok",
      hasDifference: startTimeRules.length > 0,
      tooltip:
        startTimeRules.length > 0
          ? startTimeRules.map((r) => r.message).join("\n")
          : "All period start times are correct",
    });

    // Segment timing validation
    const segmentRules = rules.filter((r) => r.ruleId.includes("SEGMENT_"));
    vueFormat.push({
      metric: "Is Segment Timing Correct?",
      value:
        segmentRules.length > 0 ? `No (${segmentRules.length} issues)` : "Yes",
      status: segmentRules.length > 0 ? "TIMING_ERROR" : "OK",
      statusClass: segmentRules.length > 0 ? "status-error" : "status-ok",
      hasDifference: segmentRules.length > 0,
      tooltip:
        segmentRules.length > 0
          ? segmentRules.map((r) => r.message).join("\n")
          : "All segment timing is correct",
    });

    // Additional metrics for compatibility
    vueFormat.push({
      metric: "Profile",
      value: "",
      status: "INFO",
      statusClass: "status-info",
      hasDifference: false,
    });

    vueFormat.push({
      metric: "Time Diff(s)",
      value: this.formatTimeDiff(summary),
      status: "INFO",
      statusClass: "status-info",
      hasDifference: false,
    });

    vueFormat.push({
      metric: "Switch Profile",
      value: "",
      status: "INFO",
      statusClass: "status-info",
      hasDifference: false,
    });

    return {
      analysis: vueFormat,
      rules: rules,
      summary: summary,
      normalized: normalized,
    };
  }

  /**
   * Format periods added for display
   * @param {Array} periodsAdded - Added periods
   * @returns {string} Formatted string
   */
  formatPeriodsAdded(periodsAdded) {
    if (periodsAdded.length === 0) return "0";

    const ids = periodsAdded.map((p) => `Id="${p.id}"`).join("\n");
    return `${periodsAdded.length} (Number of periods added)\n${ids}`;
  }

  /**
   * Format periods removed for display
   * @param {Array} periodsRemoved - Removed periods
   * @returns {string} Formatted string
   */
  formatPeriodsRemoved(periodsRemoved) {
    if (periodsRemoved.length === 0) return "0";

    const ids = periodsRemoved.map((p) => `Id="${p.id}"`).join("\n");
    return `${periodsRemoved.length} (Number of periods removed)\n${ids}`;
  }

  /**
   * Format start time results for display
   * @param {Array} periods - Normalized periods
   * @param {Array} startTimeRules - Start time rule results
   * @returns {string} Formatted string
   */
  formatStartTimeResults(periods, startTimeRules) {
    if (startTimeRules.length === 0) {
      return periods
        .map((p) => `Period Id="${p.id}": Start=${p.start || 0}s, Correct=Yes`)
        .join("\n");
    }

    return periods
      .map((p) => {
        const hasError = startTimeRules.some(
          (r) => r.details.periodId === p.id
        );
        return `Period Id="${p.id}": Start=${p.start || 0}s, Correct=${
          hasError ? "No" : "Yes"
        }`;
      })
      .join("\n");
  }

  /**
   * Format time diff for display
   * @param {Object} summary - Analysis summary
   * @returns {string} Formatted string
   */
  formatTimeDiff(summary) {
    if (summary.changes) {
      const changes = [];
      if (summary.changes.segmentsAdded > 0) {
        changes.push(`+${summary.changes.segmentsAdded} segments`);
      }
      if (summary.changes.segmentsRemoved > 0) {
        changes.push(`-${summary.changes.segmentsRemoved} segments`);
      }
      return changes.join(", ") || "No changes";
    }
    return "Initial load";
  }

  /**
   * Reset analysis state
   */
  reset() {
    this.previousMpdXml = null;
  }
}
