<template>
  <div class="comparison-panel">
    <h2 class="panel-title">Manifest Comparison</h2>

    <div class="radio-group">
      <label
        class="radio-label"
        :class="{ 'radio-active': viewMode === 'manifest' }"
      >
        <input
          type="radio"
          :checked="viewMode === 'manifest'"
          @change="$emit('update:view-mode', 'manifest')"
          value="manifest"
        />
        <span class="radio-text">Manifest Comparison</span>
      </label>
      <label
        class="radio-label"
        :class="{ 'radio-active': viewMode === 'segments' }"
      >
        <input
          type="radio"
          :checked="viewMode === 'segments'"
          @change="$emit('update:view-mode', 'segments')"
          value="segments"
        />
        <span class="radio-text">Segments</span>
      </label>
      <button
        v-if="hasPlayers"
        @click="$emit('clear-all-segments')"
        class="clear-all-button"
      >
        Clear All Segments
      </button>
    </div>

    <div
      v-if="
        viewMode === 'manifest' &&
        (comparison.length || sourceManifest || ssaiManifest)
      "
    >
      <div v-if="comparison.length" class="modern-filters">
        <div class="filter-header">
          <div class="filter-title-section">
            <h4 class="filter-title">Filter Results</h4>
            <div class="filter-summary">
              {{ filteredComparison.length }} of {{ comparison.length }} issues
            </div>
          </div>
          <div class="filter-actions">
            <button
              @click="selectAllSeverities"
              class="action-btn"
              :class="{ active: selectedSeverities.length === 5 }"
            >
              All
            </button>
            <button
              @click="clearAllSeverities"
              class="action-btn"
              :class="{ active: selectedSeverities.length === 0 }"
            >
              None
            </button>
          </div>
        </div>

        <div class="severity-pills">
          <button
            v-for="severity in ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'INFO']"
            :key="severity"
            @click="toggleSeverityFilter(severity)"
            class="severity-pill"
            :class="[
              getSeverityPillClass(severity),
              { 'pill-active': isSeveritySelected(severity) },
            ]"
          >
            <span class="pill-label">{{ getSeverityLabel(severity) }}</span>
            <span class="pill-count">{{ severityCounts[severity] }}</span>
          </button>
        </div>
      </div>

      <table v-if="filteredComparison.length" class="comparison-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Issue Type</th>
            <th>Tag/Segment</th>
            <th>Attribute</th>
            <th>Source Value</th>
            <th>SSAI Value</th>
            <th>How to Solve the Issue?</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in filteredComparison"
            :key="index"
            :class="getSeverityClass(item.severity)"
          >
            <td data-label="Severity">
              <span :class="getSeverityBadgeClass(item.severity)">
                {{ item.severity || "MEDIUM" }}
              </span>
            </td>
            <td data-label="Issue Type">{{ item.type }}</td>
            <td data-label="Tag/Segment">{{ item.tag }}</td>
            <td data-label="Attribute">{{ item.attribute || "" }}</td>
            <td data-label="Source Value" class="value-cell">
              {{ item.sourceValue }}
            </td>
            <td data-label="SSAI Value" class="value-cell">
              {{ item.ssaiValue }}
            </td>
            <td data-label="Solution" class="solution-cell">
              {{ item.solution }}
              <div v-if="item.impact" class="impact-note">
                <strong>Impact:</strong> {{ item.impact }}
              </div>
              <div
                v-if="item.message && item.message !== item.solution"
                class="detail-note"
              >
                <strong>Details:</strong> {{ item.message }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-else-if="comparison.length && !filteredComparison.length"
        class="no-results"
      >
        <div class="no-results-content">
          <div class="no-results-icon">🔍</div>
          <h3>No matching issues</h3>
          <p>No issues match your current filter selection.</p>
          <button @click="selectAllSeverities" class="reset-btn">
            Show All Issues
          </button>
        </div>
      </div>
      <div v-else class="placeholder-text">
        No differences found. Load both manifests to see differences and timing
        issues.
      </div>
    </div>

    <!-- Segments View -->
    <div
      v-else-if="viewMode === 'segments'"
      class="segment-comparison-vertical"
    >
      <SegmentPanel
        title="Source Segments"
        :segments="sourceSegments"
        :loading="sourceSegmentsLoading"
        :initially-collapsed="false"
        @clear-segments="$emit('clear-segments', 'source')"
      />
      <SegmentPanel
        title="SSAI Segments"
        :segments="ssaiSegments"
        :loading="ssaiSegmentsLoading"
        :initially-collapsed="false"
        @clear-segments="$emit('clear-segments', 'ssai')"
      />
    </div>

    <div v-else class="placeholder-text">
      Load both manifests to see differences and timing issues.
    </div>
  </div>
</template>

<script>
import SegmentPanel from "./SegmentPanel.vue";

export default {
  name: "ComparisonPanel",
  components: {
    SegmentPanel,
  },
  props: {
    viewMode: {
      type: String,
      default: "manifest",
    },
    comparison: {
      type: Array,
      default: () => [],
    },
    sourceManifest: {
      type: [Object, XMLDocument],
      default: null,
    },
    ssaiManifest: {
      type: [Object, XMLDocument],
      default: null,
    },
    sourceSegments: {
      type: Array,
      default: () => [],
    },
    ssaiSegments: {
      type: Array,
      default: () => [],
    },
    sourceSegmentsLoading: {
      type: Boolean,
      default: false,
    },
    ssaiSegmentsLoading: {
      type: Boolean,
      default: false,
    },
    hasPlayers: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      selectedSeverities: ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "INFO"],
    };
  },
  computed: {
    filteredComparison() {
      if (this.viewMode !== "manifest") return this.comparison;

      return this.comparison.filter((item) => {
        const severity = item.severity || "MEDIUM";
        return this.selectedSeverities.includes(severity);
      });
    },
    severityCounts() {
      const counts = {
        VERY_HIGH: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        INFO: 0,
      };

      this.comparison.forEach((item) => {
        const severity = item.severity || "MEDIUM";
        if (Object.prototype.hasOwnProperty.call(counts, severity)) {
          counts[severity]++;
        }
      });

      return counts;
    },
  },
  emits: ["update:viewMode", "clear-all-segments", "clear-segments"],
  methods: {
    getSeverityClass(severity) {
      switch (severity) {
        case "VERY_HIGH":
          return "severity-very-high";
        case "HIGH":
          return "severity-high";
        case "MEDIUM":
          return "severity-medium";
        case "LOW":
          return "severity-low";
        case "INFO":
          return "severity-info";
        default:
          return "severity-medium";
      }
    },
    getSeverityBadgeClass(severity) {
      switch (severity) {
        case "VERY_HIGH":
          return "badge badge-critical";
        case "HIGH":
          return "badge badge-error";
        case "MEDIUM":
          return "badge badge-warning";
        case "LOW":
          return "badge badge-info";
        case "INFO":
          return "badge badge-success";
        default:
          return "badge badge-warning";
      }
    },
    getSeverityPillClass(severity) {
      switch (severity) {
        case "VERY_HIGH":
          return "pill-critical";
        case "HIGH":
          return "pill-error";
        case "MEDIUM":
          return "pill-warning";
        case "LOW":
          return "pill-info";
        case "INFO":
          return "pill-success";
        default:
          return "pill-warning";
      }
    },
    getSeverityLabel(severity) {
      switch (severity) {
        case "VERY_HIGH":
          return "Critical";
        case "HIGH":
          return "High";
        case "MEDIUM":
          return "Medium";
        case "LOW":
          return "Low";
        case "INFO":
          return "Info";
        default:
          return "Medium";
      }
    },
    toggleSeverityFilter(severity) {
      const index = this.selectedSeverities.indexOf(severity);
      if (index > -1) {
        this.selectedSeverities.splice(index, 1);
      } else {
        this.selectedSeverities.push(severity);
      }
    },
    selectAllSeverities() {
      this.selectedSeverities = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "INFO"];
    },
    clearAllSeverities() {
      this.selectedSeverities = [];
    },
    isSeveritySelected(severity) {
      return this.selectedSeverities.includes(severity);
    },
  },
};
</script>

<style scoped>
.comparison-panel {
  grid-column: span 2;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 24px;
  background: white;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.comparison-panel:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.panel-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 20px;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-title::before {
  /* content: '🔍'; */
  font-size: 1.5rem;
}

.radio-group {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 8px;
  transition: all 0.2s ease;
  font-weight: 500;
  border: 2px solid transparent;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.radio-label:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.radio-label.radio-active {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border-color: #3b82f6;
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
}

.radio-label input {
  cursor: pointer;
  accent-color: #3b82f6;
}

.radio-text {
  font-weight: 600;
  letter-spacing: 0.025em;
}

.clear-all-button {
  background: linear-gradient(135deg, #6b7280, #4b5563);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  margin-left: auto;
  transition: all 0.2s ease;
  font-weight: 600;
  font-size: 13px;
  box-shadow: 0 2px 4px rgba(107, 114, 128, 0.2);
}

.clear-all-button:hover {
  background: linear-gradient(135deg, #4b5563, #374151);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(107, 114, 128, 0.3);
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  background: white;
}

.comparison-table th,
.comparison-table td {
  border: 1px solid #e5e7eb;
  padding: 12px 16px;
  text-align: left;
  vertical-align: top;
}

.comparison-table th {
  background: linear-gradient(135deg, #1f2937, #374151);
  color: white;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.comparison-table td {
  color: #1f2937;
  font-size: 14px;
  line-height: 1.5;
}

.comparison-table tr:nth-child(even) {
  background-color: #f9fafb;
}

.comparison-table tr:hover {
  background-color: #f3f4f6;
  transform: scale(1.001);
  transition: all 0.2s ease;
}

.placeholder-text {
  color: #6b7280;
  font-style: italic;
  text-align: center;
  padding: 40px 20px;
  background: linear-gradient(135deg, #f9fafb, #f3f4f6);
  border-radius: 12px;
  border: 2px dashed #d1d5db;
  font-size: 16px;
}

/* Modern Filters */
.modern-filters {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.filter-title-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.filter-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.filter-summary {
  background: #f3f4f6;
  color: #6b7280;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: #f9fafb;
  color: #6b7280;
  border: 1px solid #e5e7eb;
  padding: 6px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 13px;
}

.action-btn:hover {
  background: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.action-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.severity-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.severity-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  background: #f9fafb;
  color: #6b7280;
  position: relative;
  overflow: hidden;
}

.severity-pill:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.severity-pill.pill-active {
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

/* Pill variants */
.pill-critical {
  border-color: #dc2626;
}

.pill-critical.pill-active {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  border-color: #dc2626;
}

.pill-error {
  border-color: #f59e0b;
}

.pill-error.pill-active {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border-color: #f59e0b;
}

.pill-warning {
  border-color: #8b5cf6;
}

.pill-warning.pill-active {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  border-color: #8b5cf6;
}

.pill-info {
  border-color: #3b82f6;
}

.pill-info.pill-active {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: #3b82f6;
}

.pill-success {
  border-color: #10b981;
}

.pill-success.pill-active {
  background: linear-gradient(135deg, #10b981, #059669);
  border-color: #10b981;
}

.pill-label {
  font-size: 14px;
  font-weight: 600;
}

.pill-count {
  background: rgba(255, 255, 255, 0.2);
  color: inherit;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  min-width: 20px;
  text-align: center;
}

.severity-pill:not(.pill-active) .pill-count {
  background: #e5e7eb;
  color: #6b7280;
}

/* No Results - Simplified */
.no-results {
  padding: 48px 20px;
  text-align: center;
}

.no-results-content {
  max-width: 320px;
  margin: 0 auto;
}

.no-results-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.6;
}

.no-results h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.no-results p {
  color: #6b7280;
  margin-bottom: 20px;
  font-size: 14px;
}

.reset-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  font-size: 14px;
}

.reset-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.segment-comparison-vertical {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 16px;
}

/* Severity-based row styling */
.severity-very-high {
  background: linear-gradient(135deg, #fef2f2, #fee2e2) !important;
  border-left: 4px solid #dc2626;
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.1);
}

.severity-high {
  background: linear-gradient(135deg, #fef3c7, #fde68a) !important;
  border-left: 4px solid #f59e0b;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.1);
}

.severity-medium {
  background: linear-gradient(135deg, #fef7ff, #fae8ff) !important;
  border-left: 4px solid #8b5cf6;
  box-shadow: 0 2px 4px rgba(139, 92, 246, 0.1);
}

.severity-low {
  background: linear-gradient(135deg, #f0f9ff, #dbeafe) !important;
  border-left: 4px solid #3b82f6;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
}

.severity-info {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7) !important;
  border-left: 4px solid #10b981;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.1);
}

/* Severity badges */
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.badge-critical {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: white;
}

.badge-error {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.badge-warning {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: white;
}

.badge-info {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.badge-success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

/* Enhanced table cells */
.value-cell {
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 12px;
  max-width: 200px;
  word-break: break-word;
  background: #f8fafc;
  border-radius: 4px;
  padding: 8px 12px;
}

.solution-cell {
  max-width: 300px;
  line-height: 1.6;
}

.impact-note {
  margin-top: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #fef2f2, #fee2e2);
  border-radius: 6px;
  font-size: 12px;
  color: #dc2626;
  border-left: 3px solid #dc2626;
}

.detail-note {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
  padding: 4px 8px;
  background: #f9fafb;
  border-radius: 4px;
}

/* Responsive design */
@media (max-width: 1200px) {
  .comparison-panel {
    grid-column: span 1;
  }

  .segment-comparison-vertical {
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .comparison-panel {
    padding: 16px;
  }

  .panel-title {
    font-size: 1.5rem;
  }

  .radio-group {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .radio-label {
    justify-content: center;
  }

  .clear-all-button {
    margin-left: 0;
    margin-top: 8px;
  }

  .comparison-table {
    font-size: 12px;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 8px 12px;
  }

  .value-cell {
    max-width: 150px;
    font-size: 11px;
  }

  .solution-cell {
    max-width: 200px;
  }

  /* Filter responsive styles */
  .modern-filters {
    padding: 20px;
  }

  .filter-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .filter-title-section {
    justify-content: space-between;
  }

  .filter-actions {
    justify-content: center;
  }

  .severity-pills {
    justify-content: center;
    gap: 8px;
  }

  .severity-pill {
    flex: 1;
    min-width: 0;
    justify-content: center;
    padding: 8px 12px;
  }

  .pill-label {
    font-size: 13px;
  }

  .pill-count {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .comparison-panel {
    padding: 12px;
  }

  .panel-title {
    font-size: 1.3rem;
  }

  .comparison-table {
    font-size: 11px;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 6px 8px;
  }

  .badge {
    font-size: 10px;
    padding: 2px 8px;
  }

  .value-cell {
    max-width: 120px;
    font-size: 10px;
  }

  .solution-cell {
    max-width: 150px;
  }

  .impact-note,
  .detail-note {
    font-size: 11px;
  }

  /* Filter mobile styles */
  .modern-filters {
    padding: 16px;
  }

  .filter-header {
    gap: 12px;
  }

  .filter-title {
    font-size: 1rem;
  }

  .filter-summary {
    font-size: 12px;
  }

  .action-btn {
    padding: 5px 12px;
    font-size: 12px;
  }

  .severity-pills {
    gap: 6px;
  }

  .severity-pill {
    padding: 6px 10px;
    border-radius: 10px;
  }

  .pill-label {
    font-size: 12px;
  }

  .pill-count {
    font-size: 10px;
    padding: 1px 6px;
  }

  .no-results-icon {
    font-size: 2.5rem;
  }

  .no-results h3 {
    font-size: 1.1rem;
  }

  .no-results p {
    font-size: 13px;
  }

  .reset-btn {
    padding: 8px 16px;
    font-size: 13px;
  }
}

/* Table responsiveness for very small screens */
@media (max-width: 640px) {
  .comparison-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }

  .comparison-table thead,
  .comparison-table tbody,
  .comparison-table th,
  .comparison-table td,
  .comparison-table tr {
    display: block;
  }

  .comparison-table thead tr {
    position: absolute;
    top: -9999px;
    left: -9999px;
  }

  .comparison-table tr {
    border: 1px solid #e5e7eb;
    margin-bottom: 10px;
    padding: 10px;
    border-radius: 8px;
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .comparison-table td {
    border: none;
    position: relative;
    padding-left: 50% !important;
    padding-top: 8px;
    padding-bottom: 8px;
    white-space: normal;
  }

  .comparison-table td:before {
    content: attr(data-label) ": ";
    position: absolute;
    left: 6px;
    width: 45%;
    padding-right: 10px;
    white-space: nowrap;
    font-weight: 600;
    color: #374151;
  }
}
</style>
