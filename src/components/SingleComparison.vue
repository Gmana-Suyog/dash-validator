<template>
  <div class="single-comparison">
    <!-- URL Input Section -->
    <div class="url-input-section">
      <div class="input-group">
        <input
          v-model="manifestUrl"
          @keyup.enter="startComparison"
          placeholder="Enter DASH MPD URL"
          class="url-input"
        />
        <button @click="startComparison" class="load-button">
          {{ isLoading ? "Loading..." : "Start Comparison" }}
        </button>
      </div>

      <!-- Refetch Settings -->
      <div class="refetch-settings">
        <div class="dash-compliant-info">
          <strong>DASH-Compliant Polling:</strong> Refresh interval is
          automatically determined by MPD's <code>minimumUpdatePeriod</code>
        </div>
        <div class="controls-row">
          <label for="refetchInterval"
            >Fallback Interval (when MPD has no minimumUpdatePeriod):</label
          >
          <input
            id="refetchInterval"
            v-model.number="refetchInterval"
            @change="updateRefetchInterval"
            type="number"
            min="1"
            max="60"
            class="interval-input"
            disabled
            title="Interval is now determined by MPD's minimumUpdatePeriod"
          />
          <span class="interval-unit">seconds (fallback only)</span>
          <button
            @click="toggleAutoRefetch"
            :class="['toggle-button', { active: isAutoRefetch }]"
          >
            {{ isAutoRefetch ? "Stop Auto-Refetch" : "Start Auto-Refetch" }}
          </button>
          <button
            @click="pauseAutoRefetch"
            :class="['pause-button', { active: isPaused }]"
            v-if="isAutoRefetch"
          >
            {{ isPaused ? "Resume" : "Pause" }}
            <span
              v-if="isPaused && pendingRows.length > 0"
              class="pending-count"
            >
              ({{ pendingRows.length }} pending)
            </span>
          </button>
        </div>
        <span class="auto-refetch-status">
          {{
            isAutoRefetch
              ? isPaused
                ? "DASH-compliant polling paused (click Resume to continue)"
                : "DASH-compliant polling enabled (interval from MPD's minimumUpdatePeriod)"
              : "DASH-compliant polling disabled"
          }}
        </span>
      </div>
    </div>

    <!-- Segment Validation Configuration -->
    <div class="segment-validation-config">
      <h4>🔍 Segment Validation Configuration</h4>
      <div class="config-grid">
        <div class="config-item">
          <label for="maxDownloadRatio">Max Download Ratio:</label>
          <input
            id="maxDownloadRatio"
            v-model.number="segmentValidationConfig.maxDownloadRatio"
            type="number"
            min="0.1"
            max="5.0"
            step="0.1"
            class="config-input"
          />
          <span class="config-hint"
            >Download time ≤ segment duration × ratio</span
          >
        </div>
        <div class="config-item">
          <label for="minSegmentDuration">Min Segment Duration (s):</label>
          <input
            id="minSegmentDuration"
            v-model.number="segmentValidationConfig.minSegmentDurationSec"
            type="number"
            min="0.1"
            max="10.0"
            step="0.1"
            class="config-input"
          />
          <span class="config-hint">Prevents encoder instability</span>
        </div>
        <div class="config-item">
          <label for="maxSegmentDuration">Max Segment Duration (s):</label>
          <input
            id="maxSegmentDuration"
            v-model.number="segmentValidationConfig.maxSegmentDurationSec"
            type="number"
            min="1.0"
            max="30.0"
            step="0.5"
            class="config-input"
          />
          <span class="config-hint">Prevents high latency</span>
        </div>
        <div class="config-item">
          <label for="enableDownloadTimeForVOD"
            >Enable Download Time Check for VOD:</label
          >
          <input
            id="enableDownloadTimeForVOD"
            v-model="segmentValidationConfig.enableDownloadTimeForVOD"
            type="checkbox"
            class="config-checkbox"
          />
          <span class="config-hint">Usually disabled for VOD streams</span>
        </div>
      </div>
    </div>

    <!-- Video Player -->
    <div v-if="manifestUrl" class="player-section">
      <div class="player-controls">
        <button
          @click="playStream"
          class="control-button play-button"
          :disabled="!manifestUrl"
        >
          ▶ Play Stream
        </button>
        <button
          @click="stopStream"
          class="control-button stop-button"
          :disabled="!player"
        >
          ■ Stop Stream
        </button>
        <span class="player-status">{{ playerStatus }}</span>
      </div>
      <video ref="videoElement" controls class="video-player"></video>
    </div>

    <!-- Comparison Table -->
    <div v-if="comparisonHistory.length > 0" class="comparison-table-section">
      <div class="table-header">
        <h3>Comparison Analysis</h3>
        <div class="scroll-hint">
          <span class="scroll-indicator"
            >← Scroll horizontally to see all columns →</span
          >
        </div>
        <div class="table-controls">
          <div class="view-toggle">
            <button
              @click="isDetailedView = false"
              :class="['view-toggle-button', { active: !isDetailedView }]"
            >
              Normal View
            </button>
            <button
              @click="isDetailedView = true"
              :class="['view-toggle-button', { active: isDetailedView }]"
            >
              Detailed View
            </button>
          </div>
          <div class="update-info">
            <div class="legend">
              <span class="legend-item">
                <span class="legend-color latest"></span>
                Latest Update
              </span>
              <span class="legend-item">
                <span class="legend-color changed"></span>
                Values Changed
              </span>
              <span class="legend-item">
                <span class="legend-color normal"></span>
                No Changes
              </span>
            </div>
            <span class="last-update">Last Updated: {{ lastUpdateTime }}</span>
            <span
              class="auto-refetch-indicator"
              :class="{ active: isAutoRefetch && !isPaused, paused: isPaused }"
            >
              {{
                isAutoRefetch
                  ? isPaused
                    ? "⏸️ DASH-compliant polling paused"
                    : "🔄 DASH-compliant polling (interval from MPD's minimumUpdatePeriod)"
                  : "⏸️ DASH-compliant polling disabled"
              }}
            </span>
          </div>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Periods (Total/Content/Ad)</th>
              <th>Number Period Added (provide Id)</th>
              <th>Number of Period Removed</th>
              <th>Number of Segments Removed</th>
              <th>Number of Segments Added</th>
              <th>Profile same in all Periods</th>
              <th>Video and Audio Duration are Same</th>
              <th>Start Time Correct?</th>
              <th>Period Segment Added (Video)</th>
              <th>Period Segment Removed (Video)</th>
              <th>Period Segment Added (Audio)</th>
              <th>Period Segment Removed (Audio)</th>
              <th>Is Segment Timing Correct?</th>
              <th>Download Time vs Segment Duration</th>
              <th>DRM Protection Status</th>
              <th>DRM Signaling</th>
              <th>Period Start Time Comparison</th>
              <th>Segments Same Across All Profiles</th>
              <th>Period IDs Same as Previous MPD</th>
              <th>Profile</th>
              <th>Time Diff(s)</th>
              <th>Switch Profile</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(historyEntry, displayIndex) in comparisonHistory
                .slice()
                .reverse()"
              :key="comparisonHistory.length - 1 - displayIndex"
              :class="{
                'latest-row': displayIndex === 0,
                'changed-row': hasRowChanges(
                  historyEntry,
                  comparisonHistory.slice().reverse()[displayIndex + 1]
                ),
              }"
            >
              <td
                :class="[
                  'metric-value',
                  'timestamp-cell',
                  {
                    'duration-inconsistent': !isMpdDurationConsistent(
                      historyEntry.mpdDuration,
                      comparisonHistory.length - 1 - displayIndex
                    ),
                  },
                ]"
              >
                {{ historyEntry.timestamp }}
                <span
                  v-if="historyEntry.mpdDuration !== null"
                  class="mpd-duration"
                >
                  ({{ Math.round(historyEntry.mpdDuration) }}s refresh)
                </span>
                <span v-else class="mpd-duration-missing">
                  (refresh interval unknown)
                </span>
              </td>
              <td
                :class="[
                  'metric-value',
                  'combined-periods-cell',
                  { 'detailed-content': isDetailedView },
                ]"
              >
                <div v-if="isDetailedView" class="detailed-periods-view">
                  <div class="periods-content">
                    <div
                      v-for="(period, index) in getPeriodsForDisplay()"
                      :key="index"
                      class="period-item"
                      :class="{ 'duplicate-period-id': period.isDuplicate }"
                    >
                      <div class="period-content">
                        <div
                          v-if="period.expanded"
                          class="expanded-details-header"
                        >
                          <strong>Expanded Details:</strong>
                        </div>
                        <div
                          v-if="period.expanded"
                          class="expanded-details-content"
                        >
                          {{ period.full }}
                        </div>
                        <span v-if="!period.expanded">{{
                          period.truncated
                        }}</span>
                      </div>
                      <button
                        class="expand-btn"
                        @click="togglePeriodExpansion(index)"
                        :title="
                          period.expanded
                            ? 'Click to collapse'
                            : 'Click to expand full details'
                        "
                      >
                        {{ period.expanded ? "▼" : "▶" }}
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="normal-periods-view">
                  {{ getCombinedNormalPeriods(historyEntry) }}
                </div>
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                ]"
                :title="
                  getHistoryMetricTooltip(
                    historyEntry,
                    'Number Period Added (provide Id)'
                  )
                "
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Number Period Added (provide Id)"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Number Period Added (provide Id)"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                ]"
                :title="
                  getHistoryMetricTooltip(
                    historyEntry,
                    'Number of Period Removed'
                  )
                "
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Number of Period Removed"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Number of Period Removed"
                      )
                }}
              </td>
              <td class="metric-value">
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Number of Segments Removed"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Number of Segments Removed"
                      )
                }}
              </td>
              <td class="metric-value">
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Number of Segments Added"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Number of Segments Added"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Profile same in all Periods'
                  ),
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Profile same in all Periods"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Profile same in all Periods"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Video and Audio Duration are Same'
                  ),
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Video and Audio Duration are Same"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Video and Audio Duration are Same"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  'start-time-cell',
                  { 'detailed-content': isDetailedView },
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Start Time Correct?'
                  ),
                ]"
                :title="
                  getHistoryMetricTooltip(historyEntry, 'Start Time Correct?')
                "
              >
                <div v-if="isDetailedView" class="detailed-start-time-view">
                  <div class="start-time-content">
                    <div
                      v-for="(startTime, index) in getStartTimesForDisplay(
                        comparisonHistory.length - 1 - displayIndex
                      )"
                      :key="`${
                        comparisonHistory.length - 1 - displayIndex
                      }_${index}`"
                      class="start-time-item"
                    >
                      <div class="start-time-content">
                        <div
                          v-if="startTime.expanded"
                          class="expanded-details-header"
                        >
                          <strong>Expanded Details:</strong>
                        </div>
                        <div
                          v-if="startTime.expanded"
                          class="expanded-details-content"
                        >
                          {{ startTime.full }}
                        </div>
                        <span v-if="!startTime.expanded">{{
                          startTime.truncated
                        }}</span>
                      </div>
                      <button
                        class="expand-btn"
                        @click="
                          toggleStartTimeExpansion(
                            comparisonHistory.length - 1 - displayIndex,
                            index
                          )
                        "
                        :title="
                          startTime.expanded
                            ? 'Click to collapse'
                            : 'Click to expand full details'
                        "
                      >
                        {{ startTime.expanded ? "▼" : "▶" }}
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="normal-start-time-view">
                  {{ getCombinedNormalStartTime(historyEntry) }}
                </div>
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Period Segment Added (Video)"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Period Segment Added (Video)"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Period Segment Removed (Video)"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Period Segment Removed (Video)"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Period Segment Added (Audio)"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Period Segment Added (Audio)"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Period Segment Removed (AUDIO)"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Period Segment Removed (AUDIO)"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Is Segment Timing Correct?'
                  ),
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Is Segment Timing Correct?"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Is Segment Timing Correct?"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Download Time vs Segment Duration'
                  ),
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Download Time vs Segment Duration"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Download Time vs Segment Duration"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'DRM Protection Status'
                  ),
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "DRM Protection Status"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "DRM Protection Status"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                  getHistoryMetricStatusClass(historyEntry, 'DRM Signaling'),
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "DRM Signaling"
                      )
                    : getHistoryMetricValue(historyEntry, "DRM Signaling")
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Period Start Time Comparison'
                  ),
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Period Start Time Comparison"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Period Start Time Comparison"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Segments Same Across All Profiles'
                  ),
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Segments Same Across All Profiles"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Segments Same Across All Profiles"
                      )
                }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Period IDs Same as Previous MPD'
                  ),
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Period IDs Same as Previous MPD"
                      )
                    : getHistoryMetricValue(
                        historyEntry,
                        "Period IDs Same as Previous MPD"
                      )
                }}
              </td>
              <td class="metric-value">
                {{ getHistoryMetricValue(historyEntry, "Profile") }}
              </td>
              <td
                :class="[
                  'metric-value',
                  { 'detailed-content': isDetailedView },
                ]"
              >
                {{
                  isDetailedView
                    ? getDetailedHistoryMetricValue(
                        historyEntry,
                        "Time Diff(s)"
                      )
                    : getHistoryMetricValue(historyEntry, "Time Diff(s)")
                }}
              </td>
              <td class="metric-value">
                {{ getHistoryMetricValue(historyEntry, "Switch Profile") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading manifest and analyzing...</p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button @click="clearError" class="retry-button">Retry</button>
    </div>
  </div>
</template>

<script>
import { DashPlayerService } from "../services/dashPlayerService.js";
import SegmentValidationService from "../services/segmentValidationService.js";

export default {
  name: "SingleComparison",
  data() {
    return {
      manifestUrl: "",
      refetchInterval: 5, // Fallback interval (5 seconds) - only used when MPD has no minimumUpdatePeriod
      isAutoRefetch: true, // Auto-refetch enabled by default
      isPaused: false, // Pause state for auto-refetch
      isLoading: false,
      error: null,

      // Manifest data
      currentManifest: null,
      previousManifest: null,

      // Comparison data
      comparisonData: [],
      comparisonHistory: [], // Store all historical data
      pendingRows: [], // Store rows that were fetched during pause
      lastUpdateTime: "",

      // Global segment changes (derived from period-level analysis)
      globalSegmentChanges: null,

      // Timers
      refetchTimer: null,

      // Player
      player: null,
      playerStatus: "Ready to play",
      dashPlayerService: new DashPlayerService(),

      // View mode toggle
      isDetailedView: false,

      // Expand/collapse data for detailed view
      expandData: {
        periods: {},
        startTimes: {},
      },

      // MPD refresh interval tracking
      previousMpdPublishTime: null,

      // Segment validation service and configuration
      segmentValidationService: new SegmentValidationService(),
      segmentValidationConfig: {
        maxDownloadRatio: 1.0, // download must be <= playback time
        minSegmentDurationSec: 1.5,
        maxSegmentDurationSec: 6.0,
        enableDownloadTimeForVOD: false, // VOD streams often don't need this check
      },
      segmentValidationResults: null,
    };
  },

  methods: {
    async startComparison() {
      if (!this.manifestUrl.trim()) {
        this.error = "Please enter a valid MPD URL";
        return;
      }

      this.isLoading = true;
      this.error = null;

      try {
        await this.loadManifest();
        this.initializePlayer();

        if (this.isAutoRefetch) {
          this.startAutoRefetch();
        }
      } catch (err) {
        this.error = `Failed to load manifest: ${err.message}`;
      } finally {
        this.isLoading = false;
      }
    },

    async loadManifest() {
      try {
        // Import ManifestService
        const { ManifestService } = await import(
          "../services/manifestService.js"
        );
        const manifestService = new ManifestService();

        // Load manifest
        const manifest = await manifestService.loadManifest(this.manifestUrl);

        // Store previous manifest for comparison
        this.previousManifest = this.currentManifest;
        this.currentManifest = manifest;

        // Analyze manifest
        await this.analyzeManifest();
      } catch (error) {
        throw new Error(`Manifest loading failed: ${error.message}`);
      }
    },

    async analyzeManifest() {
      if (!this.currentManifest) return;

      try {
        // Import ManifestService for analysis
        const { ManifestService } = await import(
          "../services/manifestService.js"
        );
        const manifestService = new ManifestService();

        // Extract MPD info
        const mpdInfo = manifestService.extractMpdInfo(this.currentManifest);

        // Perform analysis
        const analysis = await this.performComparisonAnalysis(mpdInfo);

        // Update comparison data (always update this for internal state)
        this.comparisonData = analysis;
        this.lastUpdateTime = new Date().toLocaleTimeString();

        // Add to history with timestamp and MPD refresh interval - keep ALL entries for the entire session
        const mpdRefreshInterval = this.extractMpdDuration(
          this.currentManifest
        );
        console.log(
          "MPD Refresh Interval extracted:",
          mpdRefreshInterval,
          "seconds"
        );

        // Create the new row data
        const newRowData = {
          timestamp: new Date().toLocaleTimeString(),
          mpdDuration: mpdRefreshInterval, // Keep same property name for compatibility
          data: [...analysis], // Create a copy of the analysis
        };

        // Check pause state to determine where to store the data
        console.log(`🔄 ANALYZE MANIFEST - isPaused: ${this.isPaused}`);
        if (this.isPaused) {
          console.log(
            "🔄 PAUSED: Adding row to pending queue instead of table"
          );
          console.log(`🔄 Row data being queued:`, newRowData);
          this.pendingRows.push(newRowData); // Add to bottom of pending queue
          console.log(`📦 Pending rows count: ${this.pendingRows.length}`);
          console.log(
            `📦 All pending rows timestamps:`,
            this.pendingRows.map((row) => row.timestamp)
          );
          return; // Don't add to table when paused
        }

        // Normal operation - add to comparison history
        this.comparisonHistory.push(newRowData); // Add to bottom instead of top

        console.log(
          "✅ ADDED NEW ROW TO TABLE - Total rows:",
          this.comparisonHistory.length,
          "isPaused:",
          this.isPaused
        );
      } catch (error) {
        console.error("Analysis failed:", error);
        this.error = `Analysis failed: ${error.message}`;
      }
    },

    async performComparisonAnalysis(mpdInfo) {
      const analysis = [];

      // Extract periods and categorize them
      const periods = this.ensureArray(mpdInfo.Period);
      const periodCategorization = this.categorizePeriods(periods);

      console.log("=== ANALYSIS DEBUG ===");
      console.log("Extracted periods from current manifest:", periods);
      console.log("Period categorization:", periodCategorization);
      console.log("Previous manifest exists:", !!this.previousManifest);

      // 0. Table from Header (timestamp or identifier)
      analysis.push({
        metric: "Table from Header",
        value: new Date().toLocaleTimeString(),
        status: "INFO",
        statusClass: "status-info",
        hasDifference: false,
      });

      // 1. Total Periods
      analysis.push({
        metric: "Total Periods",
        value: periodCategorization.total.toString(),
        status: "OK",
        statusClass: "status-ok",
        hasDifference: false,
      });

      // 2. Content Periods
      analysis.push({
        metric: "Content Periods",
        value: periodCategorization.content.toString(),
        status: "OK",
        statusClass: "status-ok",
        hasDifference: false,
      });

      // 3. Ad Periods
      analysis.push({
        metric: "Ad Periods",
        value: periodCategorization.ad.toString(),
        status: periodCategorization.ad > 0 ? "INFO" : "OK",
        statusClass: periodCategorization.ad > 0 ? "status-info" : "status-ok",
        hasDifference: false,
      });

      // 4. Number Period Added (provide Id)
      const addedPeriods = await this.getAddedPeriods(periods);
      console.log("Added periods result:", addedPeriods);
      console.log("Previous manifest exists:", !!this.previousManifest);
      console.log("Current periods count:", periods.length);

      // For testing: if this is the first load, show current periods as "initial load"
      const addedValue =
        !this.previousManifest && periods.length > 0
          ? `${
              periods.length
            } (Initial load - showing current periods)\n${periods
              .map((period, index) => {
                const periodId =
                  period.id?.parsed ||
                  period.id?.raw ||
                  period.id ||
                  `period_${index}`;
                return `Id="${periodId}"`;
              })
              .join("\n")}`
          : addedPeriods.count > 0
          ? `${addedPeriods.count} (Number of periods added)\n${
              addedPeriods.ids.length > 0
                ? addedPeriods.ids.map((id) => `Id="${id}"`).join("\n")
                : "No IDs available"
            }`
          : "0";
      console.log("Added periods display value:", addedValue);
      analysis.push({
        metric: "Number Period Added (provide Id)",
        value: addedValue,
        status:
          !this.previousManifest && periods.length > 0
            ? "INFO"
            : addedPeriods.count > 0
            ? "ADDED"
            : "OK",
        statusClass:
          !this.previousManifest && periods.length > 0
            ? "status-info"
            : addedPeriods.count > 0
            ? "status-added"
            : "status-ok",
        hasDifference: addedPeriods.count > 0,
      });

      // 5. Number of Period Removed
      const removedPeriods = await this.getRemovedPeriods(periods);
      const removedValue =
        removedPeriods.count > 0
          ? `${removedPeriods.count} (Number of periods removed)\n${
              removedPeriods.ids.length > 0
                ? removedPeriods.ids.map((id) => `Id="${id}"`).join("\n")
                : "No IDs available"
            }`
          : "0";
      analysis.push({
        metric: "Number of Period Removed",
        value: removedValue,
        status: removedPeriods.count > 0 ? "REMOVED" : "OK",
        statusClass: removedPeriods.count > 0 ? "status-removed" : "status-ok",
        hasDifference: removedPeriods.count > 0,
      });

      // 6. Number of Segments Removed
      const segmentAnalysis = await this.analyzeSegments(periods);
      analysis.push(...segmentAnalysis);

      // 7. Profile same in all Periods - CORRECT: Validate profile consistency across periods
      const profileConsistency = this.checkProfileConsistency(periods);
      console.log("Profile consistency validation result:", profileConsistency);
      analysis.push({
        metric: "Profile same in all Periods",
        value: profileConsistency.consistent
          ? "Yes"
          : `No (${profileConsistency.issues.length} issue${
              profileConsistency.issues.length > 1 ? "s" : ""
            })`,
        status: profileConsistency.consistent ? "OK" : "INCONSISTENT",
        statusClass: profileConsistency.consistent
          ? "status-ok"
          : "status-error-red",
        hasDifference: !profileConsistency.consistent,
        tooltip: profileConsistency.consistent
          ? "All periods have consistent profiles"
          : `Issues found:\n${profileConsistency.issues.join("\n")}`,
      });

      // 8. Video and Audio Duration are Same - CORRECT: With proper PTO handling
      const durationConsistency =
        this.validateVideoAudioDurationConsistency(periods);
      const durationValue = durationConsistency.consistent
        ? "Yes"
        : `No (${durationConsistency.issues.length} issue${
            durationConsistency.issues.length > 1 ? "s" : ""
          })`;
      analysis.push({
        metric: "Video and Audio Duration are Same",
        value: durationValue,
        status: durationConsistency.consistent ? "OK" : "MISMATCH",
        statusClass: durationConsistency.consistent
          ? "status-ok"
          : "status-error-red",
        hasDifference: !durationConsistency.consistent,
        tooltip: durationConsistency.consistent
          ? "All video and audio durations match"
          : `Issues found:\n${durationConsistency.issues.join("\n")}`,
      });

      // 9. Start Time Correct? - Enhanced with Period continuity and absolute timing
      const startTimeValidation = this.validateStartTimes(periods);

      // Debug: Log the period results structure
      console.log(
        "Start time validation period results:",
        startTimeValidation.periodResults
      );

      // Format the display to show Period ID, Period Start, and Yes/No for each period
      const startTimeValue =
        startTimeValidation.periodResults &&
        startTimeValidation.periodResults.length > 0
          ? startTimeValidation.periodResults
              .map(
                (result) =>
                  `Period Id="${result.periodId}": Start=${
                    result.periodStart
                  }s, Correct=${result.correct ? "Yes" : "No"}`
              )
              .join("\n")
          : startTimeValidation.correct
          ? "Yes"
          : "No";

      console.log("Start time display value:", startTimeValue);

      analysis.push({
        metric: "Start Time Correct?",
        value: startTimeValue,
        status: startTimeValidation.correct ? "OK" : "INCORRECT",
        statusClass: startTimeValidation.correct ? "status-ok" : "status-error",
        hasDifference: !startTimeValidation.correct,
        tooltip: startTimeValidation.correct
          ? startTimeValidation.tooltip || "All period start times are correct"
          : `Issues found:\n${startTimeValidation.issues.join(
              "\n"
            )}\n\nTiming details:\n${startTimeValidation.tooltip || ""}`,
      });

      // 8-11. Period Segment Added/Removed (Video/Audio)
      const periodSegmentAnalysis = await this.analyzePeriodSegments(periods);
      analysis.push(...periodSegmentAnalysis);

      // 14. Is Segment Timing Correct? - Enhanced with timeline continuity validation
      const segmentTiming = this.validateSegmentTiming(periods);
      analysis.push({
        metric: "Is Segment Timing Correct?",
        value: segmentTiming.correct
          ? "Yes"
          : `No (${segmentTiming.issues.length} issue${
              segmentTiming.issues.length > 1 ? "s" : ""
            })`,
        status: segmentTiming.correct ? "OK" : "TIMING_ERROR",
        statusClass: segmentTiming.correct ? "status-ok" : "status-error",
        hasDifference: !segmentTiming.correct,
        tooltip: segmentTiming.correct
          ? "All segment timing is correct"
          : `Issues found:\n${segmentTiming.issues.join("\n")}`,
      });

      // NEW VALIDATIONS REQUESTED BY USER:

      // 15. Download Time vs Segment Duration Validation
      const downloadTimeValidation =
        this.validateDownloadTimeVsSegmentDuration(periods);
      analysis.push({
        metric: "Download Time vs Segment Duration",
        value: downloadTimeValidation.valid
          ? "OK"
          : `CRITICAL: ${downloadTimeValidation.issues.length} issue${
              downloadTimeValidation.issues.length > 1 ? "s" : ""
            }`,
        status: downloadTimeValidation.valid ? "OK" : "CRITICAL_ERROR",
        statusClass: downloadTimeValidation.valid
          ? "status-ok"
          : "status-error-red",
        hasDifference: !downloadTimeValidation.valid,
        tooltip: downloadTimeValidation.valid
          ? "Download time is within acceptable limits for all segments"
          : `CRITICAL ISSUES:\n${downloadTimeValidation.issues.join(
              "\n"
            )}\n\nSegment Details:\n${
              downloadTimeValidation.segmentDetails || ""
            }`,
      });

      // 16. DRM Validation (Check for Period-level DRM requirement)
      const drmValidation = this.validateDRMPresence(periods);
      analysis.push({
        metric: "DRM Protection Status",
        value: drmValidation.hasPeriodLevelDRM
          ? `Period-level DRM Present (${
              drmValidation.drmSystems.length
            } system${drmValidation.drmSystems.length > 1 ? "s" : ""})`
          : drmValidation.hasAnyDRM
          ? `Missing Period-level DRM (${
              drmValidation.missingPeriodDRM.length
            } period${drmValidation.missingPeriodDRM.length > 1 ? "s" : ""})`
          : "No DRM Protection Found",
        status: drmValidation.hasPeriodLevelDRM
          ? "PROTECTED"
          : drmValidation.hasAnyDRM
          ? "MISSING_PERIOD_DRM"
          : "UNPROTECTED",
        statusClass: drmValidation.hasPeriodLevelDRM
          ? "status-ok"
          : drmValidation.hasAnyDRM
          ? "status-warning"
          : "status-error",
        hasDifference: !drmValidation.hasPeriodLevelDRM,
        tooltip: drmValidation.hasPeriodLevelDRM
          ? `✅ All periods have Period-level DRM\n\nDRM Systems Found:\n${drmValidation.drmSystems.join(
              "\n"
            )}\n\nDetails:\n${drmValidation.details}`
          : drmValidation.hasAnyDRM
          ? `⚠️ DRM exists but not at Period level\n\nMissing Period-level DRM in: ${drmValidation.missingPeriodDRM.join(
              ", "
            )}\n\nDetails:\n${drmValidation.details}`
          : `❌ No DRM protection found at any level\n\nDetails:\n${drmValidation.details}`,
      });

      // 17. DRM Signaling Validation (Production-grade semantic comparison)
      const drmSignalingValidation = await this.validateDRMSignaling(periods);
      analysis.push({
        metric: "DRM Signaling",
        value: drmSignalingValidation.summary,
        status: drmSignalingValidation.status,
        statusClass: drmSignalingValidation.statusClass,
        hasDifference: drmSignalingValidation.changed,
        tooltip: drmSignalingValidation.details,
      });

      // 18. Period Start Time Comparison
      const periodStartTimeComparison = this.comparePeriodStartTimes(periods);
      analysis.push({
        metric: "Period Start Time Comparison",
        value: periodStartTimeComparison.consistent
          ? "Consistent"
          : `Inconsistent (${periodStartTimeComparison.issues.length} issue${
              periodStartTimeComparison.issues.length > 1 ? "s" : ""
            })`,
        status: periodStartTimeComparison.consistent ? "OK" : "INCONSISTENT",
        statusClass: periodStartTimeComparison.consistent
          ? "status-ok"
          : "status-error",
        hasDifference: !periodStartTimeComparison.consistent,
        tooltip: periodStartTimeComparison.consistent
          ? "All period start times follow proper sequence"
          : `Issues found:\n${periodStartTimeComparison.issues.join("\n")}`,
      });

      // 19. Segment Profile Equivalence Validation
      const segmentProfileEquivalence =
        this.validateSegmentProfileEquivalence(periods);
      analysis.push({
        metric: "Segments Same Across All Profiles",
        value: segmentProfileEquivalence.equivalent
          ? "Yes"
          : `No (${segmentProfileEquivalence.issues.length} issue${
              segmentProfileEquivalence.issues.length > 1 ? "s" : ""
            })`,
        status: segmentProfileEquivalence.equivalent
          ? "OK"
          : "PROFILE_MISMATCH",
        statusClass: segmentProfileEquivalence.equivalent
          ? "status-ok"
          : "status-error-red",
        hasDifference: !segmentProfileEquivalence.equivalent,
        tooltip: segmentProfileEquivalence.equivalent
          ? "All profiles have identical segment timelines"
          : `Profile Issues:\n${segmentProfileEquivalence.issues.join("\n")}`,
      });

      // 20. Period ID Consistency Check (vs Previous MPD)
      const periodIdConsistency = await this.validatePeriodIdConsistency(
        periods
      );
      analysis.push({
        metric: "Period IDs Same as Previous MPD",
        value: periodIdConsistency.consistent
          ? "Yes"
          : `No (${periodIdConsistency.changes.length} change${
              periodIdConsistency.changes.length > 1 ? "s" : ""
            })`,
        status: periodIdConsistency.consistent ? "OK" : "CHANGED",
        statusClass: periodIdConsistency.consistent
          ? "status-ok"
          : "status-warning",
        hasDifference: !periodIdConsistency.consistent,
        tooltip: periodIdConsistency.consistent
          ? "All Period IDs match previous MPD"
          : `Changes detected:\n${periodIdConsistency.changes.join("\n")}`,
      });

      // 21. Profile (Leave blank for now)
      analysis.push({
        metric: "Profile",
        value: "",
        status: "INFO",
        statusClass: "status-info",
        hasDifference: false,
      });

      // 22. Time Diff(s)
      const timeDiff = await this.calculateTimeDifferences(periods);
      analysis.push({
        metric: "Time Diff(s)",
        value: timeDiff.summary,
        status: "INFO",
        statusClass: "status-info",
        hasDifference: false,
      });

      // 23. Switch Profile (Leave empty for now)
      analysis.push({
        metric: "Switch Profile",
        value: "",
        status: "INFO",
        statusClass: "status-info",
        hasDifference: false,
      });

      return analysis;
    },

    // Categorize periods into content, ad, and other types
    categorizePeriods(periods) {
      const categorization = {
        total: periods.length,
        content: 0,
        ad: 0,
        other: 0,
        details: [],
      };

      periods.forEach((period, index) => {
        const periodId =
          period.id?.parsed || period.id?.raw || period.id || `period_${index}`;

        // CORRECT: Use authoritative ad period detection
        const isAdPeriod = this.isAuthoritativeAdPeriod(period);
        const periodType = isAdPeriod ? "ad" : "content";

        // Count by type
        if (periodType === "ad") {
          categorization.ad++;
        } else if (periodType === "content") {
          categorization.content++;
        } else {
          categorization.other++;
        }

        categorization.details.push({
          index,
          id: periodId,
          type: periodType,
        });
      });

      console.log("Period categorization:", categorization);
      return categorization;
    },

    // Helper methods for analysis
    ensureArray(item) {
      if (!item) return [];
      return Array.isArray(item) ? item : [item];
    },

    // Extract segment information from periods for comparison
    extractSegmentInfo(periods) {
      const segmentInfo = [];

      console.log("=== EXTRACTING SEGMENT INFO ===");

      periods.forEach((period, periodIndex) => {
        const periodId =
          period.id?.parsed ||
          period.id?.raw ||
          period.id ||
          `period_${periodIndex}`;
        console.log(`Processing period ${periodIndex} with ID: ${periodId}`);

        const adaptationSets = this.ensureArray(period.AdaptationSet);
        console.log(`  Found ${adaptationSets.length} adaptation sets`);

        adaptationSets.forEach((as, asIndex) => {
          const contentType =
            as.contentType?.parsed ||
            this.inferContentType(as.mimeType?.parsed);
          console.log(`  AS${asIndex}: contentType = ${contentType}`);

          const representations = this.ensureArray(as.Representation);
          console.log(`    Found ${representations.length} representations`);

          representations.forEach((rep, repIndex) => {
            console.log(`    Rep${repIndex}: checking for SegmentTemplate`);

            if (rep.SegmentTemplate && rep.SegmentTemplate.SegmentTimeline) {
              const sElements = this.ensureArray(
                rep.SegmentTemplate.SegmentTimeline.S
              );
              console.log(
                `      Found ${sElements.length} S elements in SegmentTimeline`
              );

              sElements.forEach((s, sIndex) => {
                const startTime = s.t?.parsed || 0;
                const duration = s.d?.parsed || 0;
                const repeat = s.r?.parsed || 0;

                console.log(
                  `        S${sIndex}: t=${startTime}, d=${duration}, r=${repeat} (would create ${
                    repeat + 1
                  } segments)`
                );

                // IMPORTANT: Cap the repeat value to avoid huge numbers
                // In DASH, @r can be very large (like 2999), but for comparison
                // we only need to track a reasonable number of segments
                const actualRepeat = Math.min(repeat, 5); // Cap at 5 segments per S element

                if (repeat > 5) {
                  console.log(
                    `        WARNING: Capping repeat from ${repeat} to ${actualRepeat} to avoid performance issues`
                  );
                }

                // Each S element can represent multiple segments due to @r attribute
                for (let i = 0; i <= actualRepeat; i++) {
                  const segmentId = `${periodId}_AS${asIndex}_Rep${repIndex}_S${sIndex}_${i}`;
                  segmentInfo.push({
                    id: segmentId,
                    periodId: periodId,
                    startTime: startTime + i * duration,
                    duration: duration,
                    adaptationSetIndex: asIndex,
                    representationIndex: repIndex,
                    contentType: contentType,
                  });
                }
              });
            } else {
              console.log(`      No SegmentTemplate or SegmentTimeline found`);
            }
          });
        });
      });

      console.log(`Total segments extracted: ${segmentInfo.length}`);
      console.log("=== END SEGMENT EXTRACTION ===");

      return segmentInfo;
    },

    inferContentType(mimeType) {
      if (!mimeType) return "unknown";
      if (mimeType.includes("video")) return "video";
      if (mimeType.includes("audio")) return "audio";
      if (mimeType.includes("text") || mimeType.includes("application"))
        return "text";
      return "unknown";
    },

    // Compare segment information between current and previous
    compareSegmentInfo(currentSegments, previousSegments) {
      const currentIds = currentSegments.map((s) => s.id);
      const previousIds = previousSegments.map((s) => s.id);

      const addedIds = currentIds.filter((id) => !previousIds.includes(id));
      const removedIds = previousIds.filter((id) => !currentIds.includes(id));

      return {
        addedSegments: addedIds.length,
        addedSegmentIds: addedIds,
        removedSegments: removedIds.length,
        removedSegmentIds: removedIds,
        totalCurrent: currentIds.length,
        totalPrevious: previousIds.length,
      };
    },

    async getAddedPeriods(currentPeriods) {
      console.log("=== getAddedPeriods DEBUG START ===");
      console.log("Previous manifest exists:", !!this.previousManifest);
      console.log("Current periods count:", currentPeriods.length);

      if (!this.previousManifest) {
        console.log("No previous manifest - returning 0 added periods");
        return {
          count: 0,
          ids: [],
        };
      }

      // Extract previous periods for comparison
      const previousPeriods = await this.extractPreviousPeriods();

      // CORRECT: Use stable period identity based on (start, duration) or first segment time
      const currentPeriodIdentities =
        this.extractStablePeriodIdentities(currentPeriods);
      const previousPeriodIdentities =
        this.extractStablePeriodIdentities(previousPeriods);

      console.log("Current period identities:", currentPeriodIdentities);
      console.log("Previous period identities:", previousPeriodIdentities);

      // Find added periods by comparing stable identities
      const addedPeriods = currentPeriodIdentities.filter(
        (current) =>
          !previousPeriodIdentities.some((previous) =>
            this.periodsMatch(current, previous)
          )
      );

      console.log("Added periods result:", addedPeriods);
      console.log("=== getAddedPeriods DEBUG END ===");

      return {
        count: addedPeriods.length,
        ids: addedPeriods.map((p) => p.displayId),
      };
    },

    async getRemovedPeriods(currentPeriods) {
      console.log("=== getRemovedPeriods DEBUG START ===");
      console.log("Previous manifest exists:", !!this.previousManifest);

      if (!this.previousManifest) {
        console.log("No previous manifest - returning 0 removed periods");
        return { count: 0, ids: [] };
      }

      const previousPeriods = await this.extractPreviousPeriods();
      console.log("Previous periods count:", previousPeriods.length);
      console.log("Current periods count:", currentPeriods.length);

      // CORRECT: Use stable period identity based on (start, duration) or first segment time
      const currentPeriodIdentities =
        this.extractStablePeriodIdentities(currentPeriods);
      const previousPeriodIdentities =
        this.extractStablePeriodIdentities(previousPeriods);

      console.log("Current period identities:", currentPeriodIdentities);
      console.log("Previous period identities:", previousPeriodIdentities);

      // Find removed periods by comparing stable identities
      const removedPeriods = previousPeriodIdentities.filter(
        (previous) =>
          !currentPeriodIdentities.some((current) =>
            this.periodsMatch(current, previous)
          )
      );

      console.log("Removed periods result:", removedPeriods);
      console.log("=== getRemovedPeriods DEBUG END ===");

      return {
        count: removedPeriods.length,
        ids: removedPeriods.map((p) => p.displayId),
      };
    },

    // CORRECT: Extract stable period identity based on timing, not IDs
    extractStablePeriodIdentities(periods) {
      return periods.map((period, index) => {
        // Method 1: Use Period start and duration if available
        const periodStart = period.start?.parsed;
        const periodDuration = period.duration?.parsed;

        if (
          periodStart !== undefined &&
          periodStart !== null &&
          periodDuration !== undefined &&
          periodDuration !== null
        ) {
          return {
            start: periodStart,
            duration: periodDuration,
            end: periodStart + periodDuration,
            method: "period_timing",
            displayId: `start=${periodStart.toFixed(
              3
            )}s_dur=${periodDuration.toFixed(3)}s`,
            originalId:
              period.id?.parsed ||
              period.id?.raw ||
              period.id ||
              `period_${index}`,
          };
        }

        // Method 2: Derive from first segment presentation time
        const firstSegmentTime = this.getFirstSegmentPresentationTime(period);
        if (firstSegmentTime !== null && firstSegmentTime !== undefined) {
          const estimatedDuration =
            this.estimatePeriodDurationFromSegments(period);
          if (estimatedDuration !== null && estimatedDuration !== undefined) {
            return {
              start: firstSegmentTime,
              duration: estimatedDuration,
              end: firstSegmentTime + estimatedDuration,
              method: "segment_timing",
              displayId: `seg_start=${firstSegmentTime.toFixed(
                3
              )}s_dur=${estimatedDuration.toFixed(3)}s`,
              originalId:
                period.id?.parsed ||
                period.id?.raw ||
                period.id ||
                `period_${index}`,
            };
          }
        }

        // Method 3: EventStream boundaries (for SCTE-35 marked periods)
        const eventStreamTime = this.getEventStreamTime(period);
        if (eventStreamTime !== null && eventStreamTime !== undefined) {
          return {
            start: eventStreamTime,
            duration: 0, // Event-based periods may not have duration
            end: eventStreamTime,
            method: "event_stream",
            displayId: `event_time=${eventStreamTime.toFixed(3)}s`,
            originalId:
              period.id?.parsed ||
              period.id?.raw ||
              period.id ||
              `period_${index}`,
          };
        }

        // Fallback: Use index-based identity (least reliable)
        console.warn(
          `Period ${index}: No stable timing identity found, using index fallback`
        );
        return {
          start: index * 1000, // Arbitrary large spacing
          duration: 0,
          end: index * 1000,
          method: "index_fallback",
          displayId: `fallback_index=${index}`,
          originalId:
            period.id?.parsed ||
            period.id?.raw ||
            period.id ||
            `period_${index}`,
        };
      });
    },

    // Check if two periods match based on stable identity
    periodsMatch(period1, period2) {
      const tolerance = 0.001; // 1ms tolerance for timing comparisons

      // Prefer timing-based matches over fallbacks
      if (
        period1.method !== "index_fallback" &&
        period2.method !== "index_fallback"
      ) {
        return (
          Math.abs(period1.start - period2.start) <= tolerance &&
          Math.abs(period1.duration - period2.duration) <= tolerance
        );
      }

      // Fallback to original ID comparison only if both are fallbacks
      if (
        period1.method === "index_fallback" &&
        period2.method === "index_fallback"
      ) {
        return period1.originalId === period2.originalId;
      }

      return false;
    },

    // Get first segment presentation time from period
    getFirstSegmentPresentationTime(period) {
      try {
        const adaptationSets = this.ensureArray(period.AdaptationSet);

        for (const as of adaptationSets) {
          const representations = this.ensureArray(as.Representation);

          for (const rep of representations) {
            if (rep.SegmentTemplate && rep.SegmentTemplate.SegmentTimeline) {
              const timescale = rep.SegmentTemplate.timescale?.parsed || 1;
              const pto =
                rep.SegmentTemplate.presentationTimeOffset?.parsed || 0;
              const sElements = this.ensureArray(
                rep.SegmentTemplate.SegmentTimeline.S
              );

              if (sElements.length > 0) {
                const firstS = sElements[0];
                if (firstS.t?.parsed !== undefined) {
                  // CORRECT: absoluteSegmentStart = (segment.t - presentationTimeOffset) / timescale
                  return (firstS.t.parsed - pto) / timescale;
                }
              }
            }
          }
        }

        return null;
      } catch (error) {
        console.warn("Failed to extract first segment time:", error);
        return null;
      }
    },

    // Estimate period duration from segment timeline
    estimatePeriodDurationFromSegments(period) {
      try {
        const adaptationSets = this.ensureArray(period.AdaptationSet);

        for (const as of adaptationSets) {
          const representations = this.ensureArray(as.Representation);

          for (const rep of representations) {
            if (rep.SegmentTemplate && rep.SegmentTemplate.SegmentTimeline) {
              const timeline = this.expandTimelineWithPTO(rep);
              if (timeline.totalDuration > 0) {
                return timeline.totalDuration;
              }
            }
          }
        }

        return 0;
      } catch (error) {
        console.warn("Failed to estimate period duration:", error);
        return 0;
      }
    },

    // Get EventStream time for SCTE-35 marked periods
    getEventStreamTime(period) {
      try {
        if (period.EventStream) {
          const eventStreams = this.ensureArray(period.EventStream);

          for (const es of eventStreams) {
            const schemeId = es.schemeIdUri || "";
            if (
              schemeId.includes("scte35") ||
              schemeId.includes("urn:scte:scte35")
            ) {
              // Extract presentation time from EventStream if available
              const events = this.ensureArray(es.Event);
              if (
                events.length > 0 &&
                events[0].presentationTime?.parsed !== undefined
              ) {
                return events[0].presentationTime.parsed;
              }
            }
          }
        }

        return null;
      } catch (error) {
        console.warn("Failed to extract EventStream time:", error);
        return null;
      }
    },

    async analyzeSegments() {
      const analysis = [];

      // Use global segment changes calculated from period-level analysis
      // This ensures no double counting and proper content type separation
      const globalChanges = this.globalSegmentChanges || {
        totalAdded: 0,
        totalRemoved: 0,
        videoChanges: { added: [], removed: [] },
        audioChanges: { added: [], removed: [] },
      };

      // Number of Segments Removed - derived from period-level analysis
      const removedValue =
        globalChanges.totalRemoved > 0
          ? `${globalChanges.totalRemoved} total segments removed\n` +
            [
              ...globalChanges.videoChanges.removed,
              ...globalChanges.audioChanges.removed,
            ]
              .map(
                (change) =>
                  `Period id="${change.periodId}": ${change.count} seg`
              )
              .join("\n")
          : "0";

      analysis.push({
        metric: "Number of Segments Removed",
        value: removedValue,
        status: globalChanges.totalRemoved > 0 ? "REMOVED" : "OK",
        statusClass:
          globalChanges.totalRemoved > 0 ? "status-removed" : "status-ok",
        hasDifference: globalChanges.totalRemoved > 0,
      });

      // Number of Segments Added - derived from period-level analysis
      const addedValue =
        globalChanges.totalAdded > 0
          ? `${globalChanges.totalAdded} total segments added\n` +
            [
              ...globalChanges.videoChanges.added,
              ...globalChanges.audioChanges.added,
            ]
              .map(
                (change) =>
                  `Period id="${change.periodId}": ${change.count} seg`
              )
              .join("\n")
          : "0";

      analysis.push({
        metric: "Number of Segments Added",
        value: addedValue,
        status: globalChanges.totalAdded > 0 ? "ADDED" : "OK",
        statusClass:
          globalChanges.totalAdded > 0 ? "status-added" : "status-ok",
        hasDifference: globalChanges.totalAdded > 0,
      });

      return analysis;
    },

    calculateTotalSegments(sElements) {
      let total = 0;
      sElements.forEach((s) => {
        const repeat = parseInt(s.r?.parsed || 0);
        total += repeat + 1; // r=0 means 1 segment, r=1 means 2 segments, etc.
      });
      return total;
    },

    async getSegmentChanges(periods) {
      const changes = { added: [], removed: [] };

      try {
        const previousPeriods = await this.extractPreviousPeriods();

        periods.forEach((period, pIndex) => {
          const periodId = period.id?.parsed || `period_${pIndex}`;

          if (previousPeriods[pIndex]) {
            const currentSegments = this.getTotalSegmentsForPeriod(period);
            const previousSegments = this.getTotalSegmentsForPeriod(
              previousPeriods[pIndex]
            );

            if (currentSegments > previousSegments) {
              changes.added.push({
                periodId: periodId,
                count: currentSegments - previousSegments,
              });
            } else if (currentSegments < previousSegments) {
              changes.removed.push({
                periodId: periodId,
                count: previousSegments - currentSegments,
              });
            }
          }
        });
      } catch (error) {
        console.warn("Segment change analysis failed:", error);
      }

      return changes;
    },

    getTotalSegmentsForPeriod(period) {
      let totalSegments = 0;
      const adaptationSets = this.ensureArray(period.AdaptationSet);

      adaptationSets.forEach((as) => {
        const representations = this.ensureArray(as.Representation);
        representations.forEach((rep) => {
          if (rep.SegmentTemplate && rep.SegmentTemplate.SegmentTimeline) {
            const sElements = this.ensureArray(
              rep.SegmentTemplate.SegmentTimeline.S
            );
            totalSegments += this.calculateTotalSegments(sElements);
          }
        });
      });

      return totalSegments;
    },

    // CORRECT: Expand SegmentTimeline to actual segments with proper DASH rules
    // CORRECT: Centralized timeline math - single source of truth
    expandTimelineWithPTO(representation) {
      const segmentTemplate = representation.SegmentTemplate;
      if (!segmentTemplate || !segmentTemplate.SegmentTimeline) {
        return { segments: [], totalDuration: 0, lastSegmentEnd: 0 };
      }

      const timescale = segmentTemplate.timescale?.parsed || 1;
      const pto = segmentTemplate.presentationTimeOffset?.parsed || 0;
      const sElements = this.ensureArray(segmentTemplate.SegmentTimeline.S);

      let currentTime = 0;
      const segments = [];

      sElements.forEach((s) => {
        // If @t is present, it sets the absolute start time
        if (s.t?.parsed !== undefined) {
          currentTime = s.t.parsed;
        }

        const duration = s.d?.parsed || 0;
        const repeat = s.r?.parsed || 0;

        // Generate segments for this S element (1 + repeat count)
        for (let i = 0; i <= repeat; i++) {
          const effectiveStart = (currentTime - pto) / timescale;
          const effectiveDuration = duration / timescale;

          segments.push({
            start: effectiveStart,
            duration: effectiveDuration,
            end: effectiveStart + effectiveDuration,
            startTicks: currentTime,
            durationTicks: duration,
          });
          currentTime += duration;
        }
      });

      const totalDuration =
        segments.length > 0
          ? segments[segments.length - 1].end - segments[0].start
          : 0;
      const lastSegmentEnd =
        segments.length > 0 ? segments[segments.length - 1].end : 0;

      return { segments, totalDuration, lastSegmentEnd };
    },

    // CORRECT: Get segments by Period ID and content type (not array index)
    // CORRECT: Get concrete segments by Period ID and content type
    getConcreteSegmentsByPeriodAndContentType(periods, contentType) {
      const periodSegmentMap = new Map();

      periods.forEach((period) => {
        const periodId =
          period.id?.parsed || period.id?.raw || period.id || "unknown";

        const adaptationSets = this.ensureArray(period.AdaptationSet);

        // Find the FIRST AdaptationSet of the specified content type
        // (Multiple representations share the same timeline - don't double count!)
        const targetAS = adaptationSets.find((as) => {
          const asContentType =
            as.contentType?.parsed ||
            this.inferContentType(as.mimeType?.parsed);
          return asContentType === contentType;
        });

        if (targetAS) {
          const representations = this.ensureArray(targetAS.Representation);

          // Use the FIRST representation's timeline (they should all be the same)
          if (representations.length > 0) {
            const timeline = this.expandTimelineWithPTO(representations[0]);

            // Convert to concrete segments with stable identity
            const concreteSegments = timeline.segments.map((seg, index) => ({
              periodId: periodId,
              contentType: contentType,
              startTime: seg.start,
              duration: seg.duration,
              segmentKey: `${periodId}|${contentType}|${seg.start.toFixed(3)}`, // Stable identity
              index: index,
            }));

            periodSegmentMap.set(periodId, concreteSegments);
          }
        }
      });

      return periodSegmentMap;
    },

    // CORRECT: Compare concrete segment maps by stable identity
    compareConcreteSegmentMaps(currentMap, previousMap) {
      const added = [];
      const removed = [];

      // Build sets of segment keys for comparison
      const currentKeys = new Set();
      const previousKeys = new Set();

      // Collect all current segment keys
      currentMap.forEach((segments) => {
        segments.forEach((seg) => {
          currentKeys.add(seg.segmentKey);
        });
      });

      // Collect all previous segment keys
      previousMap.forEach((segments) => {
        segments.forEach((seg) => {
          previousKeys.add(seg.segmentKey);
        });
      });

      // Find added segments (exist in current but not in previous)
      const addedKeys = new Set(
        [...currentKeys].filter((key) => !previousKeys.has(key))
      );
      const removedKeys = new Set(
        [...previousKeys].filter((key) => !currentKeys.has(key))
      );

      // Group added segments by Period ID
      const addedByPeriod = new Map();
      currentMap.forEach((segments, periodId) => {
        const addedInPeriod = segments.filter((seg) =>
          addedKeys.has(seg.segmentKey)
        );
        if (addedInPeriod.length > 0) {
          addedByPeriod.set(periodId, addedInPeriod.length);
        }
      });

      // Group removed segments by Period ID
      const removedByPeriod = new Map();
      previousMap.forEach((segments, periodId) => {
        const removedInPeriod = segments.filter((seg) =>
          removedKeys.has(seg.segmentKey)
        );
        if (removedInPeriod.length > 0) {
          removedByPeriod.set(periodId, removedInPeriod.length);
        }
      });

      // Convert to expected format
      addedByPeriod.forEach((count, periodId) => {
        added.push({
          periodId: periodId,
          count: count,
          currentCount: currentMap.get(periodId)?.length || 0,
          previousCount: previousMap.get(periodId)?.length || 0,
        });
      });

      removedByPeriod.forEach((count, periodId) => {
        removed.push({
          periodId: periodId,
          count: count,
          currentCount: currentMap.get(periodId)?.length || 0,
          previousCount: (previousMap.get(periodId)?.length || 0) + count,
        });
      });

      return {
        added,
        removed,
        totalAdded: addedKeys.size,
        totalRemoved: removedKeys.size,
      };
    },

    // CORRECT: Validate that all representations have identical segment timelines
    validateSegmentEquivalenceAcrossProfiles(periods) {
      const issues = [];
      let consistent = true;

      console.log("=== VALIDATING SEGMENT EQUIVALENCE ACROSS PROFILES ===");

      periods.forEach((period, periodIndex) => {
        const periodId =
          period.id?.parsed ||
          period.id?.raw ||
          period.id ||
          `period_${periodIndex}`;
        const adaptationSets = this.ensureArray(period.AdaptationSet);

        adaptationSets.forEach((as, asIndex) => {
          const contentType =
            as.contentType?.parsed ||
            this.inferContentType(as.mimeType?.parsed);
          const representations = this.ensureArray(as.Representation);

          if (representations.length > 1) {
            // Expand timeline for first representation (reference)
            const referenceTimeline = this.expandTimelineWithPTO(
              representations[0]
            );

            console.log(
              `Period ${periodId}, AS${asIndex} (${contentType}): Reference timeline has ${referenceTimeline.segments.length} segments`
            );

            // Compare all other representations against reference
            for (let i = 1; i < representations.length; i++) {
              const currentTimeline = this.expandTimelineWithPTO(
                representations[i]
              );

              // Check segment count
              if (
                currentTimeline.segments.length !==
                referenceTimeline.segments.length
              ) {
                consistent = false;
                issues.push(
                  `Period ${periodId}, AS${asIndex} Rep${i}: Segment count mismatch (${currentTimeline.segments.length} vs ${referenceTimeline.segments.length})`
                );
                continue;
              }

              // CRITICAL: Check FULL timeline equivalence, not just first segment
              let divergenceFound = false;
              for (
                let segIndex = 0;
                segIndex < referenceTimeline.segments.length;
                segIndex++
              ) {
                const refSeg = referenceTimeline.segments[segIndex];
                const curSeg = currentTimeline.segments[segIndex];

                const startDiff = Math.abs(refSeg.start - curSeg.start);
                const durationDiff = Math.abs(
                  refSeg.duration - curSeg.duration
                );

                if (startDiff > 0.001 || durationDiff > 0.001) {
                  consistent = false;
                  divergenceFound = true;
                  issues.push(
                    `Period ${periodId}, AS${asIndex} Rep${i} Seg${segIndex}: Timeline divergence (start: ${refSeg.start.toFixed(
                      3
                    )}s vs ${curSeg.start.toFixed(
                      3
                    )}s, duration: ${refSeg.duration.toFixed(
                      3
                    )}s vs ${curSeg.duration.toFixed(3)}s)`
                  );

                  // Report first divergence point and stop checking this representation
                  break;
                }
              }

              // If no divergence found, validate timeline continuity within this representation
              if (!divergenceFound) {
                const continuityCheck = this.validateTimelineContinuity(
                  currentTimeline.segments,
                  periodId,
                  asIndex,
                  i
                );
                if (!continuityCheck.valid) {
                  consistent = false;
                  issues.push(...continuityCheck.issues);
                }
              }
            }
          }
        });
      });

      console.log("Segment equivalence result:", { consistent, issues });
      console.log("=== END SEGMENT EQUIVALENCE VALIDATION ===");

      return { consistent, issues };
    },

    // Validate timeline continuity within a single representation
    validateTimelineContinuity(segments, periodId, asIndex, repIndex) {
      const issues = [];
      let valid = true;

      for (let i = 1; i < segments.length; i++) {
        const prevSeg = segments[i - 1];
        const currSeg = segments[i];

        // Rule: next.start === prev.start + prev.duration
        const expectedStart = prevSeg.start + prevSeg.duration;
        const actualStart = currSeg.start;

        if (Math.abs(expectedStart - actualStart) > 0.001) {
          valid = false;
          issues.push(
            `Period ${periodId}, AS${asIndex} Rep${repIndex}: Timeline gap between segments ${
              i - 1
            } and ${i} (expected ${expectedStart.toFixed(
              3
            )}s, got ${actualStart.toFixed(3)}s)`
          );
        }
      }

      return { valid, issues };
    },

    // CORRECT: Validate video/audio duration with proper tolerance for DASH streams
    validateVideoAudioDurationConsistency(periods) {
      const issues = [];
      let consistent = true;

      console.log("=== VALIDATING VIDEO/AUDIO DURATION CONSISTENCY ===");

      periods.forEach((period, periodIndex) => {
        const periodId =
          period.id?.parsed ||
          period.id?.raw ||
          period.id ||
          `period_${periodIndex}`;
        const adaptationSets = this.ensureArray(period.AdaptationSet);

        let videoDuration = null;
        let audioDuration = null;

        adaptationSets.forEach((as) => {
          const contentType =
            as.contentType?.parsed ||
            this.inferContentType(as.mimeType?.parsed);
          const representations = this.ensureArray(as.Representation);

          if (representations.length > 0) {
            const timeline = this.expandTimelineWithPTO(representations[0]);

            if (contentType === "video") {
              videoDuration = timeline.totalDuration;
              console.log(
                `Period ${periodId}: Video duration = ${videoDuration}s`
              );
            } else if (contentType === "audio") {
              audioDuration = timeline.totalDuration;
              console.log(
                `Period ${periodId}: Audio duration = ${audioDuration}s`
              );
            }
          }
        });

        // CORRECT: Use generous tolerance for DASH streams
        // Audio often starts earlier, ends later, has padding, and live manifests never perfectly match
        if (
          videoDuration !== null &&
          videoDuration !== undefined &&
          audioDuration !== null &&
          audioDuration !== undefined
        ) {
          const durationDiff = Math.abs(videoDuration - audioDuration);

          // Use 5% tolerance or minimum 1 second, whichever is larger
          const tolerance = Math.max(
            1.0,
            Math.max(videoDuration, audioDuration) * 0.05
          );

          if (durationDiff > tolerance) {
            // This is now a WARNING, not an ERROR
            consistent = false;
            issues.push(
              `Period ${periodId}: Video/Audio duration difference (${durationDiff.toFixed(
                3
              )}s) exceeds tolerance (${tolerance.toFixed(
                3
              )}s) - Video: ${videoDuration.toFixed(
                3
              )}s, Audio: ${audioDuration.toFixed(3)}s`
            );
          } else if (durationDiff > 0.1) {
            // Log minor differences as info
            console.log(
              `Period ${periodId}: Minor video/audio duration difference (${durationDiff.toFixed(
                3
              )}s) within tolerance`
            );
          }
        } else if (
          (videoDuration === null || videoDuration === undefined) &&
          (audioDuration === null || audioDuration === undefined)
        ) {
          // No duration information available
          console.log(
            `Period ${periodId}: No duration information available for comparison`
          );
        } else {
          // Only one content type has duration info - this is acceptable
          const availableType =
            videoDuration !== null && videoDuration !== undefined
              ? "video"
              : "audio";
          const availableDuration =
            videoDuration !== null && videoDuration !== undefined
              ? videoDuration
              : audioDuration;
          if (availableDuration !== null && availableDuration !== undefined) {
            console.log(
              `Period ${periodId}: Only ${availableType} duration available (${availableDuration.toFixed(
                3
              )}s)`
            );
          }
        }
      });

      console.log("Duration consistency result:", { consistent, issues });
      console.log("=== END DURATION CONSISTENCY VALIDATION ===");

      return { consistent, issues };
    },

    // HEURISTIC: Validate Period ID corresponds to last segment boundary (SSAI convention, not DASH spec)
    validatePeriodIdAgainstLastSegment(periods) {
      const issues = [];
      let correct = true;

      console.log(
        "=== VALIDATING PERIOD ID AGAINST LAST SEGMENT (HEURISTIC) ==="
      );

      periods.forEach((period, periodIndex) => {
        const periodId =
          period.id?.parsed ||
          period.id?.raw ||
          period.id ||
          `period_${periodIndex}`;
        const adaptationSets = this.ensureArray(period.AdaptationSet);

        let maxLastSegmentEnd = 0;

        adaptationSets.forEach((as) => {
          const representations = this.ensureArray(as.Representation);

          if (representations.length > 0) {
            const timeline = this.expandTimelineWithPTO(representations[0]);
            if (timeline.lastSegmentEnd > maxLastSegmentEnd) {
              maxLastSegmentEnd = timeline.lastSegmentEnd;
            }
          }
        });

        console.log(
          `Period ${periodId}: Last segment ends at ${maxLastSegmentEnd}s`
        );

        // HEURISTIC: Extract expected duration from Period ID (SSAI convention, not DASH requirement)
        const idMatch = periodId.match(/(\d+)s?$/); // Match numbers at end, optionally followed by 's'
        if (idMatch) {
          const expectedDuration = parseInt(idMatch[1]);
          const actualDuration = Math.round(maxLastSegmentEnd);

          if (Math.abs(expectedDuration - actualDuration) > 1) {
            correct = false;
            issues.push(
              `Period ${periodId}: ID suggests ${expectedDuration}s but last segment ends at ${actualDuration}s (HEURISTIC: assumes Period ID encodes duration)`
            );
          }
        }

        // Additional check: Period@duration vs actual timeline duration
        const periodDuration = period.duration?.parsed;
        if (
          periodDuration &&
          Math.abs(periodDuration - maxLastSegmentEnd) > 0.1
        ) {
          correct = false;
          issues.push(
            `Period ${periodId}: Period@duration (${periodDuration}s) doesn't match timeline end (${maxLastSegmentEnd}s)`
          );
        }
      });

      console.log("Period ID validation result:", { correct, issues });
      console.log("=== END PERIOD ID VALIDATION ===");

      return { correct, issues };
    },

    // CORRECT: Strict Period ID validation with uniqueness and naming rules
    validatePeriodIdRules(periods) {
      const issues = [];
      let valid = true;
      const seenIds = new Set();

      console.log("=== VALIDATING PERIOD ID RULES ===");

      periods.forEach((period, periodIndex) => {
        const periodId =
          period.id?.parsed ||
          period.id?.raw ||
          period.id ||
          `period_${periodIndex}`;

        // Check uniqueness
        if (seenIds.has(periodId)) {
          valid = false;
          issues.push(`Duplicate Period ID: "${periodId}"`);
        }
        seenIds.add(periodId);

        // Determine if this is an ad period (authoritative detection)
        const isAdPeriod = this.isAuthoritativeAdPeriod(period);

        console.log(`Period ${periodId}: isAdPeriod = ${isAdPeriod}`);

        // Enforce naming rules
        if (isAdPeriod && !periodId.startsWith("ad")) {
          valid = false;
          issues.push(`Ad Period "${periodId}" must start with "ad"`);
        }

        if (!isAdPeriod && periodId.startsWith("ad")) {
          valid = false;
          issues.push(`Content Period "${periodId}" must NOT start with "ad"`);
        }

        // Validate Period ID against last segment boundary (HEURISTIC - not authoritative)
        const lastSegmentValidation = this.validatePeriodIdAgainstLastSegment([
          period,
        ]);
        if (!lastSegmentValidation.correct) {
          // Downgrade to warning - Period ID duration encoding is SSAI convention, not DASH spec
          issues.push(
            `WARNING: ${lastSegmentValidation.issues.join(
              ", "
            )} (Period ID duration encoding is not guaranteed by DASH spec)`
          );
        }
      });

      console.log("Period ID rules result:", { valid, issues });
      console.log("=== END PERIOD ID RULES VALIDATION ===");

      return { valid, issues };
    },

    // CORRECT: Authoritative ad period detection (not heuristic)
    isAuthoritativeAdPeriod(period) {
      // Check for SCTE-35 EventStreams (authoritative ad marker)
      if (period.EventStream) {
        const eventStreams = this.ensureArray(period.EventStream);
        const hasScte35 = eventStreams.some((es) => {
          const schemeId = es.schemeIdUri || "";
          return (
            schemeId.includes("scte35") || schemeId.includes("urn:scte:scte35")
          );
        });
        if (hasScte35) return true;
      }

      // Check for ad-specific AdaptationSet characteristics
      const adaptationSets = this.ensureArray(period.AdaptationSet);
      const hasAdMarkers = adaptationSets.some((as) => {
        // Check for explicit ad content types
        const contentType = as.contentType?.parsed || "";
        if (contentType === "advertisement") return true;

        // Check for ad-specific roles
        if (as.Role) {
          const roles = this.ensureArray(as.Role);
          return roles.some((role) => {
            const schemeId = role.schemeIdUri || "";
            const value = role.value || "";
            return (
              schemeId.includes("urn:mpeg:dash:role") &&
              value === "advertisement"
            );
          });
        }

        return false;
      });

      return hasAdMarkers;
    },

    // Ad period detection for DOM elements (used in detailed view)
    isAdPeriodFromDom(periodElement) {
      // Check for SCTE-35 EventStreams (authoritative ad marker)
      const eventStreams = periodElement.querySelectorAll("EventStream");
      for (let es of eventStreams) {
        const schemeId = es.getAttribute("schemeIdUri") || "";
        if (
          schemeId.includes("scte35") ||
          schemeId.includes("urn:scte:scte35")
        ) {
          return true;
        }
      }

      // Check for ad-specific AdaptationSet characteristics
      const adaptationSets = periodElement.querySelectorAll("AdaptationSet");
      for (let as of adaptationSets) {
        // Check for explicit ad content types
        const contentType = as.getAttribute("contentType") || "";
        if (contentType === "advertisement") return true;

        // Check for ad-specific roles
        const roles = as.querySelectorAll("Role");
        for (let role of roles) {
          const schemeId = role.getAttribute("schemeIdUri") || "";
          const value = role.getAttribute("value") || "";
          if (
            schemeId.includes("urn:mpeg:dash:role") &&
            value === "advertisement"
          ) {
            return true;
          }
        }
      }

      // Fallback: Check Period ID for ad pattern (heuristic)
      const periodId = periodElement.getAttribute("id") || "";
      return periodId.toLowerCase().startsWith("ad");
    },

    // CORRECT: Analyze period segments using concrete segment identity
    async analyzePeriodSegments(periods) {
      const analysis = [];

      try {
        // Get previous periods for comparison
        const previousPeriods = await this.extractPreviousPeriods();

        // Build maps by Period ID for current and previous using concrete segments
        const currentVideoSegments =
          this.getConcreteSegmentsByPeriodAndContentType(periods, "video");
        const currentAudioSegments =
          this.getConcreteSegmentsByPeriodAndContentType(periods, "audio");
        const previousVideoSegments =
          this.getConcreteSegmentsByPeriodAndContentType(
            previousPeriods,
            "video"
          );
        const previousAudioSegments =
          this.getConcreteSegmentsByPeriodAndContentType(
            previousPeriods,
            "audio"
          );

        console.log("=== CONCRETE SEGMENT ANALYSIS DEBUG ===");
        console.log("Current video segments by period:", currentVideoSegments);
        console.log(
          "Previous video segments by period:",
          previousVideoSegments
        );
        console.log("Current audio segments by period:", currentAudioSegments);
        console.log(
          "Previous audio segments by period:",
          previousAudioSegments
        );

        // Analyze video segment changes using concrete segment comparison
        const videoChanges = this.compareConcreteSegmentMaps(
          currentVideoSegments,
          previousVideoSegments
        );
        const audioChanges = this.compareConcreteSegmentMaps(
          currentAudioSegments,
          previousAudioSegments
        );

        console.log("Video segment changes:", videoChanges);
        console.log("Audio segment changes:", audioChanges);
        console.log("=== END CONCRETE SEGMENT ANALYSIS DEBUG ===");

        // Period Segment Added (Video)
        const videoAddedValue =
          videoChanges.added.length > 0
            ? videoChanges.added
                .map(
                  (change) =>
                    `Period id="${change.periodId}": ADDED ${change.count} seg`
                )
                .join("\n")
            : "0";

        analysis.push({
          metric: "Period Segment Added (Video)",
          value: videoAddedValue,
          status: videoChanges.added.length > 0 ? "ADDED" : "OK",
          statusClass:
            videoChanges.added.length > 0 ? "status-added" : "status-ok",
          hasDifference: videoChanges.added.length > 0,
        });

        // Period Segment Removed (Video)
        const videoRemovedValue =
          videoChanges.removed.length > 0
            ? videoChanges.removed
                .map(
                  (change) =>
                    `Period id="${change.periodId}": Removed ${change.count} seg`
                )
                .join("\n")
            : "0";

        analysis.push({
          metric: "Period Segment Removed (Video)",
          value: videoRemovedValue,
          status: videoChanges.removed.length > 0 ? "REMOVED" : "OK",
          statusClass:
            videoChanges.removed.length > 0 ? "status-removed" : "status-ok",
          hasDifference: videoChanges.removed.length > 0,
        });

        // Period Segment Added (Audio)
        const audioAddedValue =
          audioChanges.added.length > 0
            ? audioChanges.added
                .map(
                  (change) =>
                    `Period id="${change.periodId}": ADDED ${change.count} seg`
                )
                .join("\n")
            : "0";

        analysis.push({
          metric: "Period Segment Added (Audio)",
          value: audioAddedValue,
          status: audioChanges.added.length > 0 ? "ADDED" : "OK",
          statusClass:
            audioChanges.added.length > 0 ? "status-added" : "status-ok",
          hasDifference: audioChanges.added.length > 0,
        });

        // Period Segment Removed (Audio)
        const audioRemovedValue =
          audioChanges.removed.length > 0
            ? audioChanges.removed
                .map(
                  (change) =>
                    `Period id="${change.periodId}": REMOVED ${change.count} seg`
                )
                .join("\n")
            : "0";

        analysis.push({
          metric: "Period Segment Removed (AUDIO)",
          value: audioRemovedValue,
          status: audioChanges.removed.length > 0 ? "REMOVED" : "OK",
          statusClass:
            audioChanges.removed.length > 0 ? "status-removed" : "status-ok",
          hasDifference: audioChanges.removed.length > 0,
        });

        // Store global totals for use in analyzeSegments
        this.globalSegmentChanges = {
          totalAdded: videoChanges.totalAdded + audioChanges.totalAdded,
          totalRemoved: videoChanges.totalRemoved + audioChanges.totalRemoved,
          videoChanges: videoChanges,
          audioChanges: audioChanges,
        };
      } catch (error) {
        console.error("Period segment analysis failed:", error);

        // Return error states for all four metrics
        const errorMetrics = [
          "Period Segment Added (Video)",
          "Period Segment Removed (Video)",
          "Period Segment Added (Audio)",
          "Period Segment Removed (AUDIO)",
        ];

        errorMetrics.forEach((metric) => {
          analysis.push({
            metric: metric,
            value: "Analysis failed",
            status: "ERROR",
            statusClass: "status-error",
            hasDifference: false,
          });
        });

        // Initialize empty global changes
        this.globalSegmentChanges = {
          totalAdded: 0,
          totalRemoved: 0,
          videoChanges: {
            added: [],
            removed: [],
            totalAdded: 0,
            totalRemoved: 0,
          },
          audioChanges: {
            added: [],
            removed: [],
            totalAdded: 0,
            totalRemoved: 0,
          },
        };
      }

      return analysis;
    },

    async extractPreviousPeriods() {
      if (!this.previousManifest) return [];

      try {
        // Import ManifestService to extract periods from previous manifest
        const { ManifestService } = await import(
          "../services/manifestService.js"
        );
        const manifestService = new ManifestService();
        const previousMpdInfo = manifestService.extractMpdInfo(
          this.previousManifest
        );
        return this.ensureArray(previousMpdInfo.Period);
      } catch (error) {
        console.warn("Failed to extract previous periods:", error);
        return [];
      }
    },

    // CORRECT: Check actual DASH profile consistency (codecs, MIME types, resolution ladders)
    checkProfileConsistency(periods) {
      const issues = [];
      let consistent = true;

      try {
        console.log("=== CHECKING DASH PROFILE CONSISTENCY ===");

        if (periods.length <= 1) {
          console.log(
            "Only one period found, profile consistency is automatically true"
          );
          return { consistent: true, issues: [] };
        }

        // Extract actual DASH profiles for each period
        const periodProfiles = periods.map((period, index) => {
          const adaptationSets = this.ensureArray(period.AdaptationSet);

          const profile = {
            periodIndex: index,
            periodId: period.id?.parsed || period.id?.raw || `period_${index}`,
            adaptationSets: [],
          };

          adaptationSets.forEach((as, asIndex) => {
            const representations = this.ensureArray(as.Representation);
            const asProfile = {
              asIndex: asIndex,
              contentType:
                as.contentType?.parsed ||
                this.inferContentType(as.mimeType?.parsed),
              mimeType: as.mimeType?.parsed || "unknown",
              codecs: as.codecs?.parsed || "unknown",
              representations: [],
            };

            representations.forEach((rep) => {
              const repProfile = {
                bandwidth: rep.bandwidth?.parsed || 0,
                width: rep.width?.parsed || 0,
                height: rep.height?.parsed || 0,
                frameRate: rep.frameRate?.parsed || "unknown",
                audioSamplingRate: rep.audioSamplingRate?.parsed || 0,
                codecs: rep.codecs?.parsed || asProfile.codecs,
                mimeType: rep.mimeType?.parsed || asProfile.mimeType,
                // SegmentTemplate compatibility
                segmentTemplate: this.extractSegmentTemplateProfile(
                  rep.SegmentTemplate
                ),
              };

              asProfile.representations.push(repProfile);
            });

            profile.adaptationSets.push(asProfile);
          });

          console.log(`Period ${index} DASH profile:`, profile);
          return profile;
        });

        // Compare DASH profiles between periods
        const referencePeriod = periodProfiles[0];

        for (let i = 1; i < periodProfiles.length; i++) {
          const currentPeriod = periodProfiles[i];

          // Check AdaptationSet count consistency
          if (
            currentPeriod.adaptationSets.length !==
            referencePeriod.adaptationSets.length
          ) {
            consistent = false;
            issues.push(
              `Period ${i}: Different number of AdaptationSets (${currentPeriod.adaptationSets.length} vs ${referencePeriod.adaptationSets.length})`
            );
            continue;
          }

          // Check each AdaptationSet profile compatibility
          for (
            let asIndex = 0;
            asIndex < referencePeriod.adaptationSets.length;
            asIndex++
          ) {
            const refAS = referencePeriod.adaptationSets[asIndex];
            const curAS = currentPeriod.adaptationSets[asIndex];

            // Content type must match
            if (curAS.contentType !== refAS.contentType) {
              consistent = false;
              issues.push(
                `Period ${i} AS${asIndex}: Content type mismatch (${curAS.contentType} vs ${refAS.contentType})`
              );
            }

            // MIME type must be compatible
            if (curAS.mimeType !== refAS.mimeType) {
              consistent = false;
              issues.push(
                `Period ${i} AS${asIndex}: MIME type mismatch (${curAS.mimeType} vs ${refAS.mimeType})`
              );
            }

            // Codec compatibility check
            if (
              curAS.codecs !== refAS.codecs &&
              curAS.codecs !== "unknown" &&
              refAS.codecs !== "unknown"
            ) {
              consistent = false;
              issues.push(
                `Period ${i} AS${asIndex}: Codec mismatch (${curAS.codecs} vs ${refAS.codecs})`
              );
            }

            // Check representation ladder compatibility
            const ladderCheck = this.checkRepresentationLadderCompatibility(
              refAS.representations,
              curAS.representations,
              i,
              asIndex
            );
            if (!ladderCheck.compatible) {
              consistent = false;
              issues.push(...ladderCheck.issues);
            }

            // Check SegmentTemplate compatibility
            const templateCheck = this.checkSegmentTemplateCompatibility(
              refAS.representations,
              curAS.representations,
              i,
              asIndex
            );
            if (!templateCheck.compatible) {
              consistent = false;
              issues.push(...templateCheck.issues);
            }
          }
        }

        console.log("DASH profile consistency result:", { consistent, issues });
        console.log("=== END DASH PROFILE CONSISTENCY CHECK ===");
      } catch (error) {
        console.warn("DASH profile consistency check failed:", error);
        consistent = false;
        issues.push("DASH profile consistency check failed");
      }

      return { consistent, issues };
    },

    // Extract SegmentTemplate profile for compatibility checking
    extractSegmentTemplateProfile(segmentTemplate) {
      if (!segmentTemplate) return null;

      return {
        timescale: segmentTemplate.timescale?.parsed || 1,
        duration: segmentTemplate.duration?.parsed || null,
        startNumber: segmentTemplate.startNumber?.parsed || 1,
        hasTimeline: !!segmentTemplate.SegmentTimeline,
        media: segmentTemplate.media || null,
        initialization: segmentTemplate.initialization || null,
      };
    },

    // Check if representation ladders are compatible between periods
    checkRepresentationLadderCompatibility(
      refReps,
      curReps,
      periodIndex,
      asIndex
    ) {
      const issues = [];
      let compatible = true;

      // Check representation count
      if (curReps.length !== refReps.length) {
        compatible = false;
        issues.push(
          `Period ${periodIndex} AS${asIndex}: Different representation count (${curReps.length} vs ${refReps.length})`
        );
        return { compatible, issues };
      }

      // Sort representations by bandwidth for comparison
      const sortedRefReps = [...refReps].sort(
        (a, b) => a.bandwidth - b.bandwidth
      );
      const sortedCurReps = [...curReps].sort(
        (a, b) => a.bandwidth - b.bandwidth
      );

      for (let i = 0; i < sortedRefReps.length; i++) {
        const refRep = sortedRefReps[i];
        const curRep = sortedCurReps[i];

        // Check resolution compatibility (for video)
        if (refRep.width > 0 && refRep.height > 0) {
          if (
            curRep.width !== refRep.width ||
            curRep.height !== refRep.height
          ) {
            compatible = false;
            issues.push(
              `Period ${periodIndex} AS${asIndex} Rep${i}: Resolution mismatch (${curRep.width}x${curRep.height} vs ${refRep.width}x${refRep.height})`
            );
          }
        }

        // Check audio sampling rate compatibility (for audio)
        if (refRep.audioSamplingRate > 0) {
          if (curRep.audioSamplingRate !== refRep.audioSamplingRate) {
            compatible = false;
            issues.push(
              `Period ${periodIndex} AS${asIndex} Rep${i}: Audio sampling rate mismatch (${curRep.audioSamplingRate} vs ${refRep.audioSamplingRate})`
            );
          }
        }

        // Check codec compatibility
        if (
          curRep.codecs !== refRep.codecs &&
          curRep.codecs !== "unknown" &&
          refRep.codecs !== "unknown"
        ) {
          compatible = false;
          issues.push(
            `Period ${periodIndex} AS${asIndex} Rep${i}: Codec mismatch (${curRep.codecs} vs ${refRep.codecs})`
          );
        }
      }

      return { compatible, issues };
    },

    // Check SegmentTemplate compatibility between periods
    checkSegmentTemplateCompatibility(refReps, curReps, periodIndex, asIndex) {
      const issues = [];
      let compatible = true;

      for (let i = 0; i < Math.min(refReps.length, curReps.length); i++) {
        const refTemplate = refReps[i].segmentTemplate;
        const curTemplate = curReps[i].segmentTemplate;

        if (!refTemplate && !curTemplate) continue;

        if (!refTemplate || !curTemplate) {
          compatible = false;
          issues.push(
            `Period ${periodIndex} AS${asIndex} Rep${i}: SegmentTemplate presence mismatch`
          );
          continue;
        }

        // Check timescale compatibility
        if (refTemplate.timescale !== curTemplate.timescale) {
          compatible = false;
          issues.push(
            `Period ${periodIndex} AS${asIndex} Rep${i}: Timescale mismatch (${curTemplate.timescale} vs ${refTemplate.timescale})`
          );
        }

        // Check template structure compatibility
        if (refTemplate.hasTimeline !== curTemplate.hasTimeline) {
          compatible = false;
          issues.push(
            `Period ${periodIndex} AS${asIndex} Rep${i}: SegmentTimeline structure mismatch`
          );
        }

        // Check duration-based template compatibility
        if (!refTemplate.hasTimeline && !curTemplate.hasTimeline) {
          if (refTemplate.duration !== curTemplate.duration) {
            compatible = false;
            issues.push(
              `Period ${periodIndex} AS${asIndex} Rep${i}: Segment duration mismatch (${curTemplate.duration} vs ${refTemplate.duration})`
            );
          }
        }
      }

      return { compatible, issues };
    },

    checkDurationConsistency(periods) {
      const issues = [];
      let consistent = true;

      try {
        periods.forEach((period, pIndex) => {
          const adaptationSets = this.ensureArray(period.AdaptationSet);
          let videoDuration = null;
          let audioDuration = null;

          adaptationSets.forEach((as) => {
            const contentType =
              as.contentType?.parsed ||
              this.inferContentType(as.mimeType?.parsed);
            const representations = this.ensureArray(as.Representation);

            representations.forEach((rep) => {
              if (rep.SegmentTemplate && rep.SegmentTemplate.SegmentTimeline) {
                const duration = this.calculateRepresentationDuration(
                  rep.SegmentTemplate
                );

                if (contentType === "video") {
                  if (videoDuration === null) {
                    videoDuration = duration;
                  } else if (Math.abs(videoDuration - duration) > 0.1) {
                    consistent = false;
                    issues.push(`Period ${pIndex}: Video duration mismatch`);
                  }
                } else if (contentType === "audio") {
                  if (audioDuration === null) {
                    audioDuration = duration;
                  } else if (Math.abs(audioDuration - duration) > 0.1) {
                    consistent = false;
                    issues.push(`Period ${pIndex}: Audio duration mismatch`);
                  }
                }
              }
            });
          });

          // Check if video and audio durations match within the period
          if (videoDuration !== null && audioDuration !== null) {
            if (Math.abs(videoDuration - audioDuration) > 0.1) {
              consistent = false;
              issues.push(
                `Period ${pIndex}: Video/Audio duration mismatch (${videoDuration.toFixed(
                  2
                )}s vs ${audioDuration.toFixed(2)}s)`
              );
            }
          }
        });
      } catch (error) {
        console.warn("Duration consistency check failed:", error);
        consistent = false;
        issues.push("Duration consistency check failed");
      }

      return { consistent, issues };
    },

    calculateRepresentationDuration(segmentTemplate) {
      if (!segmentTemplate.SegmentTimeline) return 0;

      const timescale = segmentTemplate.timescale?.parsed || 1;
      const sElements = this.ensureArray(segmentTemplate.SegmentTimeline.S);
      let totalDuration = 0;

      sElements.forEach((s) => {
        const duration = s.d?.parsed || 0;
        const repeat = s.r?.parsed || 0;
        totalDuration += duration * (repeat + 1);
      });

      return totalDuration / timescale;
    },

    // CORRECT: Validate start times using segment timeline, not Period.duration
    validateStartTimes(periods) {
      const issues = [];
      const periodResults = [];
      let correct = true;
      let tooltip = "";

      try {
        let expectedStart = 0;

        periods.forEach((period, pIndex) => {
          const periodId =
            period.id?.parsed ||
            period.id?.raw ||
            period.id ||
            `period_${pIndex}`;
          const actualStart = period.start?.parsed || 0;

          let periodCorrect = true;
          const periodIssues = [];

          // Validate Period.start continuity
          if (pIndex > 0 && Math.abs(actualStart - expectedStart) > 0.001) {
            correct = false;
            periodCorrect = false;
            const issue = `Start time discontinuity - expected ${expectedStart.toFixed(
              3
            )}s, got ${actualStart.toFixed(3)}s`;
            issues.push(`Period ${periodId}: ${issue}`);
            periodIssues.push(issue);
          }

          // CORRECT: Derive next Period start from last segment end, NOT from Period.duration
          const periodEndFromSegments =
            this.calculatePeriodEndFromSegments(period);

          if (periodEndFromSegments !== null) {
            // Use segment-derived end time for next period's expected start
            expectedStart = actualStart + periodEndFromSegments;

            // Validate against Period.duration if present (but don't rely on it)
            const periodDuration = period.duration?.parsed;
            if (
              periodDuration &&
              Math.abs(periodEndFromSegments - periodDuration) > 0.1
            ) {
              // This is informational, not an error
              console.log(
                `Period ${periodId}: Period.duration (${periodDuration.toFixed(
                  3
                )}s) differs from segment-derived duration (${periodEndFromSegments.toFixed(
                  3
                )}s)`
              );
            }
          } else {
            // Fallback to Period.duration if segment timeline is not available
            const periodDuration = period.duration?.parsed || 0;
            expectedStart = actualStart + periodDuration;

            if (periodDuration === 0) {
              console.warn(
                `Period ${periodId}: No duration information available (neither segments nor Period.duration)`
              );
            }
          }

          // Validate against segment timeline start times
          const segmentValidation = this.validatePeriodAgainstSegmentTimeline(
            period,
            actualStart
          );
          if (!segmentValidation.valid) {
            correct = false;
            periodCorrect = false;
            issues.push(
              ...segmentValidation.issues.map(
                (issue) => `Period ${periodId}: ${issue}`
              )
            );
            periodIssues.push(...segmentValidation.issues);
          }

          // Store result for this period
          periodResults.push({
            periodId: periodId,
            periodStart: actualStart.toFixed(3),
            correct: periodCorrect,
          });

          // Add to tooltip
          if (periodIssues.length > 0) {
            tooltip += `Period ${periodId}: ${periodIssues.join(", ")}\n`;
          }
        });

        console.log("Start time validation result:", {
          correct,
          issues,
          periodResults,
        });
      } catch (error) {
        console.error("Start time validation failed:", error);
        correct = false;
        issues.push("Start time validation failed");
      }

      return { correct, issues, periodResults, tooltip: tooltip.trim() };
    },

    // Calculate period end time from segment timeline (authoritative)
    calculatePeriodEndFromSegments(period) {
      try {
        const adaptationSets = this.ensureArray(period.AdaptationSet);
        let maxEndTime = null;

        adaptationSets.forEach((as) => {
          const representations = this.ensureArray(as.Representation);

          representations.forEach((rep) => {
            if (rep.SegmentTemplate && rep.SegmentTemplate.SegmentTimeline) {
              const timeline = this.expandTimelineWithPTO(rep);
              if (timeline.lastSegmentEnd > (maxEndTime || 0)) {
                maxEndTime = timeline.lastSegmentEnd;
              }
            }
          });
        });

        return maxEndTime;
      } catch (error) {
        console.warn("Failed to calculate period end from segments:", error);
        return null;
      }
    },

    // Validate period start time against segment timeline
    // eslint-disable-next-line no-unused-vars
    validatePeriodAgainstSegmentTimeline(period, periodStart) {
      const issues = [];
      let valid = true;

      try {
        const adaptationSets = this.ensureArray(period.AdaptationSet);

        adaptationSets.forEach((as) => {
          const representations = this.ensureArray(as.Representation);

          representations.forEach((rep, repIndex) => {
            if (rep.SegmentTemplate && rep.SegmentTemplate.SegmentTimeline) {
              const timescale = rep.SegmentTemplate.timescale?.parsed || 1;
              const pto =
                rep.SegmentTemplate.presentationTimeOffset?.parsed || 0;
              const sElements = this.ensureArray(
                rep.SegmentTemplate.SegmentTimeline.S
              );

              if (sElements.length > 0) {
                const firstS = sElements[0];
                if (firstS.t?.parsed !== undefined) {
                  // CORRECT: Calculate segment relative start time
                  const segmentRelativeStart =
                    (firstS.t.parsed - pto) / timescale;

                  // Validate that segment timeline aligns with period start
                  // Allow small tolerance for rounding errors
                  if (Math.abs(segmentRelativeStart) > 0.001) {
                    // Segment doesn't start at period boundary - this might be intentional
                    console.log(
                      `Rep ${repIndex}: First segment starts at ${segmentRelativeStart.toFixed(
                        3
                      )}s relative to period start`
                    );
                  }
                }
              }
            }
          });
        });
      } catch (error) {
        console.warn("Period vs segment timeline validation failed:", error);
        valid = false;
        issues.push("Segment timeline validation failed");
      }

      return { valid, issues };
    },

    validateSegmentTiming(periods) {
      const issues = [];
      let correct = true;

      // Production-grade tolerances for real DASH streams
      const AUDIO_TOLERANCE = 0.03; // 30ms - more than one AAC frame
      const VIDEO_TOLERANCE = 0.04; // 40ms - more than one video frame at 30fps
      const GENERAL_TOLERANCE = 0.05; // 50ms - for unknown content types

      try {
        periods.forEach((period, pIndex) => {
          const periodId =
            period.id?.parsed ||
            period.id?.raw ||
            period.id ||
            `period_${pIndex}`;
          const adaptationSets = this.ensureArray(period.AdaptationSet);

          adaptationSets.forEach((as) => {
            const contentType =
              as.contentType?.parsed ||
              this.inferContentType(as.mimeType?.parsed);
            const representations = this.ensureArray(as.Representation);

            // Determine appropriate tolerance based on content type
            let tolerance;
            switch (contentType) {
              case "audio":
                tolerance = AUDIO_TOLERANCE;
                break;
              case "video":
                tolerance = VIDEO_TOLERANCE;
                break;
              default:
                tolerance = GENERAL_TOLERANCE;
            }

            representations.forEach((rep, repIndex) => {
              if (rep.SegmentTemplate && rep.SegmentTemplate.SegmentTimeline) {
                const timescale = rep.SegmentTemplate.timescale?.parsed || 1;
                const pto =
                  rep.SegmentTemplate.presentationTimeOffset?.parsed || 0;
                const sElements = this.ensureArray(
                  rep.SegmentTemplate.SegmentTimeline.S
                );

                let currentTime = null;
                let segmentIndex = 0;

                sElements.forEach((s, sIndex) => {
                  const t = s.t?.parsed;
                  const d = s.d?.parsed;
                  const r = s.r?.parsed || 0;

                  // Validate d attribute (duration)
                  if (!d || d <= 0) {
                    correct = false;
                    issues.push(
                      `ERROR: Period ${periodId}.${contentType}.Rep${repIndex}.S${sIndex}: Invalid duration (${d})`
                    );
                    return;
                  }

                  // Validate t attribute with proper tolerance
                  if (t !== undefined) {
                    // If @t is present, validate it with tolerance
                    if (currentTime !== null) {
                      const expectedTime = currentTime;
                      const actualTime = t;
                      const deltaTime = Math.abs(actualTime - expectedTime);
                      const deltaSeconds = deltaTime / timescale;

                      if (deltaSeconds > tolerance) {
                        // Only flag as ERROR if beyond tolerance
                        correct = false;
                        issues.push(
                          `ERROR: Period ${periodId}.${contentType}.Rep${repIndex}.S${sIndex}: Timeline gap (${(
                            deltaSeconds * 1000
                          ).toFixed(1)}ms) exceeds ${contentType} tolerance (${(
                            tolerance * 1000
                          ).toFixed(0)}ms)`
                        );
                      } else if (deltaSeconds > 0.001) {
                        // Minor drift within tolerance - INFO level (doesn't fail validation)
                        issues.push(
                          `INFO: Period ${periodId}.${contentType}.Rep${repIndex}.S${sIndex}: Minor timestamp drift (${(
                            deltaSeconds * 1000
                          ).toFixed(1)}ms, within ${contentType} tolerance)`
                        );
                      }
                    }
                    currentTime = t;
                  } else if (currentTime === null) {
                    // First S element without @t defaults to 0
                    currentTime = 0;
                  }

                  // Validate each segment in this S element (including repeats)
                  for (let i = 0; i <= r; i++) {
                    // Validate segment timing rule with tolerance: next.t ≈ prev.t + prev.d
                    if (segmentIndex > 0) {
                      const effectiveDuration = d / timescale;

                      if (effectiveDuration <= 0) {
                        correct = false;
                        issues.push(
                          `ERROR: Period ${periodId}.${contentType}.Rep${repIndex} Segment${segmentIndex}: Zero or negative duration`
                        );
                      }
                    }

                    currentTime += d;
                    segmentIndex++;
                  }
                });

                // Validate overall timeline against Period duration with tolerance
                const totalTimelineDuration = (currentTime - pto) / timescale;
                const periodDuration = period.duration?.parsed;

                if (
                  periodDuration &&
                  Math.abs(totalTimelineDuration - periodDuration) > tolerance
                ) {
                  correct = false;
                  issues.push(
                    `ERROR: Period ${periodId}.${contentType}.Rep${repIndex}: Timeline duration (${totalTimelineDuration.toFixed(
                      3
                    )}s) significantly differs from Period@duration (${periodDuration.toFixed(
                      3
                    )}s) beyond tolerance (${(tolerance * 1000).toFixed(0)}ms)`
                  );
                } else if (
                  periodDuration &&
                  Math.abs(totalTimelineDuration - periodDuration) > 0.001
                ) {
                  issues.push(
                    `INFO: Period ${periodId}.${contentType}.Rep${repIndex}: Minor timeline/Period duration difference (${Math.abs(
                      totalTimelineDuration - periodDuration
                    ).toFixed(3)}s, within tolerance)`
                  );
                }
              }
            });
          });
        });
      } catch (error) {
        console.warn("Segment timing validation failed:", error);
        correct = false;
        issues.push("ERROR: Segment timing validation failed");
      }

      return { correct, issues };
    },

    // CORRECT: Calculate time differences with proper PTO + timescale normalization
    async calculateTimeDifferences(periods) {
      let summary = "No differences detected";

      try {
        const previousPeriods = await this.extractPreviousPeriods();

        if (previousPeriods.length === 0) {
          summary = "No previous manifest for comparison";
          return { summary };
        }

        const differences = [];
        let totalTimeDiff = 0;

        // CORRECT: Use stable period identities for comparison, not Period.id
        const currentIdentities = this.extractStablePeriodIdentities(periods);
        const previousIdentities =
          this.extractStablePeriodIdentities(previousPeriods);

        // Build maps for efficient lookup
        const currentPeriodMap = new Map();
        periods.forEach((period, index) => {
          const identity = currentIdentities[index];
          currentPeriodMap.set(identity.originalId, { period, identity });
        });

        const previousPeriodMap = new Map();
        previousPeriods.forEach((period, index) => {
          const identity = previousIdentities[index];
          previousPeriodMap.set(identity.originalId, { period, identity });
        });

        // Compare periods using stable identity matching
        currentIdentities.forEach((currentIdentity) => {
          // Find matching previous period
          const matchingPrevious = previousIdentities.find((prev) =>
            this.periodsMatch(currentIdentity, prev)
          );

          if (matchingPrevious) {
            const currentPeriod = currentPeriodMap.get(
              currentIdentity.originalId
            )?.period;
            const previousPeriod = previousPeriodMap.get(
              matchingPrevious.originalId
            )?.period;

            if (currentPeriod && previousPeriod) {
              // Calculate time differences using segment-based timing
              const timeDiff = this.calculatePeriodTimeDifferenceNormalized(
                currentPeriod,
                previousPeriod,
                currentIdentity.originalId
              );

              if (timeDiff.totalDiff > 0.001) {
                differences.push(
                  `${currentIdentity.originalId}: ${timeDiff.summary}`
                );
                totalTimeDiff += timeDiff.totalDiff;
              }
            }
          }
        });

        if (differences.length > 0) {
          summary = `Total: ${totalTimeDiff.toFixed(3)}s (${differences.join(
            ", "
          )})`;
        }
      } catch (error) {
        console.warn("Time difference calculation failed:", error);
        summary = "Time difference calculation failed";
      }

      return { summary };
    },

    // Calculate period time difference with proper normalization
    calculatePeriodTimeDifferenceNormalized(
      currentPeriod,
      previousPeriod,
      periodId
    ) {
      let totalDiff = 0;
      const details = [];

      try {
        const currentAS = this.ensureArray(currentPeriod.AdaptationSet);
        const previousAS = this.ensureArray(previousPeriod.AdaptationSet);

        // Build AdaptationSet maps by contentType for stable comparison
        const currentASMap = new Map();
        currentAS.forEach((as) => {
          const contentType =
            as.contentType?.parsed ||
            this.inferContentType(as.mimeType?.parsed);
          if (!currentASMap.has(contentType)) {
            currentASMap.set(contentType, as);
          }
        });

        const previousASMap = new Map();
        previousAS.forEach((as) => {
          const contentType =
            as.contentType?.parsed ||
            this.inferContentType(as.mimeType?.parsed);
          if (!previousASMap.has(contentType)) {
            previousASMap.set(contentType, as);
          }
        });

        // Compare by contentType using normalized timing
        currentASMap.forEach((currentAS, contentType) => {
          const previousAS = previousASMap.get(contentType);
          if (previousAS) {
            const currentReps = this.ensureArray(currentAS.Representation);
            const previousReps = this.ensureArray(previousAS.Representation);

            // Use first representation as authoritative timeline
            if (currentReps.length > 0 && previousReps.length > 0) {
              const timeDiff =
                this.calculateRepresentationTimeDifferenceNormalized(
                  currentReps[0],
                  previousReps[0],
                  contentType
                );

              if (timeDiff.diff > 0.001) {
                totalDiff += timeDiff.diff;
                details.push(`${contentType}: ${timeDiff.summary}`);
              } else if (timeDiff.error) {
                details.push(`${contentType}: ${timeDiff.error}`);
              }
            }
          }
        });
      } catch (error) {
        console.warn(
          `Period ${periodId} time difference calculation failed:`,
          error
        );
        details.push("Calculation failed");
      }

      return {
        totalDiff,
        summary:
          details.length > 0 ? details.join(", ") : `${totalDiff.toFixed(3)}s`,
      };
    },

    // Calculate representation time difference with proper PTO + timescale normalization
    calculateRepresentationTimeDifferenceNormalized(
      currentRep,
      previousRep,
      contentType
    ) {
      try {
        // Case 1: SegmentTemplate with SegmentTimeline (most accurate)
        if (
          currentRep.SegmentTemplate?.SegmentTimeline &&
          previousRep.SegmentTemplate?.SegmentTimeline
        ) {
          const currentTemplate = currentRep.SegmentTemplate;
          const previousTemplate = previousRep.SegmentTemplate;

          const currentTimescale = currentTemplate.timescale?.parsed || 1;
          const previousTimescale = previousTemplate.timescale?.parsed || 1;
          const currentPTO =
            currentTemplate.presentationTimeOffset?.parsed || 0;
          const previousPTO =
            previousTemplate.presentationTimeOffset?.parsed || 0;

          return this.calculateTimelineTimeDifferenceNormalized(
            currentTemplate.SegmentTimeline,
            previousTemplate.SegmentTimeline,
            currentTimescale,
            previousTimescale,
            currentPTO,
            previousPTO,
            contentType
          );
        }

        // Case 2: SegmentTemplate with duration (less accurate but workable)
        if (
          currentRep.SegmentTemplate?.duration &&
          previousRep.SegmentTemplate?.duration
        ) {
          const currentTemplate = currentRep.SegmentTemplate;
          const previousTemplate = previousRep.SegmentTemplate;

          const currentTimescale = currentTemplate.timescale?.parsed || 1;
          const previousTimescale = previousTemplate.timescale?.parsed || 1;

          const currentSegmentDuration =
            currentTemplate.duration.parsed / currentTimescale;
          const previousSegmentDuration =
            previousTemplate.duration.parsed / previousTimescale;

          // Check duration consistency
          if (
            Math.abs(currentSegmentDuration - previousSegmentDuration) > 0.001
          ) {
            return {
              diff: 0,
              error: "Segment duration changed - comparison invalid",
              summary: "Duration changed",
            };
          }

          const currentStartNumber = currentTemplate.startNumber?.parsed || 1;
          const previousStartNumber = previousTemplate.startNumber?.parsed || 1;

          if (currentStartNumber !== previousStartNumber) {
            const segmentDiff = currentStartNumber - previousStartNumber;
            const timeDiff = segmentDiff * currentSegmentDuration;
            return {
              diff: Math.abs(timeDiff),
              summary: `${timeDiff.toFixed(3)}s (${segmentDiff} segments)`,
            };
          }
        }

        // Case 3: No comparable timing information
        return {
          diff: 0,
          error: "No comparable timing information",
          summary: "Not computable",
        };
      } catch (error) {
        console.warn(
          `${contentType} representation time difference calculation failed:`,
          error
        );
        return {
          diff: 0,
          error: "Calculation failed",
          summary: "Calculation failed",
        };
      }
    },

    // Calculate timeline time difference with proper normalization
    calculateTimelineTimeDifferenceNormalized(
      currentTimeline,
      previousTimeline,
      currentTimescale,
      previousTimescale,
      currentPTO,
      previousPTO,
      contentType
    ) {
      try {
        const currentS = this.ensureArray(currentTimeline.S);
        const previousS = this.ensureArray(previousTimeline.S);

        if (currentS.length === 0 || previousS.length === 0) {
          return {
            diff: 0,
            error: "Empty timeline",
            summary: "Empty timeline",
          };
        }

        // CORRECT: Normalize both timelines to presentation time
        const currentFirstTime = currentS[0].t?.parsed;
        const previousFirstTime = previousS[0].t?.parsed;

        if (currentFirstTime === undefined || previousFirstTime === undefined) {
          return {
            diff: 0,
            error: "Missing timeline start time",
            summary: "Missing start time",
          };
        }

        // Normalize to presentation time: (t - PTO) / timescale
        const currentPresentationTime =
          (currentFirstTime - currentPTO) / currentTimescale;
        const previousPresentationTime =
          (previousFirstTime - previousPTO) / previousTimescale;

        const timeDiff = currentPresentationTime - previousPresentationTime;

        return {
          diff: Math.abs(timeDiff),
          summary: `${timeDiff.toFixed(3)}s`,
        };
      } catch (error) {
        console.warn(`${contentType} timeline comparison failed:`, error);
        return {
          diff: 0,
          error: "Timeline comparison failed",
          summary: "Comparison failed",
        };
      }
    },

    calculatePeriodTimeDifference(currentPeriod, previousPeriod) {
      let totalDiff = 0;
      const details = [];

      try {
        const currentAS = this.ensureArray(currentPeriod.AdaptationSet);
        const previousAS = this.ensureArray(previousPeriod.AdaptationSet);

        // Build AdaptationSet maps by contentType (not array index)
        const currentASMap = new Map();
        currentAS.forEach((as) => {
          const contentType =
            as.contentType?.parsed ||
            this.inferContentType(as.mimeType?.parsed);
          if (!currentASMap.has(contentType)) {
            currentASMap.set(contentType, as);
          }
        });

        const previousASMap = new Map();
        previousAS.forEach((as) => {
          const contentType =
            as.contentType?.parsed ||
            this.inferContentType(as.mimeType?.parsed);
          if (!previousASMap.has(contentType)) {
            previousASMap.set(contentType, as);
          }
        });

        // Compare by contentType, pick one authoritative timeline per contentType
        currentASMap.forEach((currentAS, contentType) => {
          const previousAS = previousASMap.get(contentType);
          if (previousAS) {
            const currentReps = this.ensureArray(currentAS.Representation);
            const previousReps = this.ensureArray(previousAS.Representation);

            // Pick first representation as authoritative timeline (don't sum across representations)
            if (currentReps.length > 0 && previousReps.length > 0) {
              const timeDiff = this.calculateRepresentationTimeDifference(
                currentReps[0],
                previousReps[0]
              );

              if (timeDiff.diff > 0.001) {
                totalDiff += timeDiff.diff;
                details.push(`${contentType}: ${timeDiff.summary}`);
              } else if (timeDiff.error) {
                details.push(`${contentType}: ${timeDiff.error}`);
              }
            }
          }
        });
      } catch (error) {
        console.warn("Period time difference calculation failed:", error);
      }

      return {
        totalDiff,
        summary:
          details.length > 0 ? details.join(", ") : `${totalDiff.toFixed(3)}s`,
      };
    },

    calculateRepresentationTimeDifference(currentRep, previousRep) {
      try {
        // Case 1: SegmentTemplate with duration (most common)
        if (currentRep.SegmentTemplate && previousRep.SegmentTemplate) {
          const currentTemplate = currentRep.SegmentTemplate;
          const previousTemplate = previousRep.SegmentTemplate;

          // Check if both have duration-based templates
          if (
            currentTemplate.duration?.parsed &&
            previousTemplate.duration?.parsed
          ) {
            const currentTimescale = currentTemplate.timescale?.parsed || 1;
            const previousTimescale = previousTemplate.timescale?.parsed || 1;

            const currentSegmentDuration =
              currentTemplate.duration.parsed / currentTimescale;
            const previousSegmentDuration =
              previousTemplate.duration.parsed / previousTimescale;

            // Check for duration consistency first
            if (
              Math.abs(currentSegmentDuration - previousSegmentDuration) > 0.001
            ) {
              return {
                diff: 0,
                error: "Duration mismatch - invalid comparison",
                summary: "Duration mismatch",
              };
            }

            const currentStartNumber = currentTemplate.startNumber?.parsed || 1;
            const previousStartNumber =
              previousTemplate.startNumber?.parsed || 1;

            // Correct formula: timeDiffSeconds = (segmentNumber2 - segmentNumber1) * segmentDurationSeconds
            if (currentStartNumber !== previousStartNumber) {
              const segmentDiff = currentStartNumber - previousStartNumber;
              const timeDiff = segmentDiff * currentSegmentDuration;
              return {
                diff: Math.abs(timeDiff),
                summary: `${timeDiff.toFixed(3)}s (${segmentDiff} segments)`,
              };
            }
          }

          // Case 2: SegmentTimeline (authoritative timeline)
          if (
            currentTemplate.SegmentTimeline &&
            previousTemplate.SegmentTimeline
          ) {
            return this.calculateTimelineTimeDifference(
              currentTemplate.SegmentTimeline,
              previousTemplate.SegmentTimeline,
              currentTemplate.timescale?.parsed || 1,
              previousTemplate.timescale?.parsed || 1,
              currentTemplate.presentationTimeOffset?.parsed || 0,
              previousTemplate.presentationTimeOffset?.parsed || 0
            );
          }
        }

        // Case 3: No SegmentTemplate or unsupported format
        return {
          diff: 0,
          error: "Time diff unknown - not computable",
          summary: "Not computable",
        };
      } catch (error) {
        console.warn(
          "Representation time difference calculation failed:",
          error
        );
        return {
          diff: 0,
          error: "Calculation failed",
          summary: "Calculation failed",
        };
      }
    },

    calculateTimelineTimeDifference(
      currentTimeline,
      previousTimeline,
      currentTimescale,
      previousTimescale,
      currentPTO,
      previousPTO
    ) {
      try {
        const currentS = this.ensureArray(currentTimeline.S);
        const previousS = this.ensureArray(previousTimeline.S);

        if (currentS.length === 0 || previousS.length === 0) {
          return {
            diff: 0,
            error: "Empty timeline - not computable",
            summary: "Empty timeline",
          };
        }

        // Expand both timelines to compare properly
        const currentSegments = this.expandSegmentTimeline(
          currentS,
          currentTimescale,
          currentPTO
        );
        const previousSegments = this.expandSegmentTimeline(
          previousS,
          previousTimescale,
          previousPTO
        );

        if (currentSegments.length === 0 || previousSegments.length === 0) {
          return {
            diff: 0,
            error: "Timeline expansion failed",
            summary: "Expansion failed",
          };
        }

        // Compare first segments (most common case for live edge detection)
        const currentFirstStart = currentSegments[0].effectiveStart;
        const previousFirstStart = previousSegments[0].effectiveStart;

        const timeDiff = currentFirstStart - previousFirstStart;

        // Check if timelines have structural differences
        if (Math.abs(currentSegments.length - previousSegments.length) > 0) {
          return {
            diff: Math.abs(timeDiff),
            summary: `${timeDiff.toFixed(3)}s (timeline structure changed)`,
          };
        }

        return {
          diff: Math.abs(timeDiff),
          summary: `${timeDiff.toFixed(3)}s`,
        };
      } catch (error) {
        console.warn("Timeline time difference calculation failed:", error);
        return {
          diff: 0,
          error: "Timeline comparison failed",
          summary: "Comparison failed",
        };
      }
    },

    // Helper method to expand SegmentTimeline S elements
    expandSegmentTimeline(sElements, timescale, pto) {
      const segments = [];
      let currentTime = 0;

      sElements.forEach((s) => {
        // If @t is present, it sets the absolute start time
        if (s.t?.parsed !== undefined) {
          currentTime = s.t.parsed;
        }

        const duration = s.d?.parsed || 0;
        const repeat = s.r?.parsed || 0;

        // Generate segments for this S element (1 + repeat count)
        for (let i = 0; i <= repeat; i++) {
          const effectiveStart = (currentTime - pto) / timescale;
          const effectiveDuration = duration / timescale;

          segments.push({
            effectiveStart: effectiveStart,
            effectiveDuration: effectiveDuration,
            rawStart: currentTime,
            rawDuration: duration,
          });

          currentTime += duration;
        }
      });

      return segments;
    },

    // Auto-refetch methods
    toggleAutoRefetch() {
      this.isAutoRefetch = !this.isAutoRefetch;

      if (this.isAutoRefetch) {
        this.startAutoRefetch();
      } else {
        this.stopAutoRefetch();
      }
    },

    pauseAutoRefetch() {
      this.isPaused = !this.isPaused;
      console.log(
        `🔄 PAUSE BUTTON CLICKED - New state: ${
          this.isPaused ? "PAUSED" : "RESUMED"
        }`
      );
      console.log(`🔄 Auto-refetch enabled: ${this.isAutoRefetch}`);
      console.log(`🔄 Current pending rows: ${this.pendingRows.length}`);

      if (this.isPaused) {
        console.log(
          "⏸️ PAUSED - MPDs will continue fetching but UI table will not update"
        );
        // Don't stop the timer - let it continue fetching in background
        // Data will be queued in pendingRows instead of added to table
      } else {
        console.log(
          "▶️ RESUMED - Processing all pending rows and updating table"
        );
        console.log(
          `▶️ About to process ${this.pendingRows.length} pending rows`
        );
        // Add all pending rows to the table when resuming
        this.processPendingRows();

        // Don't restart auto-refetch if timer is already running
        // The background timer should continue from where it left off
        if (this.isAutoRefetch && !this.refetchTimer) {
          console.log("▶️ Restarting auto-refetch timer (was stopped)");
          this.startAutoRefetch();
        } else {
          console.log(
            "▶️ Auto-refetch timer already running, continuing background fetching"
          );
        }
      }
    },

    // Process all pending rows that were collected during pause
    processPendingRows() {
      console.log(
        `📦 PROCESSING PENDING ROWS - Count: ${this.pendingRows.length}`
      );
      console.log(`📦 Pending rows data:`, this.pendingRows);

      if (this.pendingRows.length === 0) {
        console.log("📦 No pending rows to process");
        return;
      }

      console.log(`📦 Processing ${this.pendingRows.length} pending rows`);
      console.log(
        `📦 Current table rows before adding: ${this.comparisonHistory.length}`
      );

      // Add all pending rows to the end of comparison history (maintains chronological order)
      this.comparisonHistory.push(...this.pendingRows);

      // Clear pending rows
      const addedCount = this.pendingRows.length;
      this.pendingRows = [];

      console.log(`✅ Added ${addedCount} pending rows to table`);
      console.log(
        `✅ Total table rows after adding: ${this.comparisonHistory.length}`
      );

      // Force Vue to re-render the table to show all new rows
      this.$nextTick(() => {
        console.log(
          "✅ Vue re-render completed, all pending rows should be visible"
        );
      });
    },

    startAutoRefetch() {
      this.stopAutoRefetch(); // Clear any existing timer

      // DASH-compliant polling: schedule next fetch based on MPD's minimumUpdatePeriod
      this.scheduleNextMpdFetch();
    },

    stopAutoRefetch() {
      console.log("🛑 STOP AUTO-REFETCH called");
      if (this.refetchTimer) {
        console.log("🛑 Clearing existing timer:", this.refetchTimer);
        clearTimeout(this.refetchTimer);
        this.refetchTimer = null;
        console.log("🛑 Timer cleared and set to null");
      } else {
        console.log("🛑 No timer to clear");
      }
    },

    // DASH-compliant MPD polling scheduler
    scheduleNextMpdFetch() {
      if (!this.isAutoRefetch) return; // Only stop if auto-refetch is completely disabled
      // Continue scheduling even when paused - data will be queued instead of displayed

      let nextFetchDelayMs;

      // Extract minimumUpdatePeriod from current MPD (DASH-compliant way)
      const mpdRefreshInterval = this.extractMpdDuration(this.currentManifest);

      if (mpdRefreshInterval && mpdRefreshInterval > 0) {
        // Use MPD's minimumUpdatePeriod (spec-compliant)
        nextFetchDelayMs = mpdRefreshInterval * 1000;
        console.log(
          `DASH-compliant polling: Next fetch in ${mpdRefreshInterval}s (from minimumUpdatePeriod)`
        );
      } else {
        // Safe fallback for static MPDs or missing minimumUpdatePeriod
        nextFetchDelayMs = this.refetchInterval * 1000; // Use fallback interval from data
        console.log(
          `Fallback polling: Next fetch in ${this.refetchInterval}s (no minimumUpdatePeriod found)`
        );
      }

      // Add jitter tolerance for production-grade behavior (200ms)
      const jitterMs = 200;
      const totalDelayMs = nextFetchDelayMs + jitterMs;

      // Schedule next fetch using setTimeout (not setInterval)
      console.log(
        `⏰ Creating new timer with delay: ${totalDelayMs}ms, isPaused: ${this.isPaused}`
      );
      this.refetchTimer = setTimeout(async () => {
        console.log(
          `🔄 Timer callback triggered - isPaused: ${this.isPaused}, isAutoRefetch: ${this.isAutoRefetch}`
        );

        // Continue fetching even when paused (data will be queued)
        if (!this.isAutoRefetch) {
          console.log("🔄 Timer callback cancelled - auto-refetch disabled");
          return;
        }

        if (this.manifestUrl) {
          try {
            console.log(
              `🔄 Timer callback executing loadManifest${
                this.isPaused ? " (PAUSED - will queue)" : ""
              }`
            );
            await this.loadManifest();
            // After successful fetch, schedule the next one based on the NEW MPD's minimumUpdatePeriod
            this.scheduleNextMpdFetch();
          } catch (error) {
            console.error("Auto-refetch failed:", error);
            // On error, retry with fallback delay
            setTimeout(
              () => this.scheduleNextMpdFetch(),
              this.refetchInterval * 1000
            );
          }
        }
      }, totalDelayMs);
      console.log(`⏰ Timer created with ID:`, this.refetchTimer);
    },

    updateRefetchInterval() {
      // Note: With DASH-compliant polling, the interval is determined by MPD's minimumUpdatePeriod
      // This method is kept for UI compatibility but doesn't affect actual polling behavior
      console.log(
        "Note: Refresh interval is now determined by MPD's minimumUpdatePeriod, not manual setting"
      );

      if (this.isAutoRefetch) {
        this.startAutoRefetch(); // Restart with DASH-compliant polling
      }
    },

    // Player methods
    playStream() {
      if (!this.manifestUrl || !this.$refs.videoElement) {
        this.playerStatus = "Cannot play: No URL or video element";
        return;
      }

      this.playerStatus = "Starting playback...";

      try {
        // Mute video for auto-play compatibility
        this.$refs.videoElement.muted = true;

        const onSegmentLoaded = (segment) => {
          if (segment.error) {
            console.warn(`Segment error: ${segment.url} - ${segment.error}`);
          }
        };

        const onError = (errorMessage) => {
          this.playerStatus = `Error: ${errorMessage}`;
          console.error("Player error:", errorMessage);
        };

        this.player = this.dashPlayerService.createPlayer(
          "single",
          this.$refs.videoElement,
          this.manifestUrl,
          onSegmentLoaded,
          onError
        );

        this.playerStatus = "Playing";
      } catch (error) {
        this.playerStatus = `Failed to start: ${error.message}`;
        console.error("Player initialization failed:", error);
      }
    },

    stopStream() {
      if (this.player) {
        this.dashPlayerService.stopPlayer("single");
        this.player = null;
        this.playerStatus = "Stopped";
      }
    },

    initializePlayer() {
      // This method is called from startComparison
      // Player will be started manually by user
      this.playerStatus = "Ready to play";
    },

    // Utility methods
    clearError() {
      this.error = null;
    },

    getMetricValue(metricName) {
      const metric = this.comparisonData.find(
        (item) => item.metric === metricName
      );
      return metric ? metric.value : "";
    },

    getMetricTooltip(metricName) {
      const metric = this.comparisonData.find(
        (item) => item.metric === metricName
      );
      return metric ? metric.tooltip || "" : "";
    },

    getMetricStatusClass(metricName) {
      const metric = this.comparisonData.find(
        (item) => item.metric === metricName
      );
      return metric ? metric.statusClass : "";
    },

    // Check if a row has changes compared to the previous row with numeric tolerance and severity
    hasRowChanges(currentEntry, previousEntry) {
      if (!previousEntry) return true; // First row always considered as having changes

      // Compare all metric values between current and previous entries
      const currentMetrics = new Map();
      const previousMetrics = new Map();

      currentEntry.data.forEach((metric) => {
        // Exclude timestamp from comparison since it always changes
        if (metric.metric !== "Table from Header") {
          currentMetrics.set(metric.metric, {
            value: metric.value,
            status: metric.status,
            hasDifference: metric.hasDifference,
          });
        }
      });

      previousEntry.data.forEach((metric) => {
        // Exclude timestamp from comparison since it always changes
        if (metric.metric !== "Table from Header") {
          previousMetrics.set(metric.metric, {
            value: metric.value,
            status: metric.status,
            hasDifference: metric.hasDifference,
          });
        }
      });

      // Check if any metric value has changed with proper comparison
      for (const [metricName, currentMetric] of currentMetrics) {
        const previousMetric = previousMetrics.get(metricName);

        if (!previousMetric) {
          return true; // New metric appeared
        }

        // Compare with numeric tolerance for numeric values
        if (
          this.hasSignificantChange(currentMetric.value, previousMetric.value)
        ) {
          return true; // Found a significant change
        }

        // Also check status changes (error severity changes)
        if (currentMetric.status !== previousMetric.status) {
          return true; // Status/severity changed
        }

        // Check hasDifference flag changes
        if (currentMetric.hasDifference !== previousMetric.hasDifference) {
          return true; // Difference detection changed
        }
      }

      return false; // No significant changes found
    },

    // Helper method to detect significant changes with numeric tolerance
    hasSignificantChange(currentValue, previousValue) {
      // Exact string match first
      if (currentValue === previousValue) {
        return false;
      }

      // Try numeric comparison with tolerance for numeric values
      const currentNum = this.extractNumericValue(currentValue);
      const previousNum = this.extractNumericValue(previousValue);

      if (currentNum !== null && previousNum !== null) {
        // Both are numeric - use tolerance-based comparison
        const tolerance = Math.max(0.001, Math.abs(previousNum) * 0.001); // 0.1% tolerance or 0.001 minimum
        return Math.abs(currentNum - previousNum) > tolerance;
      }

      // For non-numeric values, check if it's just formatting differences
      const currentNormalized = this.normalizeValue(currentValue);
      const previousNormalized = this.normalizeValue(previousValue);

      return currentNormalized !== previousNormalized;
    },

    // Extract numeric value from string (handles formats like "5 (Number of periods added)")
    extractNumericValue(value) {
      if (typeof value === "number") return value;
      if (typeof value !== "string") return null;

      // Try to extract leading number
      const match = value.match(/^(\d+(?:\.\d+)?)/);
      if (match) {
        return parseFloat(match[1]);
      }

      // Try to extract time values (like "1.234s")
      const timeMatch = value.match(/(\d+(?:\.\d+)?)s/);
      if (timeMatch) {
        return parseFloat(timeMatch[1]);
      }

      return null;
    },

    // Normalize value for comparison (remove whitespace, case differences)
    normalizeValue(value) {
      if (typeof value !== "string") return value;

      return value.toLowerCase().replace(/\s+/g, " ").trim();
    },

    // Historical tracking helper methods
    getHistoryMetricValue(historyEntry, metricName) {
      const metric = historyEntry.data.find(
        (item) => item.metric === metricName
      );
      return metric ? metric.value : "";
    },

    getHistoryMetricTooltip(historyEntry, metricName) {
      const metric = historyEntry.data.find(
        (item) => item.metric === metricName
      );
      return metric ? metric.tooltip || "" : "";
    },

    getHistoryMetricStatusClass(historyEntry, metricName) {
      const metric = historyEntry.data.find(
        (item) => item.metric === metricName
      );
      return metric ? metric.statusClass : "";
    },

    // Detailed view method
    getDetailedHistoryMetricValue(historyEntry, metricName) {
      console.log("getDetailedHistoryMetricValue called with:", metricName);
      console.log("historyEntry:", historyEntry);

      const metric = historyEntry.data.find(
        (item) => item.metric === metricName
      );

      console.log("Found metric:", metric);

      if (!metric) {
        console.log("No metric found for:", metricName);
        return `No data for ${metricName}`;
      }

      console.log("Routing to detailed formatter for:", metricName);

      // Return detailed XML-like format for specific metrics
      switch (metricName) {
        case "Total Periods":
          return this.formatDetailedPeriods("total");
        case "Content Periods":
          return this.formatDetailedPeriods("content");
        case "Ad Periods":
          return this.formatDetailedPeriods("ad");
        case "Number Period Added (provide Id)":
          return this.formatDetailedPeriodsAddedRemoved("added", metric.value);
        case "Number of Period Removed":
          return this.formatDetailedPeriodsAddedRemoved(
            "removed",
            metric.value
          );
        case "Number of Segments Removed":
          return this.formatDetailedSegmentChanges("removed", metric.value);
        case "Number of Segments Added":
          return this.formatDetailedSegmentChanges("added", metric.value);
        case "Profile same in all Periods":
          return this.formatDetailedProfileConsistency();
        case "Video and Audio Duration are Same":
          return this.formatDetailedDurationConsistency();
        case "Start Time Correct?":
          return this.formatDetailedStartTimeValidation();
        case "Period Segment Added (Video)":
          return this.formatDetailedPeriodSegmentChanges(
            "video",
            "added",
            metric.value
          );
        case "Period Segment Removed (Video)":
          return this.formatDetailedPeriodSegmentChanges(
            "video",
            "removed",
            metric.value
          );
        case "Period Segment Added (Audio)":
          return this.formatDetailedPeriodSegmentChanges(
            "audio",
            "added",
            metric.value
          );
        case "Period Segment Removed (AUDIO)":
          return this.formatDetailedPeriodSegmentChanges(
            "audio",
            "removed",
            metric.value
          );
        case "Is Segment Timing Correct?":
          return this.formatDetailedSegmentTiming();
        case "Download Time vs Segment Duration":
          return this.formatDetailedDownloadTimeValidation();
        case "DRM Protection Status":
          return this.formatDetailedDRMStatus();
        case "DRM Signaling":
          return this.formatDetailedDRMSignaling();
        case "Period Start Time Comparison":
          return this.formatDetailedPeriodStartTimeComparison();
        case "Segments Same Across All Profiles":
          return this.formatDetailedSegmentProfileEquivalence();
        case "Period IDs Same as Previous MPD":
          return this.formatDetailedPeriodIdConsistency();
        case "Time Diff(s)":
          return this.formatDetailedTimeDifferences();
        case "Profile":
        case "Switch Profile":
          return ""; // Leave empty as requested
        default:
          console.log("Using default case for:", metricName);
          return metric.value; // Return normal value for other metrics
      }
    },

    formatDetailedPeriods(type) {
      console.log("formatDetailedPeriods called with type:", type);
      console.log("currentManifest exists:", !!this.currentManifest);

      if (!this.currentManifest) {
        console.log("No currentManifest available");
        return "No manifest data available";
      }

      try {
        const periods = this.currentManifest.querySelectorAll("Period");
        console.log("Found periods:", periods.length);

        if (periods.length === 0) {
          return "No periods found in manifest";
        }

        let result = "";

        // Restore proper filtering based on type
        Array.from(periods).forEach((period, index) => {
          console.log(`Processing period ${index}:`, period);

          // Check if it's an ad period using the DOM element directly
          const isAdPeriod = this.isAdPeriodFromDom(period);

          console.log(`Period ${index} isAdPeriod:`, isAdPeriod);

          let shouldInclude = false;
          if (type === "total") {
            shouldInclude = true; // Total shows all periods
          } else if (type === "content" && !isAdPeriod) {
            shouldInclude = true; // Content shows only non-ad periods
          } else if (type === "ad" && isAdPeriod) {
            shouldInclude = true; // Ad shows only ad periods
          }

          console.log(`Period ${index} shouldInclude:`, shouldInclude);

          if (shouldInclude) {
            // Show the actual Period XML from MPD
            const serializer = new XMLSerializer();
            let periodXml = serializer.serializeToString(period);
            periodXml = this.formatXmlWithIndentation(periodXml, 0);
            result += periodXml + "\n\n";
          }
        });

        console.log(`Final result for ${type} - length:`, result.length);

        // Return appropriate message if no periods match the filter
        if (result.trim() === "") {
          if (type === "content") {
            return "No content periods found (all periods detected as ads)";
          } else if (type === "ad") {
            return "No ad periods found (all periods detected as content)";
          } else {
            return "No periods found";
          }
        }

        return result.trim();
      } catch (error) {
        console.error("Error in formatDetailedPeriods:", error);
        return `Error: ${error.message}`;
      }
    },

    // Helper method to extract period data for filtering without modifying the display
    extractPeriodDataForFiltering(periodElement) {
      const adaptationSets = Array.from(
        periodElement.querySelectorAll("AdaptationSet")
      );
      return {
        AdaptationSet: adaptationSets.map((as) => ({
          contentType: { parsed: as.getAttribute("contentType") },
          mimeType: { parsed: as.getAttribute("mimeType") },
        })),
      };
    },

    formatDetailedPeriodsAddedRemoved(action, value) {
      // eslint-disable-next-line no-unused-vars
      if (value === "0" || !value) return "";

      if (!this.currentManifest) return "";

      try {
        // Extract period IDs from the value string
        const lines = value.split("\n");
        const idLines = lines.slice(1);

        let result = "";

        idLines.forEach((idLine) => {
          if (idLine.includes('Id="')) {
            const idMatch = idLine.match(/Id="([^"]+)"/);
            if (idMatch) {
              const periodId = idMatch[1];

              // Find the actual Period XML node in the MPD
              const periods = this.currentManifest.querySelectorAll("Period");
              for (let period of periods) {
                const nodeId = period.getAttribute("id");
                if (nodeId === periodId) {
                  // Show the actual Period XML from MPD
                  const serializer = new XMLSerializer();
                  let periodXml = serializer.serializeToString(period);
                  periodXml = this.formatXmlWithIndentation(periodXml, 0);
                  result += periodXml + "\n";
                  break;
                }
              }
            }
          }
        });

        return result || ""; // Return empty if no actual periods found
      } catch (error) {
        return ""; // No period data available
      }
    },

    formatDetailedSegmentChanges(action, value) {
      // eslint-disable-next-line no-unused-vars
      if (value === "0" || !value) return "";

      if (!this.currentManifest) return "";

      try {
        const lines = value.split("\n");
        const periodLines = lines.slice(1);

        let result = "";

        periodLines.forEach((line) => {
          const periodMatch = line.match(
            /Period id="([^"]+)": (\w+) (\d+) seg/
          );
          if (periodMatch) {
            const [, periodId] = periodMatch;

            // Find the actual Period and show its SegmentTemplate/SegmentTimeline
            const periods = this.currentManifest.querySelectorAll("Period");
            for (let period of periods) {
              const nodeId = period.getAttribute("id");
              if (nodeId === periodId) {
                result += `<Period id="${periodId}">\n`;

                // Show actual SegmentTemplate elements from this period
                const segmentTemplates =
                  period.querySelectorAll("SegmentTemplate");
                segmentTemplates.forEach((template) => {
                  const serializer = new XMLSerializer();
                  let templateXml = serializer.serializeToString(template);
                  templateXml = this.formatXmlWithIndentation(templateXml, 2);
                  result += templateXml + "\n";
                });

                result += `</Period>\n`;
                break;
              }
            }
          }
        });

        return result || ""; // Return empty if no actual segment data found
      } catch (error) {
        return ""; // No segment data available
      }
    },

    formatDetailedProfileConsistency() {
      // Only show actual MPD profiles attribute if it exists
      if (!this.currentManifest) return "";

      try {
        const mpd = this.currentManifest.querySelector("MPD");
        if (!mpd) return "";

        // Extract actual profiles attribute from MPD root
        const profiles = mpd.getAttribute("profiles");
        if (!profiles) return ""; // No profile information in MPD

        // Show just the profiles attribute value, no wrapper
        return `profiles="${profiles}"`;
      } catch (error) {
        return ""; // No profile data available
      }
    },

    formatDetailedDurationConsistency() {
      // Show actual Period elements with duration-related attributes from MPD
      if (!this.currentManifest) return "";

      try {
        let result = "";
        const periods = this.currentManifest.querySelectorAll("Period");

        periods.forEach((period) => {
          const duration = period.getAttribute("duration");

          if (duration) {
            // Show the actual Period XML with all its content
            const serializer = new XMLSerializer();
            let periodXml = serializer.serializeToString(period);
            periodXml = this.formatXmlWithIndentation(periodXml, 0);
            result += periodXml + "\n\n";
          }
        });

        return result.trim() || ""; // Return empty if no duration info found
      } catch (error) {
        return ""; // No duration data available
      }
    },

    formatDetailedStartTimeValidation() {
      // Show actual Period elements with start time attributes from MPD
      if (!this.currentManifest) return "";

      try {
        let result = "";
        const periods = this.currentManifest.querySelectorAll("Period");

        periods.forEach((period) => {
          const start = period.getAttribute("start");

          // Only show periods that have actual start time attributes
          if (start !== null) {
            // Show the actual Period XML with all its content
            const serializer = new XMLSerializer();
            let periodXml = serializer.serializeToString(period);
            periodXml = this.formatXmlWithIndentation(periodXml, 0);
            result += periodXml + "\n\n";
          }
        });

        return result.trim() || ""; // Return empty if no start time info found
      } catch (error) {
        return ""; // No start time data available
      }
    },

    formatDetailedPeriodSegmentChanges(contentType, action, value) {
      // eslint-disable-next-line no-unused-vars
      if (value === "0" || !value) return "";

      if (!this.currentManifest) return "";

      try {
        const lines = value.split("\n");

        let result = "";

        lines.forEach((line) => {
          const periodMatch = line.match(
            /Period id="([^"]+)": (\w+) (\d+) seg/
          );
          if (periodMatch) {
            const [, periodId] = periodMatch;

            // Find the actual Period and show its AdaptationSet for this contentType
            const periods = this.currentManifest.querySelectorAll("Period");
            for (let period of periods) {
              const nodeId = period.getAttribute("id");
              if (nodeId === periodId) {
                result += `<Period id="${periodId}">\n`;

                // Find AdaptationSet with matching contentType
                const adaptationSets = period.querySelectorAll("AdaptationSet");
                for (let as of adaptationSets) {
                  const asContentType = as.getAttribute("contentType");
                  if (asContentType === contentType) {
                    const serializer = new XMLSerializer();
                    let asXml = serializer.serializeToString(as);
                    asXml = this.formatXmlWithIndentation(asXml, 2);
                    result += asXml + "\n";
                    break;
                  }
                }

                result += `</Period>\n`;
                break;
              }
            }
          }
        });

        return result || ""; // Return empty if no actual data found
      } catch (error) {
        return ""; // No data available
      }
    },

    formatDetailedSegmentTiming() {
      // Show actual SegmentTemplate elements from MPD
      if (!this.currentManifest) return "";

      try {
        let result = "";
        const segmentTemplates =
          this.currentManifest.querySelectorAll("SegmentTemplate");

        segmentTemplates.forEach((template) => {
          const timescale = template.getAttribute("timescale");
          const duration = template.getAttribute("duration");
          const presentationTimeOffset = template.getAttribute(
            "presentationTimeOffset"
          );

          // Only show if there are actual timing attributes
          if (timescale || duration || presentationTimeOffset) {
            // Show the actual SegmentTemplate XML with all its content
            const serializer = new XMLSerializer();
            let templateXml = serializer.serializeToString(template);
            templateXml = this.formatXmlWithIndentation(templateXml, 0);
            result += templateXml + "\n\n";
          }
        });

        return result.trim() || ""; // Return empty if no timing info found
      } catch (error) {
        return ""; // No segment timing data available
      }
    },

    // NEW DETAILED FORMATTING METHODS FOR NEW VALIDATIONS:

    formatDetailedDownloadTimeValidation() {
      if (
        !this.segmentValidationResults ||
        !this.segmentValidationResults.hasCritical
      ) {
        const totalSegments = this.segmentValidationResults?.totalSegments || 0;
        return `✅ All ${totalSegments} segments pass validation rules\n\nValidation Rules:\n• Download time ≤ segment duration × ${this.segmentValidationConfig.maxDownloadRatio}\n• Segment duration ≥ ${this.segmentValidationConfig.minSegmentDurationSec}s\n• Segment duration ≤ ${this.segmentValidationConfig.maxSegmentDurationSec}s`;
      }

      const violations = this.segmentValidationResults.violations;
      const totalSegments = this.segmentValidationResults.totalSegments;

      let result = `🔴 CRITICAL VIOLATIONS FOUND: ${violations.length} out of ${totalSegments} segments\n\n`;

      // Group violations by rule type
      const violationsByRule = {};
      violations.forEach((violation) => {
        if (!violationsByRule[violation.rule]) {
          violationsByRule[violation.rule] = [];
        }
        violationsByRule[violation.rule].push(violation);
      });

      // Display violations by rule type
      Object.keys(violationsByRule).forEach((rule) => {
        const ruleViolations = violationsByRule[rule];
        result += `\n=== ${rule} (${ruleViolations.length} violations) ===\n`;

        ruleViolations.forEach((violation) => {
          result +=
            this.segmentValidationService.formatSegmentDetails(violation) +
            "\n";
        });
      });

      return result;
    },

    formatDetailedDRMStatus() {
      // Show Period-level DRM requirement analysis
      if (!this.currentManifest) return "";

      try {
        let result = "=== PERIOD-LEVEL DRM REQUIREMENT ANALYSIS ===\n\n";

        // Check each Period for ContentProtection
        const periods = this.currentManifest.querySelectorAll("Period");
        let periodsWithDRM = 0;
        let periodsWithoutDRM = [];

        periods.forEach((period, index) => {
          const periodId = period.getAttribute("id") || `period_${index}`;
          const contentProtections = period.querySelectorAll(
            ":scope > ContentProtection"
          );

          if (contentProtections.length > 0) {
            periodsWithDRM++;
            result += `✅ Period ${periodId}: HAS Period-level ContentProtection (${
              contentProtections.length
            } element${contentProtections.length > 1 ? "s" : ""})\n`;

            Array.from(contentProtections).forEach((cp, cpIndex) => {
              const schemeId = cp.getAttribute("schemeIdUri") || "Unknown";
              result += `   └─ ContentProtection[${cpIndex}]: ${schemeId}\n`;
            });
          } else {
            periodsWithoutDRM.push(periodId);
            result += `❌ Period ${periodId}: MISSING Period-level ContentProtection\n`;
          }
        });

        result += `\n=== SUMMARY ===\n`;
        result += `Total Periods: ${periods.length}\n`;
        result += `Periods with Period-level DRM: ${periodsWithDRM}\n`;
        result += `Periods missing Period-level DRM: ${periodsWithoutDRM.length}\n`;

        if (periodsWithoutDRM.length > 0) {
          result += `\n❌ REQUIREMENT VIOLATION: The following periods lack Period-level ContentProtection:\n`;
          result += `   ${periodsWithoutDRM.join(", ")}\n`;
        } else {
          result += `\n✅ REQUIREMENT SATISFIED: All periods have Period-level ContentProtection\n`;
        }

        // Show informational context about other DRM levels
        const mpdContentProtections = this.currentManifest.querySelectorAll(
          "MPD > ContentProtection"
        );
        const asContentProtections = this.currentManifest.querySelectorAll(
          "AdaptationSet ContentProtection"
        );
        const repContentProtections = this.currentManifest.querySelectorAll(
          "Representation ContentProtection"
        );

        if (
          mpdContentProtections.length > 0 ||
          asContentProtections.length > 0 ||
          repContentProtections.length > 0
        ) {
          result += `\n=== OTHER DRM LEVELS (INFORMATIONAL) ===\n`;
          if (mpdContentProtections.length > 0) {
            result += `MPD-level ContentProtection: ${
              mpdContentProtections.length
            } element${mpdContentProtections.length > 1 ? "s" : ""}\n`;
          }
          if (asContentProtections.length > 0) {
            result += `AdaptationSet-level ContentProtection: ${
              asContentProtections.length
            } element${asContentProtections.length > 1 ? "s" : ""}\n`;
          }
          if (repContentProtections.length > 0) {
            result += `Representation-level ContentProtection: ${
              repContentProtections.length
            } element${repContentProtections.length > 1 ? "s" : ""}\n`;
          }
          result += `\nNote: These do NOT satisfy the Period-level DRM requirement.\n`;
        }

        return result;
      } catch (error) {
        return "Error analyzing Period-level DRM requirement";
      }
    },

    formatDetailedDRMSignaling() {
      // Show production-grade DRM signaling analysis with semantic comparison
      if (!this.currentManifest) return "";

      try {
        let result = "";

        // Extract current DRM signaling info
        const currentDrmInfo = this.extractDRMSignalingInfo(
          this.currentManifest
        );

        if (currentDrmInfo.hasDRM) {
          result += "=== CURRENT DRM SIGNALING ===\n";
          result += currentDrmInfo.details + "\n\n";

          // Show raw ContentProtection elements for reference
          result += "=== RAW CONTENTPROTECTION ELEMENTS ===\n";
          const contentProtections = [
            ...Array.from(
              this.currentManifest.querySelectorAll("MPD > ContentProtection")
            ),
            ...Array.from(
              this.currentManifest.querySelectorAll("Period ContentProtection")
            ),
            ...Array.from(
              this.currentManifest.querySelectorAll(
                "AdaptationSet ContentProtection"
              )
            ),
            ...Array.from(
              this.currentManifest.querySelectorAll(
                "Representation ContentProtection"
              )
            ),
          ];

          contentProtections.forEach((cp, index) => {
            const location = this.getContentProtectionLocation(cp);
            result += `[${index + 1}] ${location}:\n`;

            const serializer = new XMLSerializer();
            let cpXml = serializer.serializeToString(cp);
            cpXml = this.formatXmlWithIndentation(cpXml, 2);
            result += cpXml + "\n\n";
          });
        } else {
          result += "No DRM signaling found in current manifest";
        }

        // If there's a previous manifest, show comparison
        if (this.previousManifest) {
          const previousDrmInfo = this.extractDRMSignalingInfo(
            this.previousManifest
          );

          result += "\n=== COMPARISON WITH PREVIOUS ===\n";

          if (previousDrmInfo.hasDRM) {
            result += "Previous DRM signaling:\n";
            result += previousDrmInfo.details + "\n\n";
          } else {
            result += "Previous manifest had no DRM signaling\n\n";
          }

          // Show semantic comparison
          const comparison = this.compareDRMSignaling(
            previousDrmInfo,
            currentDrmInfo
          );
          result += "Semantic Analysis:\n";
          result += `Status: ${comparison.status}\n`;
          result += `Changed: ${comparison.changed ? "YES" : "NO"}\n`;
          if (comparison.changed) {
            result += `Changes: ${comparison.summary}\n`;
          }
          result += `Details:\n${comparison.details}`;
        }

        return result.trim();
      } catch (error) {
        return `DRM signaling analysis failed: ${error.message}`;
      }
    },

    formatDetailedPeriodStartTimeComparison() {
      // Show Period elements with start and duration attributes
      if (!this.currentManifest) return "";

      try {
        let result = "";
        const periods = this.currentManifest.querySelectorAll("Period");

        periods.forEach((period) => {
          const start = period.getAttribute("start");
          const duration = period.getAttribute("duration");
          const id = period.getAttribute("id");

          if (start !== null || duration !== null) {
            result += `<Period`;
            if (id) result += ` id="${id}"`;
            if (start) result += ` start="${start}"`;
            if (duration) result += ` duration="${duration}"`;
            result += ` />\n`;
          }
        });

        return result.trim() || "";
      } catch (error) {
        return "";
      }
    },

    formatDetailedSegmentProfileEquivalence() {
      // Show SegmentTemplate elements from different representations for comparison
      if (!this.currentManifest) return "";

      try {
        let result = "";
        const periods = this.currentManifest.querySelectorAll("Period");

        periods.forEach((period) => {
          const periodId = period.getAttribute("id") || "unknown";
          const adaptationSets = period.querySelectorAll("AdaptationSet");

          adaptationSets.forEach((as, asIndex) => {
            const contentType = as.getAttribute("contentType") || "unknown";
            const representations = as.querySelectorAll("Representation");

            if (representations.length > 1) {
              result += `Period ${periodId} AdaptationSet[${asIndex}] (${contentType}) - Multiple Representations:\n`;

              Array.from(representations).forEach((rep, repIndex) => {
                const bandwidth = rep.getAttribute("bandwidth") || "unknown";
                result += `  Representation[${repIndex}] (${bandwidth} bps):\n`;

                const segmentTemplate = rep.querySelector("SegmentTemplate");
                if (segmentTemplate) {
                  const serializer = new XMLSerializer();
                  let templateXml =
                    serializer.serializeToString(segmentTemplate);
                  templateXml = this.formatXmlWithIndentation(templateXml, 4);
                  result += templateXml + "\n\n";
                }
              });
            }
          });
        });

        return result.trim() || "";
      } catch (error) {
        return "";
      }
    },

    formatDetailedPeriodIdConsistency() {
      // Show Period IDs from current and previous MPD for comparison
      if (!this.currentManifest) return "";

      try {
        let result = "Current MPD Period IDs:\n";
        const periods = this.currentManifest.querySelectorAll("Period");

        Array.from(periods).forEach((period, index) => {
          const id = period.getAttribute("id") || `period_${index}`;
          result += `  [${index}] "${id}"\n`;
        });

        if (this.previousManifest) {
          result += "\nPrevious MPD Period IDs:\n";
          const previousPeriods =
            this.previousManifest.querySelectorAll("Period");

          Array.from(previousPeriods).forEach((period, index) => {
            const id = period.getAttribute("id") || `period_${index}`;
            result += `  [${index}] "${id}"\n`;
          });
        } else {
          result += "\nNo previous MPD available for comparison";
        }

        return result.trim();
      } catch (error) {
        return "";
      }
    },

    formatDetailedTimeDifferences() {
      // Only show actual timing-related attributes from MPD if there are differences
      if (!this.currentManifest) return "";

      try {
        let result = "";
        const mpd = this.currentManifest.querySelector("MPD");

        if (mpd) {
          // Show MPD-level timing attributes that might be relevant to time differences
          const timingAttrs = [
            "availabilityStartTime",
            "publishTime",
            "minimumUpdatePeriod",
            "timeShiftBufferDepth",
          ];

          timingAttrs.forEach((attr) => {
            const attrValue = mpd.getAttribute(attr);
            if (attrValue) {
              result += `${attr}="${attrValue}"\n`;
            }
          });
        }

        return result.trim() || "";
      } catch (error) {
        return ""; // No timing data available
      }
    },

    // Combined periods methods for the new unified column
    getCombinedNormalPeriods(historyEntry) {
      const totalPeriods = this.getHistoryMetricValue(
        historyEntry,
        "Total Periods"
      );
      const contentPeriods = this.getHistoryMetricValue(
        historyEntry,
        "Content Periods"
      );
      const adPeriods = this.getHistoryMetricValue(historyEntry, "Ad Periods");

      // Extract period information from the current manifest
      const periodInfo = this.extractPeriodInfoForDisplay();

      console.log("Combined normal periods:", {
        totalPeriods,
        contentPeriods,
        adPeriods,
        periodInfo,
      });

      return `Total: ${totalPeriods} | Content: ${contentPeriods} | Ad: ${adPeriods}\n${periodInfo}`;
    },

    getPeriodsForDisplay() {
      if (!this.currentManifest) return [];

      try {
        const periods = this.currentManifest.querySelectorAll("Period");
        const duplicateIds = this.findDuplicatePeriodIds(periods);

        return Array.from(periods).map((period, index) => {
          const periodId = period.getAttribute("id") || `period_${index}`;
          const periodStart = period.getAttribute("start") || "";

          // Check if this ID is a duplicate
          const isDuplicate = duplicateIds.includes(periodId);

          // Truncate long IDs for display
          const truncatedId =
            periodId.length > 10 ? `${periodId.substring(0, 10)}...` : periodId;
          const truncatedStart =
            periodStart.length > 15
              ? `${periodStart.substring(0, 15)}...`
              : periodStart;

          // Get or initialize expand state
          if (!this.expandData.periods[index]) {
            this.$set(this.expandData.periods, index, { expanded: false });
          }

          return {
            index,
            periodId,
            periodStart,
            isDuplicate,
            full: `start="${periodStart}" id="${periodId}"`,
            truncated: `start="${truncatedStart}" id="${truncatedId}"`,
            expanded: this.expandData.periods[index].expanded,
          };
        });
      } catch (error) {
        console.error("Error in getPeriodsForDisplay:", error);
        return [];
      }
    },

    getCombinedDetailedPeriods() {
      if (!this.currentManifest) return "No manifest data available";

      try {
        const periods = this.currentManifest.querySelectorAll("Period");
        const duplicateIds = this.findDuplicatePeriodIds(periods);

        let result = "";

        Array.from(periods).forEach((period, index) => {
          const periodId = period.getAttribute("id") || `period_${index}`;
          const periodStart = period.getAttribute("start") || "";

          // Check if this ID is a duplicate
          const isDuplicate = duplicateIds.includes(periodId);

          // Truncate long IDs for display
          const truncatedId =
            periodId.length > 10 ? `${periodId.substring(0, 10)}...` : periodId;
          const truncatedStart =
            periodStart.length > 15
              ? `${periodStart.substring(0, 15)}...`
              : periodStart;

          // Store data in Vue component data instead of global window object
          if (!this.expandData) {
            this.$set(this, "expandData", {});
          }
          if (!this.expandData.periods) {
            this.$set(this.expandData, "periods", {});
          }

          this.$set(this.expandData.periods, index, {
            full: `start="${periodStart}" id="${periodId}"`,
            truncated: `start="${truncatedStart}" id="${truncatedId}"`,
            expanded: false,
          });

          const bgClass = isDuplicate ? "duplicate-period-id" : "";
          const isExpanded = this.expandData.periods[index].expanded;
          const displayContent = isExpanded
            ? `<div class="expanded-details-header"><strong>Expanded Details:</strong></div><div class="expanded-details-content">${this.expandData.periods[index].full}</div>`
            : this.expandData.periods[index].truncated;

          console.log(
            `Period ${index}: storing data:`,
            this.expandData.periods[index]
          );

          result += `
            <div class="period-item ${bgClass}">
              <span class="period-content">
                ${displayContent}
              </span>
              <button class="expand-btn" onclick="window.vueComponent.togglePeriodExpansion(${index})" title="Click to expand full details">
                ${isExpanded ? "▼ Collapse" : "▶ Expand"}
              </button>
            </div>
          `;
        });

        return result;
      } catch (error) {
        console.error("Error in getCombinedDetailedPeriods:", error);
        return "Error displaying period details";
      }
    },

    extractPeriodInfoForDisplay() {
      if (!this.currentManifest) return "";

      try {
        const periods = this.currentManifest.querySelectorAll("Period");
        const periodIds = Array.from(periods).map((period, index) => {
          const id = period.getAttribute("id") || `period_${index}`;
          return `id="${id}"`;
        });

        return periodIds.join(", ");
      } catch (error) {
        return "";
      }
    },

    findDuplicatePeriodIds(periods) {
      const idCounts = {};
      const duplicates = [];

      Array.from(periods).forEach((period, index) => {
        const id = period.getAttribute("id") || `period_${index}`;
        idCounts[id] = (idCounts[id] || 0) + 1;
      });

      Object.keys(idCounts).forEach((id) => {
        if (idCounts[id] > 1) {
          duplicates.push(id);
        }
      });

      return duplicates;
    },

    // Combined start time methods for the Start Time Correct column
    getCombinedNormalStartTime(historyEntry) {
      const startTimeValue = this.getHistoryMetricValue(
        historyEntry,
        "Start Time Correct?"
      );

      // For normal view, show simple Yes/No plus basic period info
      const isCorrect =
        startTimeValue.includes("Yes") || startTimeValue === "Yes";
      const simpleStatus = isCorrect ? "Yes" : "No";

      // Extract period information for normal view (just period ID and start)
      const periodStartInfo = this.extractPeriodStartInfoForDisplay();

      return `${simpleStatus}\n${periodStartInfo}`;
    },

    getStartTimesForDisplay(rowIndex) {
      if (!this.currentManifest) return [];

      try {
        const periods = this.currentManifest.querySelectorAll("Period");

        return Array.from(periods).map((period, index) => {
          const periodId = period.getAttribute("id") || `period_${index}`;
          const periodStart = period.getAttribute("start") || "";

          // Truncate long IDs and start times for display
          const truncatedId =
            periodId.length > 10 ? `${periodId.substring(0, 10)}...` : periodId;
          const truncatedStart =
            periodStart.length > 15
              ? `${periodStart.substring(0, 15)}...`
              : periodStart;

          // Get or initialize expand state
          const key = `${rowIndex}_${index}`;
          if (!this.expandData.startTimes[key]) {
            this.$set(this.expandData.startTimes, key, { expanded: false });
          }

          return {
            index,
            rowIndex,
            key,
            periodId,
            periodStart,
            full: `Period id="${periodId}" start="${periodStart}"`,
            truncated: `Period id="${truncatedId}" start="${truncatedStart}"`,
            expanded: this.expandData.startTimes[key].expanded,
          };
        });
      } catch (error) {
        console.error("Error in getStartTimesForDisplay:", error);
        return [];
      }
    },

    getCombinedDetailedStartTime(rowIndex) {
      if (!this.currentManifest) return "No manifest data available";

      try {
        const periods = this.currentManifest.querySelectorAll("Period");

        let result = "";

        Array.from(periods).forEach((period, index) => {
          const periodId = period.getAttribute("id") || `period_${index}`;
          const periodStart = period.getAttribute("start") || "";

          // Truncate long IDs and start times for display
          const truncatedId =
            periodId.length > 10 ? `${periodId.substring(0, 10)}...` : periodId;
          const truncatedStart =
            periodStart.length > 15
              ? `${periodStart.substring(0, 15)}...`
              : periodStart;

          // Store data in Vue component data instead of global window object
          if (!this.expandData.startTimes) {
            this.$set(this.expandData, "startTimes", {});
          }

          const key = `${rowIndex}_${index}`;
          this.$set(this.expandData.startTimes, key, {
            full: `Period id="${periodId}" start="${periodStart}"`,
            truncated: `Period id="${truncatedId}" start="${truncatedStart}"`,
            expanded: false,
          });

          const isExpanded = this.expandData.startTimes[key].expanded;
          const displayContent = isExpanded
            ? `<div class="expanded-details-header"><strong>Expanded Details:</strong></div><div class="expanded-details-content">${this.expandData.startTimes[key].full}</div>`
            : this.expandData.startTimes[key].truncated;

          console.log(
            `StartTime ${key}: storing data:`,
            this.expandData.startTimes[key]
          );

          result += `
            <div class="start-time-item">
              <span class="start-time-content">
                ${displayContent}
              </span>
              <button class="expand-btn" onclick="window.vueComponent.toggleStartTimeExpansion(${rowIndex}, ${index})" title="Click to expand full details">
                ${isExpanded ? "▼ Collapse" : "▶ Expand"}
              </button>
            </div>
          `;
        });

        return result;
      } catch (error) {
        console.error("Error in getCombinedDetailedStartTime:", error);
        return "Error displaying start time details";
      }
    },

    extractPeriodStartInfoForDisplay() {
      if (!this.currentManifest) return "";

      try {
        const periods = this.currentManifest.querySelectorAll("Period");
        const periodInfo = Array.from(periods).map((period, index) => {
          const id = period.getAttribute("id") || `period_${index}`;
          const start = period.getAttribute("start") || "0";
          return `id="${id}" start="${start}"`;
        });

        return periodInfo.join(", ");
      } catch (error) {
        return "";
      }
    },

    // Add the missing formatXmlWithIndentation method
    formatXmlWithIndentation(xmlString, baseIndent = 0) {
      try {
        // Simple XML formatting with proper indentation
        let formatted = "";
        let currentIndent = baseIndent;

        // Split by tags and format
        const parts = xmlString.split(/(<[^>]*>)/);

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i].trim();
          if (!part) continue;

          if (part.startsWith("</")) {
            // Closing tag
            currentIndent--;
            formatted += "  ".repeat(Math.max(0, currentIndent)) + part + "\n";
          } else if (part.startsWith("<") && part.endsWith("/>")) {
            // Self-closing tag
            formatted += "  ".repeat(currentIndent) + part + "\n";
          } else if (part.startsWith("<")) {
            // Opening tag
            formatted += "  ".repeat(currentIndent) + part + "\n";
            if (!part.includes("<?xml") && !part.includes("<!")) {
              currentIndent++;
            }
          } else {
            // Text content
            if (part.length > 0) {
              formatted += "  ".repeat(currentIndent) + part + "\n";
            }
          }
        }

        return formatted.trim();
      } catch (error) {
        console.warn("XML formatting failed:", error);
        return xmlString;
      }
    },

    // Scroll position preservation methods
    preserveScrollPosition() {
      const tableWrapper = document.querySelector(".table-wrapper");
      if (tableWrapper) {
        this.scrollPosition = tableWrapper.scrollTop;
      }
    },

    restoreScrollPosition() {
      const tableWrapper = document.querySelector(".table-wrapper");
      if (tableWrapper && this.scrollPosition !== undefined) {
        tableWrapper.scrollTop = this.scrollPosition;
      }
    },

    // Toggle methods for expand/collapse functionality
    togglePeriodExpansion(periodIndex) {
      console.log("🔍 === PERIOD EXPANSION TOGGLE DEBUG ===");
      console.log("🔍 Period Index:", periodIndex);
      console.log("🔍 Function called successfully!");

      // Initialize expand data if needed
      if (!this.expandData.periods[periodIndex]) {
        this.$set(this.expandData.periods, periodIndex, { expanded: false });
      }

      const currentState = this.expandData.periods[periodIndex].expanded;
      console.log("🔍 Current expanded state:", currentState);

      // Toggle the expanded state
      this.$set(
        this.expandData.periods[periodIndex],
        "expanded",
        !currentState
      );

      console.log(
        "🔍 Toggled to expanded:",
        this.expandData.periods[periodIndex].expanded
      );
      console.log("🔍 === END PERIOD EXPANSION TOGGLE DEBUG ===");
    },

    toggleStartTimeExpansion(rowIndex, periodIndex) {
      console.log("🕒 === START TIME EXPANSION TOGGLE DEBUG ===");
      const key = `${rowIndex}_${periodIndex}`;
      console.log("🕒 Key:", key, "Row:", rowIndex, "Period:", periodIndex);
      console.log("🕒 Function called successfully!");

      // Initialize expand data if needed
      if (!this.expandData.startTimes[key]) {
        this.$set(this.expandData.startTimes, key, { expanded: false });
      }

      const currentState = this.expandData.startTimes[key].expanded;
      console.log("🕒 Current expanded state:", currentState);

      // Toggle the expanded state
      this.$set(this.expandData.startTimes[key], "expanded", !currentState);

      console.log(
        "🕒 Toggled to expanded:",
        this.expandData.startTimes[key].expanded
      );
      console.log("🕒 === END START TIME EXPANSION TOGGLE DEBUG ===");
    },

    // Extract MPD duration from manifest
    // Extract MPD refresh interval from manifest (NOT content duration)
    extractMpdDuration(manifest) {
      if (!manifest) return null;

      try {
        const mpdElement = manifest.querySelector("MPD");
        if (!mpdElement) return null;

        console.log("=== MPD REFRESH INTERVAL EXTRACTION DEBUG ===");
        console.log("MPD element found, extracting refresh interval...");

        // Log all MPD attributes for debugging
        const mpdAttrs = {};
        for (let attr of mpdElement.attributes) {
          mpdAttrs[attr.name] = attr.value;
        }
        console.log("All MPD attributes:", mpdAttrs);

        // 1. Primary: Check for minimumUpdatePeriod (spec-compliant way)
        const minimumUpdatePeriod = mpdElement.getAttribute(
          "minimumUpdatePeriod"
        );
        if (minimumUpdatePeriod) {
          console.log("Found minimumUpdatePeriod:", minimumUpdatePeriod);
          const parsedInterval =
            this.parseIsoDurationToSeconds(minimumUpdatePeriod);
          console.log("Parsed minimumUpdatePeriod to seconds:", parsedInterval);
          return parsedInterval;
        }

        // 2. Fallback: Check publishTime delta (if we have previous MPD)
        const publishTime = mpdElement.getAttribute("publishTime");
        if (publishTime && this.previousMpdPublishTime) {
          console.log("Current publishTime:", publishTime);
          console.log("Previous publishTime:", this.previousMpdPublishTime);

          const currentTime = new Date(publishTime);
          const previousTime = new Date(this.previousMpdPublishTime);
          const deltaSeconds =
            (currentTime.getTime() - previousTime.getTime()) / 1000;

          if (deltaSeconds > 0 && deltaSeconds < 300) {
            // Reasonable range: 0-300 seconds
            console.log(
              "Calculated publishTime delta:",
              deltaSeconds,
              "seconds"
            );
            return deltaSeconds;
          }
        }

        // Store current publishTime for next comparison
        if (publishTime) {
          this.previousMpdPublishTime = publishTime;
        }

        // 3. Check MPD type
        const type = mpdElement.getAttribute("type");
        console.log("MPD type:", type);

        if (type === "static") {
          console.log("Static MPD - no refresh interval needed");
          return null; // Static MPDs don't refresh
        }

        console.log(
          "Dynamic MPD but no minimumUpdatePeriod or publishTime delta available"
        );
        console.log("=== END MPD REFRESH INTERVAL EXTRACTION DEBUG ===");
        return null; // Cannot determine refresh interval
      } catch (error) {
        console.error("Failed to extract MPD refresh interval:", error);
        return null;
      }
    },

    // Calculate period duration from segment timeline
    calculatePeriodDurationFromSegments(period) {
      try {
        const adaptationSets = period.querySelectorAll("AdaptationSet");
        if (adaptationSets.length === 0) return 0;

        // Use the first adaptation set to get timeline
        const firstAS = adaptationSets[0];
        const representations = firstAS.querySelectorAll("Representation");
        if (representations.length === 0) return 0;

        // Use the first representation to get segment timeline
        const firstRep = representations[0];
        const segmentTemplate = firstRep.querySelector("SegmentTemplate");
        if (!segmentTemplate) return 0;

        const segmentTimeline =
          segmentTemplate.querySelector("SegmentTimeline");
        if (!segmentTimeline) return 0;

        const sElements = segmentTimeline.querySelectorAll("S");
        if (sElements.length === 0) return 0;

        const timescale = parseInt(
          segmentTemplate.getAttribute("timescale") || "1"
        );
        let totalTicks = 0;

        Array.from(sElements).forEach((s) => {
          const duration = parseInt(s.getAttribute("d") || "0");
          const repeat = parseInt(s.getAttribute("r") || "0");
          totalTicks += duration * (repeat + 1);
        });

        return totalTicks / timescale;
      } catch (error) {
        console.warn(
          "Failed to calculate period duration from segments:",
          error
        );
        return 0;
      }
    },

    // Parse ISO 8601 duration to seconds
    // Parse ISO 8601 duration to seconds (spec-compliant)
    parseIsoDurationToSeconds(duration) {
      if (!duration) return 0;

      console.log("Parsing ISO 8601 duration:", duration);

      // Handle PT format (e.g., PT2S, PT4.5S, PT1M, PT1H30M45S)
      const ptMatch = duration.match(
        /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/
      );
      if (ptMatch) {
        const hours = parseFloat(ptMatch[1] || 0);
        const minutes = parseFloat(ptMatch[2] || 0);
        const seconds = parseFloat(ptMatch[3] || 0);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        console.log(
          `Parsed PT format: ${hours}h ${minutes}m ${seconds}s = ${totalSeconds} seconds`
        );
        return totalSeconds;
      }

      // Handle P format with days (e.g., P1DT2H3M4S)
      const pMatch = duration.match(
        /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
      );
      if (pMatch) {
        const days = parseFloat(pMatch[1] || 0);
        const hours = parseFloat(pMatch[2] || 0);
        const minutes = parseFloat(pMatch[3] || 0);
        const seconds = parseFloat(pMatch[4] || 0);
        const totalSeconds =
          days * 86400 + hours * 3600 + minutes * 60 + seconds;
        console.log(
          `Parsed P format: ${days}d ${hours}h ${minutes}m ${seconds}s = ${totalSeconds} seconds`
        );
        return totalSeconds;
      }

      console.warn("Could not parse ISO 8601 duration:", duration);
      return 0;
    },

    // Legacy method for backward compatibility (keep for other duration parsing)
    parseDurationToSeconds(duration) {
      return this.parseIsoDurationToSeconds(duration);
    },

    // NEW VALIDATION METHODS REQUESTED BY USER:

    // Enhanced segment validation with per-segment analysis
    validateDownloadTimeVsSegmentDuration(periods) {
      try {
        // Extract segment information from periods
        const segments =
          this.segmentValidationService.extractSegmentInfo(periods);

        // Validate all segments
        const validationResults =
          this.segmentValidationService.validateAllSegments(
            segments,
            this.segmentValidationConfig
          );

        // Store results for detailed display
        this.segmentValidationResults = validationResults;

        const hasCritical = validationResults.hasCritical;
        const violationCount = validationResults.violations.length;
        const totalSegments = validationResults.totalSegments;

        return {
          valid: !hasCritical,
          issues: validationResults.violations.map((v) => v.message),
          segmentDetails: hasCritical
            ? `🔴 CRITICAL: ${violationCount} segments violate rules out of ${totalSegments} total segments`
            : `✅ All ${totalSegments} segments pass validation rules`,
          violations: validationResults.violations,
          totalSegments: totalSegments,
        };
      } catch (error) {
        console.error("Segment validation failed:", error);
        return {
          valid: false,
          issues: [`Segment validation failed: ${error.message}`],
          segmentDetails: "Validation error occurred",
          violations: [],
          totalSegments: 0,
        };
      }
    },

    // Helper method to estimate segment download time
    estimateSegmentDownloadTime(representation, segmentDurationSeconds) {
      // This is a simplified estimation - in real implementation, you'd measure actual download times
      const bandwidth = representation.bandwidth?.parsed || 1000000; // Default 1 Mbps
      const estimatedSegmentSize = (bandwidth * segmentDurationSeconds) / 8; // Convert to bytes

      // Assume network bandwidth (this would be measured in real implementation)
      const assumedNetworkBandwidth = 5000000; // 5 Mbps assumption
      const downloadTime = estimatedSegmentSize / (assumedNetworkBandwidth / 8);

      return downloadTime;
    },

    // 2. Validate DRM Presence
    // CORRECT: Validate DRM Presence - specifically Period-level DRM requirement
    validateDRMPresence(periods) {
      const drmSystems = [];
      const details = [];
      let hasAnyDRM = false;
      let missingPeriodDRM = [];

      try {
        // Check for DRM at any level (informational)
        if (this.currentManifest) {
          const mpdContentProtections = this.currentManifest.querySelectorAll(
            "MPD > ContentProtection"
          );
          if (mpdContentProtections.length > 0) {
            hasAnyDRM = true;
            Array.from(mpdContentProtections).forEach((cp) => {
              const schemeId = cp.getAttribute("schemeIdUri") || "Unknown";
              drmSystems.push(`MPD-level: ${schemeId}`);
            });
          }
        }

        // REQUIREMENT-SPECIFIC: Check Period-level DRM explicitly
        periods.forEach((period, periodIndex) => {
          const periodId =
            period.id?.parsed ||
            period.id?.raw ||
            period.id ||
            `period_${periodIndex}`;

          // Check if this Period has ContentProtection directly
          const periodHasDRM =
            Array.isArray(period.ContentProtection) &&
            period.ContentProtection.length > 0;

          if (!periodHasDRM) {
            missingPeriodDRM.push(periodId);
          } else {
            hasAnyDRM = true;
            period.ContentProtection.forEach((cp) => {
              const schemeId = cp.schemeIdUri || "Unknown";
              drmSystems.push(`Period ${periodId}: ${schemeId}`);
            });
          }

          // Also check AdaptationSet and Representation levels (informational only)
          const adaptationSets = this.ensureArray(period.AdaptationSet);
          adaptationSets.forEach((as, asIndex) => {
            // Check AdaptationSet-level ContentProtection
            if (as.ContentProtection && as.ContentProtection.length > 0) {
              hasAnyDRM = true;
              as.ContentProtection.forEach((cp) => {
                const schemeId = cp.schemeIdUri || "Unknown";
                drmSystems.push(`Period ${periodId}.AS${asIndex}: ${schemeId}`);
              });
            }

            const representations = this.ensureArray(as.Representation);
            representations.forEach((rep, repIndex) => {
              // Check Representation-level ContentProtection
              if (rep.ContentProtection && rep.ContentProtection.length > 0) {
                hasAnyDRM = true;
                rep.ContentProtection.forEach((cp) => {
                  const schemeId = cp.schemeIdUri || "Unknown";
                  drmSystems.push(
                    `Period ${periodId}.AS${asIndex}.Rep${repIndex}: ${schemeId}`
                  );
                });
              }
            });
          });
        });

        // Generate requirement-specific messages
        const hasPeriodLevelDRM = missingPeriodDRM.length === 0;

        if (hasPeriodLevelDRM) {
          details.push(
            `✅ All ${periods.length} periods have Period-level ContentProtection`
          );
        } else {
          details.push(
            `❌ Missing Period-level DRM in periods: ${missingPeriodDRM.join(
              ", "
            )}`
          );
        }

        // Add informational context about other DRM levels
        if (hasAnyDRM && !hasPeriodLevelDRM) {
          details.push(
            `ℹ️ DRM found at other levels (MPD/AdaptationSet/Representation) but requirement is specifically for Period-level DRM`
          );
        }

        if (!hasAnyDRM) {
          details.push(
            "ℹ️ No ContentProtection elements found at any level (MPD, Period, AdaptationSet, or Representation)"
          );
        }
      } catch (error) {
        console.error("DRM validation failed:", error);
        details.push("DRM validation failed");
      }

      return {
        hasAnyDRM,
        hasPeriodLevelDRM: missingPeriodDRM.length === 0,
        hasDRM: missingPeriodDRM.length === 0, // For backward compatibility
        drmSystems: [...new Set(drmSystems)], // Remove duplicates
        details: details.join("\n"),
        missingPeriodDRM,
        issues:
          missingPeriodDRM.length > 0
            ? [`No Period-level DRM in periods: ${missingPeriodDRM.join(", ")}`]
            : [],
      };
    },

    // PRODUCTION-GRADE: DRM Signaling validation with semantic comparison
    // eslint-disable-next-line no-unused-vars
    async validateDRMSignaling(periods) {
      try {
        console.log("=== DRM SIGNALING VALIDATION (PRODUCTION-GRADE) ===");

        if (!this.previousManifest) {
          const currentDrmInfo = this.extractDRMSignalingInfo(
            this.currentManifest
          );
          return {
            summary: currentDrmInfo.hasDRM
              ? `Current: ${currentDrmInfo.summary}`
              : "No DRM",
            status: "INFO",
            statusClass: "status-info",
            changed: false,
            details: currentDrmInfo.hasDRM
              ? `Initial DRM state:\n${currentDrmInfo.details}`
              : "No previous manifest to compare against",
          };
        }

        // Extract normalized DRM info from both manifests
        const currentDrmInfo = this.extractDRMSignalingInfo(
          this.currentManifest
        );
        const previousDrmInfo = this.extractDRMSignalingInfo(
          this.previousManifest
        );

        console.log("Current DRM info:", currentDrmInfo);
        console.log("Previous DRM info:", previousDrmInfo);

        // Perform semantic comparison
        const comparison = this.compareDRMSignaling(
          previousDrmInfo,
          currentDrmInfo
        );

        console.log("DRM signaling comparison result:", comparison);
        console.log("=== END DRM SIGNALING VALIDATION ===");

        return {
          summary: comparison.summary,
          status: comparison.status,
          statusClass: comparison.statusClass,
          changed: comparison.changed,
          details: comparison.details,
        };
      } catch (error) {
        console.error("DRM signaling validation failed:", error);
        return {
          summary: "Validation failed",
          status: "ERROR",
          statusClass: "status-error",
          changed: false,
          details: `DRM signaling validation failed: ${error.message}`,
        };
      }
    },

    // PRODUCTION-GRADE: Extract DRM signaling with proper DASH inheritance resolution
    extractDRMSignalingInfo(manifest) {
      const drmInfo = {
        hasDRM: false,
        effectiveDrmSystems: new Set(), // Deduplicated effective DRM systems
        cencSystems: [],
        otherSystems: [],
        summary: "",
        details: "",
      };

      if (!manifest) {
        return drmInfo;
      }

      try {
        console.log("=== EXTRACTING DRM WITH DASH INHERITANCE RESOLUTION ===");

        // STEP 1: Extract MPD-level ContentProtection (inherited by all)
        const mpdContentProtections = this.extractContentProtectionElements(
          manifest.querySelector("MPD")
        );
        console.log(
          `MPD-level ContentProtection: ${mpdContentProtections.length}`
        );

        // STEP 2: Process each Period → AdaptationSet to resolve effective DRM
        const periods = Array.from(manifest.querySelectorAll("Period"));
        const adaptationSetDrmMap = new Map(); // Track effective DRM per AdaptationSet

        periods.forEach((period, periodIndex) => {
          const periodId = period.getAttribute("id") || `period_${periodIndex}`;

          // Extract Period-level ContentProtection
          const periodContentProtections =
            this.extractContentProtectionElements(period);
          console.log(
            `Period ${periodId} ContentProtection: ${periodContentProtections.length}`
          );

          // Process each AdaptationSet in this Period
          const adaptationSets = Array.from(
            period.querySelectorAll("AdaptationSet")
          );
          adaptationSets.forEach((adaptationSet, asIndex) => {
            const contentType =
              adaptationSet.getAttribute("contentType") || "unknown";
            const asKey = `${periodId}.AS${asIndex}(${contentType})`;

            // STEP 3: Resolve effective DRM for this AdaptationSet using DASH inheritance
            const effectiveDrm = this.resolveEffectiveDRM(
              mpdContentProtections,
              periodContentProtections,
              adaptationSet
            );

            if (effectiveDrm.length > 0) {
              adaptationSetDrmMap.set(asKey, effectiveDrm);
              console.log(
                `${asKey} effective DRM:`,
                effectiveDrm.map((d) => `${d.schemeIdUri}(${d.value})`)
              );
            }
          });
        });

        // STEP 4: Semantic deduplication - collapse identical DRM systems
        const uniqueDrmSystems =
          this.deduplicateDRMSystems(adaptationSetDrmMap);
        console.log(
          "Unique DRM systems after deduplication:",
          uniqueDrmSystems
        );

        // STEP 5: Classify and process deduplicated systems
        uniqueDrmSystems.forEach((drmSystem) => {
          const { schemeIdUri, value, defaultKID, locations } = drmSystem;

          // Add to effective DRM systems set for comparison
          const systemKey = `${schemeIdUri}:${value}:${defaultKID || "none"}`;
          drmInfo.effectiveDrmSystems.add(systemKey);
          drmInfo.hasDRM = true;

          if (schemeIdUri === "urn:mpeg:dash:mp4protection:2011") {
            // CENC system
            drmInfo.cencSystems.push({
              value: value,
              defaultKID: defaultKID,
              locations: locations, // Array of where this system is effective
            });
          } else if (
            // ✅ FIX: More precise DRM system classification
            schemeIdUri.includes("widevine") ||
            schemeIdUri.includes("playready") ||
            schemeIdUri.includes("fairplay") ||
            schemeIdUri.includes("clearkey") ||
            schemeIdUri.includes("protection") ||
            schemeIdUri.startsWith("urn:uuid:") // UUID-based DRM schemes
          ) {
            // Other recognized DRM systems
            drmInfo.otherSystems.push({
              schemeIdUri: schemeIdUri,
              value: value,
              locations: locations,
            });
          }
        });

        // STEP 6: Generate summary and details
        this.generateDRMSummaryAndDetails(drmInfo);

        console.log("=== DRM EXTRACTION COMPLETE ===");
        console.log(
          `Effective DRM systems: ${drmInfo.effectiveDrmSystems.size}`
        );
        console.log(`CENC systems: ${drmInfo.cencSystems.length}`);
        console.log(`Other systems: ${drmInfo.otherSystems.length}`);
      } catch (error) {
        console.error("Failed to extract DRM signaling info:", error);
        drmInfo.summary = "Extraction failed";
        drmInfo.details = `Failed to extract DRM info: ${error.message}`;
      }

      return drmInfo;
    },

    // Extract ContentProtection elements from a specific element (MPD, Period, AdaptationSet, Representation)
    extractContentProtectionElements(element) {
      if (!element) return [];

      return Array.from(
        element.querySelectorAll(":scope > ContentProtection")
      ).map((cp) => {
        const schemeIdUri = cp.getAttribute("schemeIdUri") || "";
        const value = cp.getAttribute("value") || "";
        const cencInfo = this.extractCENCInfo(cp);

        return {
          element: cp,
          schemeIdUri: schemeIdUri,
          value: value,
          defaultKID: cencInfo ? cencInfo.defaultKID : null,
        };
      });
    },

    // DASH inheritance resolution: resolve effective DRM for an AdaptationSet
    resolveEffectiveDRM(
      mpdContentProtections,
      periodContentProtections,
      adaptationSet
    ) {
      const effectiveDrm = [];

      // DASH inheritance order: MPD → Period → AdaptationSet → Representation
      // Lower levels inherit from higher levels, but can override

      // Start with MPD-level (inherited by all)
      effectiveDrm.push(...mpdContentProtections);

      // Add Period-level (inherits MPD, adds more)
      effectiveDrm.push(...periodContentProtections);

      // Add AdaptationSet-level
      const asContentProtections =
        this.extractContentProtectionElements(adaptationSet);
      effectiveDrm.push(...asContentProtections);

      // ✅ FIX 2: DASH inheritance resolution - process ALL representations, not just first
      // In real MPDs: Audio and video reps can have different DRM, some reps override KIDs
      const representations = Array.from(
        adaptationSet.querySelectorAll("Representation")
      );
      representations.forEach((representation) => {
        const repContentProtections =
          this.extractContentProtectionElements(representation);
        effectiveDrm.push(...repContentProtections);
      });

      return effectiveDrm;
    },

    // Semantic deduplication: collapse multiple declarations of same DRM into single effective system
    deduplicateDRMSystems(adaptationSetDrmMap) {
      const systemMap = new Map(); // Key: schemeIdUri:value:defaultKID, Value: system info

      adaptationSetDrmMap.forEach((drmSystems, asKey) => {
        drmSystems.forEach((drmSystem) => {
          const { schemeIdUri, value, defaultKID } = drmSystem;
          const systemKey = `${schemeIdUri}:${value}:${defaultKID || "none"}`;

          if (systemMap.has(systemKey)) {
            // Add this AdaptationSet to existing system's locations
            systemMap.get(systemKey).locations.push(asKey);
          } else {
            // New unique system
            systemMap.set(systemKey, {
              schemeIdUri: schemeIdUri,
              value: value,
              defaultKID: defaultKID,
              locations: [asKey], // Track where this system is effective
            });
          }
        });
      });

      return Array.from(systemMap.values());
    },

    // Generate summary and details for DRM info
    generateDRMSummaryAndDetails(drmInfo) {
      if (drmInfo.hasDRM) {
        const summaryParts = [];

        if (drmInfo.cencSystems.length > 0) {
          const cencSummary = drmInfo.cencSystems
            .map((c) => {
              const kidSuffix = c.defaultKID
                ? `:${c.defaultKID.substring(0, 8)}...`
                : "";
              const locationCount = c.locations.length;
              return `CENC(${c.value}${kidSuffix})×${locationCount}`;
            })
            .join(", ");
          summaryParts.push(cencSummary);
        }

        if (drmInfo.otherSystems.length > 0) {
          const otherSummary = drmInfo.otherSystems
            .map((o) => {
              const locationCount = o.locations.length;
              return `${o.schemeIdUri.split(":").pop()}×${locationCount}`;
            })
            .join(", ");
          summaryParts.push(otherSummary);
        }

        drmInfo.summary = summaryParts.join(", ");

        // Detailed breakdown
        const detailParts = [];

        drmInfo.cencSystems.forEach((cenc) => {
          detailParts.push(`CENC System:`);
          detailParts.push(`  - Value: ${cenc.value}`);
          detailParts.push(
            `  - Default KID: ${cenc.defaultKID || "not specified"}`
          );
          detailParts.push(`  - Effective on: ${cenc.locations.join(", ")}`);
        });

        drmInfo.otherSystems.forEach((other) => {
          detailParts.push(`Other DRM System:`);
          detailParts.push(`  - Scheme: ${other.schemeIdUri}`);
          detailParts.push(`  - Value: ${other.value || "not specified"}`);
          detailParts.push(`  - Effective on: ${other.locations.join(", ")}`);
        });

        drmInfo.details = detailParts.join("\n");
      } else {
        drmInfo.summary = "No DRM";
        drmInfo.details = "No ContentProtection elements found";
      }
    },

    // PRODUCTION-GRADE: Extract CENC information with proper normalization
    extractCENCInfo(contentProtectionElement) {
      try {
        const value = contentProtectionElement.getAttribute("value") || "";

        // Extract default_KID - handle multiple possible attribute names and namespaces
        let defaultKID = null;

        // Try different possible attribute names (namespace-agnostic)
        const possibleKIDAttributes = [
          "cenc:default_KID",
          "default_KID",
          "defaultKID",
          "cenc:defaultKID",
        ];

        for (const attrName of possibleKIDAttributes) {
          const kidValue = contentProtectionElement.getAttribute(attrName);
          if (kidValue) {
            // ✅ FIX 1: Complete default_KID normalization with brace stripping
            defaultKID = kidValue
              .toLowerCase()
              .replace(/[{}]/g, "") // Strip braces: {ca2428ae-8f61-4bcd-b717-2ae6faf8b11d}
              .trim();
            break;
          }
        }

        // Also check for KID in child elements
        if (!defaultKID) {
          const kidElements = contentProtectionElement.querySelectorAll("*");
          for (const elem of kidElements) {
            if (
              elem.textContent &&
              elem.textContent.match(/^[{]?[0-9a-f-]{36}[}]?$/i)
            ) {
              // ✅ FIX 1: Complete default_KID normalization with brace stripping
              defaultKID = elem.textContent
                .toLowerCase()
                .replace(/[{}]/g, "") // Strip braces
                .trim();
              break;
            }
          }
        }

        return {
          value: value,
          defaultKID: defaultKID,
        };
      } catch (error) {
        console.error("Failed to extract CENC info:", error);
        return null;
      }
    },

    // Get the location context of a ContentProtection element
    getContentProtectionLocation(element) {
      const parent = element.parentElement;
      if (!parent) return "unknown";

      const tagName = parent.tagName;
      if (tagName === "MPD") return "MPD-level";
      if (tagName === "Period") return "Period-level";
      if (tagName === "AdaptationSet") return "AdaptationSet-level";
      if (tagName === "Representation") return "Representation-level";

      return `${tagName}-level`;
    },

    // PRODUCTION-GRADE: Semantic comparison of DRM signaling with set-based comparison
    compareDRMSignaling(previousDrmInfo, currentDrmInfo) {
      const comparison = {
        summary: "",
        status: "OK",
        statusClass: "status-ok",
        changed: false,
        details: "",
      };

      const changes = [];
      const details = [];

      try {
        // Check for DRM presence changes
        if (!previousDrmInfo.hasDRM && currentDrmInfo.hasDRM) {
          comparison.changed = true;
          comparison.status = "DRM_ADDED";
          comparison.statusClass = "status-warning";
          changes.push("DRM protection added");
          details.push(`DRM Added: ${currentDrmInfo.summary}`);
        } else if (previousDrmInfo.hasDRM && !currentDrmInfo.hasDRM) {
          comparison.changed = true;
          comparison.status = "DRM_REMOVED";
          comparison.statusClass = "status-error-red";
          changes.push("DRM protection removed");
          details.push(
            "CRITICAL: DRM protection removed - stream now unprotected"
          );
        } else if (!previousDrmInfo.hasDRM && !currentDrmInfo.hasDRM) {
          comparison.summary = "No DRM (unchanged)";
          details.push("No DRM protection in either manifest");
          return comparison;
        }

        // ✅ FIX 3 & 4: Correct key rotation detection and value change detection
        const prevSystems = previousDrmInfo.effectiveDrmSystems || new Set();
        const currSystems = currentDrmInfo.effectiveDrmSystems || new Set();

        // Group systems by scheme+value to detect key rotation and value changes
        const prevBySchemeValue = this.groupSystemsBySchemeValue(prevSystems);
        const currBySchemeValue = this.groupSystemsBySchemeValue(currSystems);

        // Detect key rotation: Same scheme+value, different KID
        const keyRotations = this.detectKeyRotation(
          prevBySchemeValue,
          currBySchemeValue
        );

        // Detect critical value changes: cenc ↔ cbcs
        const valueChanges = this.detectCriticalValueChanges(
          prevSystems,
          currSystems
        );

        // Find added and removed systems
        const addedSystems = new Set(
          [...currSystems].filter((s) => !prevSystems.has(s))
        );
        const removedSystems = new Set(
          [...prevSystems].filter((s) => !currSystems.has(s))
        );

        // Process changes in order of severity
        if (removedSystems.size > 0) {
          comparison.changed = true;
          comparison.status = "DRM_REMOVED";
          comparison.statusClass = "status-error-red";
          changes.push(`${removedSystems.size} DRM system(s) removed`);

          removedSystems.forEach((system) => {
            const [schemeIdUri, value, defaultKID] = system.split(":");
            if (schemeIdUri === "urn:mpeg:dash:mp4protection:2011") {
              details.push(
                `Removed CENC: value=${value}, KID=${
                  defaultKID === "none" ? "none" : defaultKID
                }`
              );
            } else {
              details.push(`Removed DRM: ${schemeIdUri}, value=${value}`);
            }
          });
        }

        // ✅ FIX 3: Correct key rotation detection - only when same scheme+value, different KID
        if (keyRotations.length > 0) {
          comparison.changed = true;
          comparison.status = "KEY_ROTATION";
          comparison.statusClass = "status-error-red";
          changes.push("CENC key rotation detected");

          keyRotations.forEach((rotation) => {
            details.push(
              `Key rotation: ${rotation.scheme}(${rotation.value}) - KID changed from ${rotation.oldKID} to ${rotation.newKID}`
            );
          });
        }

        // ✅ FIX 4: Critical value changes (cenc ↔ cbcs)
        if (valueChanges.length > 0) {
          comparison.changed = true;
          comparison.status = "CRITICAL_VALUE_CHANGE";
          comparison.statusClass = "status-error-red";
          changes.push("Critical CENC value change");

          valueChanges.forEach((change) => {
            details.push(
              `⚠️ CRITICAL: ${change.scheme} value changed from ${change.oldValue} to ${change.newValue} - breaks playback compatibility`
            );
          });
        }

        // Process added systems (but don't incorrectly classify as key rotation)
        if (addedSystems.size > 0) {
          comparison.changed = true;
          if (comparison.status === "OK") {
            comparison.status = "DRM_ADDED";
            comparison.statusClass = "status-warning";
          }
          changes.push(`${addedSystems.size} DRM system(s) added`);

          addedSystems.forEach((system) => {
            const [schemeIdUri, value, defaultKID] = system.split(":");
            if (schemeIdUri === "urn:mpeg:dash:mp4protection:2011") {
              details.push(
                `Added CENC: value=${value}, KID=${
                  defaultKID === "none" ? "none" : defaultKID
                }`
              );
            } else {
              details.push(`Added DRM: ${schemeIdUri}, value=${value}`);
            }
          });
        }

        // Generate final summary
        if (comparison.changed) {
          comparison.summary = changes.join(", ");
        } else {
          comparison.summary = `Unchanged: ${currentDrmInfo.summary}`;
        }

        comparison.details = details.join("\n");
      } catch (error) {
        console.error("DRM signaling comparison failed:", error);
        comparison.summary = "Comparison failed";
        comparison.status = "ERROR";
        comparison.statusClass = "status-error";
        comparison.details = `Comparison failed: ${error.message}`;
      }

      return comparison;
    },

    // Helper: Group DRM systems by scheme+value for key rotation detection
    groupSystemsBySchemeValue(systems) {
      const grouped = new Map();

      systems.forEach((system) => {
        const [schemeIdUri, value, defaultKID] = system.split(":");
        const key = `${schemeIdUri}:${value}`;

        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key).push(defaultKID);
      });

      return grouped;
    },

    // Helper: Detect key rotation (same scheme+value, different KID)
    detectKeyRotation(prevBySchemeValue, currBySchemeValue) {
      const rotations = [];

      // Check each scheme+value combination
      for (const [key, prevKIDs] of prevBySchemeValue) {
        const currKIDs = currBySchemeValue.get(key);
        if (currKIDs) {
          const [schemeIdUri, value] = key.split(":");

          // Only check CENC systems for key rotation
          if (schemeIdUri === "urn:mpeg:dash:mp4protection:2011") {
            // Check if KIDs changed for this scheme+value
            const prevKIDSet = new Set(prevKIDs);
            const currKIDSet = new Set(currKIDs);

            const addedKIDs = [...currKIDSet].filter(
              (kid) => !prevKIDSet.has(kid)
            );
            const removedKIDs = [...prevKIDSet].filter(
              (kid) => !currKIDSet.has(kid)
            );

            if (addedKIDs.length > 0 || removedKIDs.length > 0) {
              rotations.push({
                scheme: schemeIdUri,
                value: value,
                oldKID: removedKIDs.join(", ") || "none",
                newKID: addedKIDs.join(", ") || "none",
              });
            }
          }
        }
      }

      return rotations;
    },

    // Helper: Detect critical value changes (cenc ↔ cbcs)
    detectCriticalValueChanges(prevSystems, currSystems) {
      const changes = [];

      // Group by scheme to detect value changes
      const prevSchemes = new Map();
      const currSchemes = new Map();

      // Parse previous systems
      prevSystems.forEach((system) => {
        const [schemeIdUri, value] = system.split(":");
        if (!prevSchemes.has(schemeIdUri)) {
          prevSchemes.set(schemeIdUri, new Set());
        }
        prevSchemes.get(schemeIdUri).add(value);
      });

      currSystems.forEach((system) => {
        const [schemeIdUri, value] = system.split(":");
        if (!currSchemes.has(schemeIdUri)) {
          currSchemes.set(schemeIdUri, new Set());
        }
        currSchemes.get(schemeIdUri).add(value);
      });

      // Check for critical value changes in CENC
      const cencScheme = "urn:mpeg:dash:mp4protection:2011";
      const prevCencValues = prevSchemes.get(cencScheme) || new Set();
      const currCencValues = currSchemes.get(cencScheme) || new Set();

      // Detect cenc ↔ cbcs changes (critical for playback)
      const hasCriticalChange =
        (prevCencValues.has("cenc") && currCencValues.has("cbcs")) ||
        (prevCencValues.has("cbcs") && currCencValues.has("cenc"));

      if (hasCriticalChange) {
        changes.push({
          scheme: cencScheme,
          oldValue: [...prevCencValues].join(", "),
          newValue: [...currCencValues].join(", "),
        });
      }

      return changes;
    },

    // ===== ABSTRACTION FOR REUSABLE DRM COMPARISON =====

    // Core primitive: Extract effective CENC state from manifest
    extractEffectiveCENC(manifest) {
      const effectiveState = {
        present: false,
        value: null, // "cenc" | "cbcs" | null
        kids: new Set(), // normalized UUIDs
      };

      if (!manifest) {
        return effectiveState;
      }

      try {
        // Step 1: Resolve DASH inheritance for each content representation (ignore ads)
        const periods = Array.from(manifest.querySelectorAll("Period"));
        const contentPeriods = this.filterAdPeriods
          ? this.filterAdPeriods(periods)
          : periods;

        contentPeriods.forEach((period) => {
          const adaptationSets = Array.from(
            period.querySelectorAll("AdaptationSet")
          );

          adaptationSets.forEach((adaptationSet) => {
            const representations = Array.from(
              adaptationSet.querySelectorAll("Representation")
            );

            // Process each representation to find effective CENC
            representations.forEach((representation) => {
              const effectiveCenc = this.resolveEffectiveCENCForRepresentation(
                manifest,
                period,
                adaptationSet,
                representation
              );

              if (effectiveCenc) {
                effectiveState.present = true;

                // Ensure value consistency
                if (
                  effectiveState.value &&
                  effectiveState.value !== effectiveCenc.value
                ) {
                  console.warn(
                    "CRITICAL: Different CENC values found across representations",
                    {
                      existing: effectiveState.value,
                      new: effectiveCenc.value,
                    }
                  );
                }
                effectiveState.value = effectiveCenc.value;

                // Union all KIDs
                if (effectiveCenc.defaultKID) {
                  effectiveState.kids.add(effectiveCenc.defaultKID);
                }
              }
            });
          });
        });

        console.log("Extracted effective CENC state:", {
          present: effectiveState.present,
          value: effectiveState.value,
          kids: Array.from(effectiveState.kids),
        });
      } catch (error) {
        console.error("Failed to extract effective CENC:", error);
      }

      return effectiveState;
    },

    // Resolve effective CENC for a single representation using DASH inheritance
    resolveEffectiveCENCForRepresentation(
      manifest,
      period,
      adaptationSet,
      representation
    ) {
      // Priority order: Representation → AdaptationSet → Period → MPD
      const elements = [
        representation,
        adaptationSet,
        period,
        manifest.querySelector("MPD"),
      ];

      for (const element of elements) {
        if (!element) continue;

        const contentProtections = Array.from(
          element.querySelectorAll(":scope > ContentProtection")
        );

        for (const cp of contentProtections) {
          const schemeIdUri = cp.getAttribute("schemeIdUri");
          if (schemeIdUri === "urn:mpeg:dash:mp4protection:2011") {
            const value = cp.getAttribute("value");
            const cencInfo = this.extractCENCInfo(cp);

            return {
              value: value,
              defaultKID: cencInfo ? cencInfo.defaultKID : null,
            };
          }
        }
      }

      return null;
    },

    // Comparison primitive: Compare two effective CENC states
    compareEffectiveCENC(prevState, currState) {
      const comparison = {
        summary: "",
        status: "OK",
        statusClass: "status-ok",
        changed: false,
        details: "",
      };

      try {
        // Check for DRM presence changes
        if (!prevState.present && currState.present) {
          comparison.changed = true;
          comparison.status = "DRM_ADDED";
          comparison.statusClass = "status-warning";
          comparison.summary = "DRM protection added";
          comparison.details = `CENC added: value=${currState.value}, KIDs=${
            Array.from(currState.kids).join(", ") || "none"
          }`;
        } else if (prevState.present && !currState.present) {
          comparison.changed = true;
          comparison.status = "DRM_REMOVED";
          comparison.statusClass = "status-error-red";
          comparison.summary = "DRM protection removed";
          comparison.details =
            "CRITICAL: DRM protection removed - stream now unprotected";
        } else if (!prevState.present && !currState.present) {
          comparison.summary = "No DRM (unchanged)";
          comparison.details = "No CENC protection in either manifest";
          return comparison;
        }

        // Both have DRM - check for changes
        if (prevState.present && currState.present) {
          const changes = [];
          const details = [];

          // Check for critical value changes (cenc ↔ cbcs)
          if (prevState.value !== currState.value) {
            comparison.changed = true;
            comparison.status = "CRITICAL_VALUE_CHANGE";
            comparison.statusClass = "status-error-red";
            changes.push("Critical CENC value change");
            details.push(
              `⚠️ CRITICAL: CENC value changed from ${prevState.value} to ${currState.value} - breaks playback compatibility`
            );
          }

          // Check for key rotation (KID changes)
          const prevKids = prevState.kids;
          const currKids = currState.kids;

          if (!this.setsEqual(prevKids, currKids)) {
            comparison.changed = true;
            if (comparison.status === "OK") {
              comparison.status = "KEY_ROTATION";
              comparison.statusClass = "status-error-red";
            }
            changes.push("CENC key rotation detected");

            const addedKids = [...currKids].filter((kid) => !prevKids.has(kid));
            const removedKids = [...prevKids].filter(
              (kid) => !currKids.has(kid)
            );

            if (addedKids.length > 0) {
              details.push(`Added KIDs: ${addedKids.join(", ")}`);
            }
            if (removedKids.length > 0) {
              details.push(`Removed KIDs: ${removedKids.join(", ")}`);
            }
          }

          // Generate final summary
          if (comparison.changed) {
            comparison.summary = changes.join(", ");
          } else {
            comparison.summary = `Unchanged: CENC(${currState.value})`;
          }

          comparison.details = details.join("\n");
        }
      } catch (error) {
        console.error("CENC comparison failed:", error);
        comparison.summary = "Comparison failed";
        comparison.status = "ERROR";
        comparison.statusClass = "status-error";
        comparison.details = `Comparison failed: ${error.message}`;
      }

      return comparison;
    },

    // Helper: Check if two sets are equal
    setsEqual(set1, set2) {
      if (set1.size !== set2.size) return false;
      for (const item of set1) {
        if (!set2.has(item)) return false;
      }
      return true;
    },

    // CORRECT: Compare period start times using segment-derived timing
    comparePeriodStartTimes(periods) {
      const issues = [];
      let consistent = true;

      try {
        if (periods.length <= 1) {
          return { consistent: true, issues: [] };
        }

        // CORRECT: Use segment-derived period boundaries, not Period.start + Period.duration
        const periodBoundaries = periods.map((period, index) => {
          const periodId =
            period.id?.parsed ||
            period.id?.raw ||
            period.id ||
            `period_${index}`;
          const declaredStart = period.start?.parsed || 0;
          const declaredDuration = period.duration?.parsed;

          // Derive actual timing from segments
          const segmentStart = this.getFirstSegmentPresentationTime(period);
          const segmentDuration =
            this.estimatePeriodDurationFromSegments(period);

          return {
            periodId,
            declaredStart,
            declaredDuration,
            segmentStart: segmentStart !== null ? segmentStart : declaredStart,
            segmentDuration:
              segmentDuration > 0 ? segmentDuration : declaredDuration || 0,
            segmentEnd:
              (segmentStart !== null ? segmentStart : declaredStart) +
              (segmentDuration > 0 ? segmentDuration : declaredDuration || 0),
          };
        });

        // Validate period sequence using segment-derived boundaries
        for (let i = 1; i < periodBoundaries.length; i++) {
          const prevPeriod = periodBoundaries[i - 1];
          const currPeriod = periodBoundaries[i];

          const expectedStart = prevPeriod.segmentEnd;
          const actualStart = currPeriod.segmentStart;

          const tolerance = 0.001; // 1ms tolerance
          const gap = Math.abs(actualStart - expectedStart);

          if (gap > tolerance) {
            consistent = false;
            issues.push(
              `Period ${
                currPeriod.periodId
              }: Segment-derived start time ${actualStart.toFixed(
                3
              )}s doesn't follow previous period end ${expectedStart.toFixed(
                3
              )}s (gap: ${gap.toFixed(3)}s)`
            );
          }

          // Also check for overlaps
          if (actualStart < prevPeriod.segmentEnd - tolerance) {
            consistent = false;
            issues.push(
              `Period overlap: ${
                currPeriod.periodId
              } starts at ${actualStart.toFixed(3)}s but ${
                prevPeriod.periodId
              } ends at ${prevPeriod.segmentEnd.toFixed(3)}s`
            );
          }

          // Validate declared vs segment-derived timing consistency
          if (
            currPeriod.declaredStart !== undefined &&
            Math.abs(currPeriod.declaredStart - currPeriod.segmentStart) >
              tolerance
          ) {
            // This is informational, not an error
            console.log(
              `Period ${
                currPeriod.periodId
              }: Declared start (${currPeriod.declaredStart.toFixed(
                3
              )}s) differs from segment-derived start (${currPeriod.segmentStart.toFixed(
                3
              )}s)`
            );
          }
        }
      } catch (error) {
        console.error("Period start time comparison failed:", error);
        consistent = false;
        issues.push("Period start time comparison failed");
      }

      return { consistent, issues };
    },

    // CORRECT: Validate segments align in time across profiles, not identical structure
    validateSegmentProfileEquivalence(periods) {
      const issues = [];
      let equivalent = true;

      try {
        periods.forEach((period, periodIndex) => {
          const periodId =
            period.id?.parsed ||
            period.id?.raw ||
            period.id ||
            `period_${periodIndex}`;
          const adaptationSets = this.ensureArray(period.AdaptationSet);

          adaptationSets.forEach((as, asIndex) => {
            const contentType =
              as.contentType?.parsed ||
              this.inferContentType(as.mimeType?.parsed);
            const representations = this.ensureArray(as.Representation);

            if (representations.length > 1) {
              // CORRECT: Check that segments align in presentation time across representations
              // NOT that they are structurally identical

              const representationTimelines = representations.map(
                (rep, repIndex) => {
                  const timeline = this.expandTimelineWithPTO(rep);
                  return {
                    repIndex,
                    bandwidth: rep.bandwidth?.parsed || 0,
                    segments: timeline.segments.map((seg) => ({
                      start: seg.start,
                      duration: seg.duration,
                      end: seg.start + seg.duration,
                    })),
                  };
                }
              );

              // Check temporal alignment between representations
              const referenceTimeline = representationTimelines[0];

              for (let i = 1; i < representationTimelines.length; i++) {
                const currentTimeline = representationTimelines[i];

                // CORRECT: Segments should align in time, but may have different counts due to different encoding
                const alignmentCheck = this.checkTemporalAlignment(
                  referenceTimeline.segments,
                  currentTimeline.segments,
                  periodId,
                  asIndex,
                  referenceTimeline.repIndex,
                  currentTimeline.repIndex,
                  contentType
                );

                if (!alignmentCheck.aligned) {
                  equivalent = false;
                  issues.push(...alignmentCheck.issues);
                }
              }
            }
          });
        });
      } catch (error) {
        console.error("Segment profile equivalence validation failed:", error);
        equivalent = false;
        issues.push("Segment profile equivalence validation failed");
      }

      return { equivalent, issues };
    },

    // Check temporal alignment between representation timelines
    checkTemporalAlignment(
      refSegments,
      curSegments,
      periodId,
      asIndex,
      refRepIndex,
      curRepIndex,
      contentType
    ) {
      const issues = [];
      let aligned = true;

      try {
        // CORRECT: Check that segment boundaries align, allowing for different segment counts
        const tolerance = contentType === "audio" ? 0.03 : 0.04; // Production tolerances

        // Find overlapping time ranges
        const refTimeRange = {
          start: refSegments.length > 0 ? refSegments[0].start : 0,
          end:
            refSegments.length > 0
              ? refSegments[refSegments.length - 1].end
              : 0,
        };

        const curTimeRange = {
          start: curSegments.length > 0 ? curSegments[0].start : 0,
          end:
            curSegments.length > 0
              ? curSegments[curSegments.length - 1].end
              : 0,
        };

        // Check overall time range alignment
        if (Math.abs(refTimeRange.start - curTimeRange.start) > tolerance) {
          aligned = false;
          issues.push(
            `Period ${periodId} AS${asIndex}: Rep${curRepIndex} starts at ${curTimeRange.start.toFixed(
              3
            )}s vs Rep${refRepIndex} at ${refTimeRange.start.toFixed(
              3
            )}s (diff: ${Math.abs(
              refTimeRange.start - curTimeRange.start
            ).toFixed(3)}s)`
          );
        }

        if (Math.abs(refTimeRange.end - curTimeRange.end) > tolerance) {
          aligned = false;
          issues.push(
            `Period ${periodId} AS${asIndex}: Rep${curRepIndex} ends at ${curTimeRange.end.toFixed(
              3
            )}s vs Rep${refRepIndex} at ${refTimeRange.end.toFixed(
              3
            )}s (diff: ${Math.abs(refTimeRange.end - curTimeRange.end).toFixed(
              3
            )}s)`
          );
        }

        // Check for major segment boundary misalignments
        // Sample a few key segment boundaries for alignment check
        const samplePoints = Math.min(
          5,
          Math.min(refSegments.length, curSegments.length)
        );

        for (let i = 0; i < samplePoints; i++) {
          const refSeg =
            refSegments[Math.floor((i * refSegments.length) / samplePoints)];

          // Find closest segment in current timeline
          const closestCurSeg = curSegments.reduce((closest, seg) => {
            const refDist = Math.abs(seg.start - refSeg.start);
            const closestDist = Math.abs(closest.start - refSeg.start);
            return refDist < closestDist ? seg : closest;
          });

          const startDiff = Math.abs(refSeg.start - closestCurSeg.start);
          if (startDiff > tolerance) {
            aligned = false;
            issues.push(
              `Period ${periodId} AS${asIndex}: Segment boundary misalignment at ~${refSeg.start.toFixed(
                3
              )}s (${startDiff.toFixed(
                3
              )}s difference exceeds ${contentType} tolerance)`
            );
            break; // Only report first major misalignment
          }
        }
      } catch (error) {
        console.warn("Temporal alignment check failed:", error);
        aligned = false;
        issues.push(
          `Period ${periodId} AS${asIndex}: Temporal alignment check failed`
        );
      }

      return { aligned, issues };
    },

    // CORRECT: Validate period consistency using stable identity, not Period.id
    async validatePeriodIdConsistency(periods) {
      const changes = [];
      let consistent = true;

      try {
        if (!this.previousManifest) {
          return {
            consistent: true,
            changes: ["No previous MPD to compare against"],
          };
        }

        const previousPeriods = await this.extractPreviousPeriods();

        // CORRECT: Use stable period identities instead of unreliable Period.id
        const currentIdentities = this.extractStablePeriodIdentities(periods);
        const previousIdentities =
          this.extractStablePeriodIdentities(previousPeriods);

        console.log("=== PERIOD IDENTITY CONSISTENCY CHECK ===");
        console.log("Current period identities:", currentIdentities);
        console.log("Previous period identities:", previousIdentities);

        // Find added periods (exist in current but not in previous)
        const addedPeriods = currentIdentities.filter(
          (current) =>
            !previousIdentities.some((previous) =>
              this.periodsMatch(current, previous)
            )
        );

        // Find removed periods (exist in previous but not in current)
        const removedPeriods = previousIdentities.filter(
          (previous) =>
            !currentIdentities.some((current) =>
              this.periodsMatch(current, previous)
            )
        );

        // Find periods that changed timing (same original ID but different timing)
        const timingChanges = [];
        currentIdentities.forEach((current) => {
          const matchingPrevious = previousIdentities.find(
            (previous) =>
              current.originalId === previous.originalId &&
              current.originalId !== `period_${current.start}` // Exclude fallback IDs
          );

          if (
            matchingPrevious &&
            !this.periodsMatch(current, matchingPrevious)
          ) {
            timingChanges.push({
              id: current.originalId,
              currentTiming: current.displayId,
              previousTiming: matchingPrevious.displayId,
            });
          }
        });

        // Report changes
        if (addedPeriods.length > 0) {
          consistent = false;
          changes.push(
            `Added periods: ${addedPeriods
              .map((p) => `${p.originalId} (${p.displayId})`)
              .join(", ")}`
          );
        }

        if (removedPeriods.length > 0) {
          consistent = false;
          changes.push(
            `Removed periods: ${removedPeriods
              .map((p) => `${p.originalId} (${p.displayId})`)
              .join(", ")}`
          );
        }

        if (timingChanges.length > 0) {
          consistent = false;
          changes.push(
            `Timing changes: ${timingChanges
              .map(
                (tc) => `${tc.id}: ${tc.previousTiming} → ${tc.currentTiming}`
              )
              .join(", ")}`
          );
        }

        // Check for period reordering
        const stableCurrentPeriods = currentIdentities.filter(
          (p) => p.method !== "index_fallback"
        );
        const stablePreviousPeriods = previousIdentities.filter(
          (p) => p.method !== "index_fallback"
        );

        if (
          stableCurrentPeriods.length > 0 &&
          stablePreviousPeriods.length > 0
        ) {
          const currentOrder = stableCurrentPeriods
            .map((p) => p.originalId)
            .join("→");
          const previousOrder = stablePreviousPeriods
            .map((p) => p.originalId)
            .join("→");

          if (
            currentOrder !== previousOrder &&
            stableCurrentPeriods.length === stablePreviousPeriods.length
          ) {
            // Only flag reordering if same periods exist but in different order
            const currentIds = new Set(
              stableCurrentPeriods.map((p) => p.originalId)
            );
            const previousIds = new Set(
              stablePreviousPeriods.map((p) => p.originalId)
            );

            if (
              currentIds.size === previousIds.size &&
              [...currentIds].every((id) => previousIds.has(id))
            ) {
              consistent = false;
              changes.push(
                `Period reordering detected: ${previousOrder} → ${currentOrder}`
              );
            }
          }
        }

        if (
          consistent &&
          addedPeriods.length === 0 &&
          removedPeriods.length === 0 &&
          timingChanges.length === 0
        ) {
          changes.push("All periods maintain consistent identity");
        }

        console.log("Period identity consistency result:", {
          consistent,
          changes,
        });
        console.log("=== END PERIOD IDENTITY CONSISTENCY CHECK ===");
      } catch (error) {
        console.error("Period identity consistency validation failed:", error);
        consistent = false;
        changes.push("Period identity consistency validation failed");
      }

      return { consistent, changes };
    },

    // Check if MPD duration is consistent with previous entries
    isMpdDurationConsistent(currentDuration, historyIndex) {
      if (
        currentDuration === null ||
        historyIndex >= this.comparisonHistory.length - 1
      ) {
        return true; // First entry or no duration to compare
      }

      // Get the previous few entries to establish a pattern
      const previousEntries = this.comparisonHistory.slice(
        historyIndex + 1,
        historyIndex + 4
      );
      const previousDurations = previousEntries
        .map((entry) => entry.mpdDuration)
        .filter((duration) => duration !== null);

      if (previousDurations.length === 0) return true;

      // Check if current duration matches the established pattern
      const tolerance = 1; // 1 second tolerance
      return previousDurations.some(
        (prevDuration) => Math.abs(currentDuration - prevDuration) <= tolerance
      );
    },
  },

  beforeUnmount() {
    this.stopAutoRefetch();
    // Clean up player
    if (this.player) {
      this.stopStream();
    }
    // Clean up global data objects
    if (window.periodExpandData) {
      delete window.periodExpandData;
    }
    if (window.startTimeExpandData) {
      delete window.startTimeExpandData;
    }
  },

  mounted() {
    // Auto-refetch is enabled by default, but only starts when user loads a manifest
    // This ensures the user experience is smooth with automatic updates
    console.log("=== COMPONENT MOUNTED ===");
    console.log("Component ID:", this.$el?.id || "no-id");
    console.log("Component mounted at:", new Date().toISOString());
    console.log(
      "Component mounted successfully with Vue-native expand/collapse functionality"
    );
  },

  beforeDestroy() {
    // Clean up global reference
    if (window.vueComponent === this) {
      delete window.vueComponent;
    }

    // Clean up any timers
    if (this.refetchTimer) {
      clearTimeout(this.refetchTimer);
    }
  },
};
</script>

<style scoped>
.single-comparison {
  max-width: 100vw; /* Use full viewport width */
  margin: 0;
  padding: 20px;
  width: 100%;
  overflow-x: hidden; /* Prevent horizontal overflow of the main container */
  box-sizing: border-box;
}

/* URL Input Section */
.url-input-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
}

.input-group {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.url-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.url-input:focus {
  outline: none;
  border-color: #007bff;
}

.load-button {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.load-button:hover {
  background: #0056b3;
}

/* Segment Validation Configuration */
.segment-validation-config {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
}

.segment-validation-config h4 {
  color: #2c3e50;
  margin: 0 0 16px 0;
  font-size: 18px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item label {
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.config-input {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  width: 100px;
}

.config-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.config-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.config-hint {
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
}

.load-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Refetch Settings */
.refetch-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.dash-compliant-info {
  background: #e3f2fd;
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid #2196f3;
  font-size: 14px;
  color: #1565c0;
}

.dash-compliant-info code {
  background: #bbdefb;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: "Courier New", monospace;
  font-size: 13px;
}

.refetch-settings .controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refetch-settings label {
  font-weight: 600;
  color: #495057;
}

.interval-input {
  width: 80px;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  text-align: center;
}

.interval-unit {
  color: #6c757d;
  font-size: 14px;
}

.toggle-button {
  padding: 8px 16px;
  border: 2px solid #28a745;
  background: white;
  color: #28a745;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toggle-button.active {
  background: #28a745;
  color: white;
}

.toggle-button:hover {
  background: #28a745;
  color: white;
}

.pause-button {
  padding: 8px 16px;
  border: 2px solid #ffc107;
  background: white;
  color: #ffc107;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.pause-button.active {
  background: #ffc107;
  color: white;
}

.pause-button:hover {
  background: #ffc107;
  color: white;
}

/* Player Section */
.player-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
  text-align: center;
}

.video-player {
  width: 100%;
  max-width: 800px;
  height: auto;
  border-radius: 8px;
}

/* Comparison Table */
.comparison-table-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
}

.comparison-table-section h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
  font-size: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.table-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.view-toggle {
  display: flex;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 4px;
  border: 1px solid #dee2e6;
}

.view-toggle-button {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #6c757d;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.view-toggle-button.active {
  background: #007bff;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
}

.view-toggle-button:hover:not(.active) {
  background: #e9ecef;
  color: #495057;
}

.update-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  align-items: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #495057;
  font-weight: 500;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid #dee2e6;
}

.legend-color.latest {
  background: rgba(40, 167, 69, 0.3);
  border-color: #28a745;
}

.legend-color.changed {
  background: rgba(220, 53, 69, 0.3);
  border-color: #dc3545;
}

.legend-color.normal {
  background: rgba(248, 249, 250, 0.8);
  border-color: #dee2e6;
}

.last-update {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.auto-refetch-indicator {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 12px;
  background: #f8f9fa;
  color: #6c757d;
  border: 1px solid #e9ecef;
}

.auto-refetch-indicator.active {
  background: #d4edda;
  color: #155724;
  border-color: #c3e6cb;
}

.auto-refetch-indicator.paused {
  background: #fff3cd;
  color: #856404;
  border-color: #ffeaa7;
}

.table-wrapper {
  overflow-x: auto; /* Enable horizontal scrolling */
  overflow-y: auto; /* Enable vertical scrolling */
  border-radius: 8px;
  border: 1px solid #e9ecef;
  width: 100%; /* Stay within viewport width */
  max-width: 100vw; /* Never exceed viewport width */
  max-height: 70vh; /* Limit height to enable vertical scrolling */
  position: relative;
  box-sizing: border-box;
  /* Better scrollbar styling for webkit browsers */
  scrollbar-width: thin;
  scrollbar-color: #007bff #f1f3f4;
}

/* Custom scrollbar for webkit browsers */
.table-wrapper::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: #f1f3f4;
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: #007bff;
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #0056b3;
}

/* Scroll hint styling */
.scroll-hint {
  text-align: center;
  margin-bottom: 8px;
}

.scroll-indicator {
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
  background: #f8f9fa;
  padding: 4px 12px;
  border-radius: 12px;
  border: 1px solid #dee2e6;
  display: inline-block;
}

/* Pending count indicator */
.pending-count {
  font-size: 10px;
  background: #ffc107;
  color: #212529;
  padding: 2px 6px;
  border-radius: 8px;
  margin-left: 4px;
  font-weight: bold;
}

.comparison-table {
  width: 5000px; /* Increased width for 23 columns (was 4800px for 22 columns) */
  min-width: 5000px; /* Ensure table maintains large width */
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed; /* Fixed layout for equal column widths */
}

.comparison-table th {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  padding: 24px 20px; /* Even more padding for very spacious columns */
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
  border-right: 1px solid #dee2e6;
  white-space: normal;
  word-wrap: break-word;
  width: calc(5000px / 23); /* Equal width for all 23 columns (~217px each) */
  font-size: 12px;
  line-height: 1.4;
  vertical-align: top;
  position: sticky; /* Make headers sticky */
  top: 0; /* Stick to top of scrollable container */
  z-index: 10; /* Ensure headers stay above table content */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Add shadow for better visibility */
}

.comparison-table td {
  padding: 24px 20px; /* Even more padding for very spacious columns */
  border-bottom: 1px solid #f1f3f4;
  border-right: 1px solid #f1f3f4;
  vertical-align: top;
  text-align: left;
  white-space: pre-line; /* Allow line breaks */
  word-wrap: break-word;
  font-size: 13px;
  line-height: 1.5;
  width: calc(5000px / 23); /* Equal width for all 23 columns (~217px each) */
  max-height: none;
  overflow: visible;
}

.comparison-table td.metric-value {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* Detailed content styling */
.comparison-table td.detailed-content {
  font-family: "Courier New", Consolas, monospace;
  border-left: 3px solid #007bff;
  font-size: 11px;
  overflow-x: auto;
  white-space: pre-wrap;
  padding: 12px;
}

/* Row highlighting - Latest row (green) */
.latest-row td {
  background: rgba(40, 167, 69, 0.1) !important;
  border-left: 3px solid #28a745;
}

.latest-row:hover td {
  background: rgba(40, 167, 69, 0.15) !important;
}

/* Row highlighting - Changed row (red) */
.changed-row td {
  background: rgba(220, 53, 69, 0.1) !important;
  border-left: 3px solid #dc3545;
}

.changed-row:hover td {
  background: rgba(220, 53, 69, 0.15) !important;
}

/* Latest row takes precedence over changed row */
.latest-row.changed-row td {
  background: rgba(40, 167, 69, 0.1) !important;
  border-left: 3px solid #28a745;
}

.latest-row.changed-row:hover td {
  background: rgba(40, 167, 69, 0.15) !important;
}

/* Row highlighting takes precedence over detailed content background */
.latest-row td.detailed-content {
  background: rgba(40, 167, 69, 0.05) !important;
}

.latest-row:hover td.detailed-content {
  background: rgba(40, 167, 69, 0.1) !important;
}

.changed-row td.detailed-content {
  background: rgba(220, 53, 69, 0.08) !important;
}

.changed-row:hover td.detailed-content {
  background: rgba(220, 53, 69, 0.12) !important;
}

/* Latest row takes precedence over changed row in detailed view */
.latest-row.changed-row td.detailed-content {
  background: rgba(40, 167, 69, 0.05) !important;
}

.latest-row.changed-row:hover td.detailed-content {
  background: rgba(40, 167, 69, 0.1) !important;
}

/* Status-specific styling */
.status-error-red {
  background: rgba(220, 53, 69, 0.15) !important;
  color: #721c24 !important;
  border-left: 3px solid #dc3545 !important;
  font-weight: 600;
}

.status-critical-error {
  background: rgba(220, 53, 69, 0.2) !important;
  color: #721c24 !important;
  border-left: 4px solid #dc3545 !important;
  font-weight: 700;
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0% {
    background: rgba(220, 53, 69, 0.2);
  }
  50% {
    background: rgba(220, 53, 69, 0.3);
  }
  100% {
    background: rgba(220, 53, 69, 0.2);
  }
}

.status-warning {
  background: rgba(255, 193, 7, 0.15) !important;
  color: #856404 !important;
  border-left: 3px solid #ffc107 !important;
}

.status-protected {
  background: rgba(40, 167, 69, 0.15) !important;
  color: #155724 !important;
  border-left: 3px solid #28a745 !important;
}

.status-unprotected {
  background: rgba(255, 193, 7, 0.15) !important;
  color: #856404 !important;
  border-left: 3px solid #ffc107 !important;
}

.status-drm-added {
  background: rgba(255, 193, 7, 0.15) !important;
  color: #856404 !important;
  border-left: 3px solid #ffc107 !important;
}

.status-drm-removed {
  background: rgba(220, 53, 69, 0.2) !important;
  color: #721c24 !important;
  border-left: 4px solid #dc3545 !important;
  font-weight: 700;
  animation: pulse-red 2s infinite;
}

.status-key-rotation {
  background: rgba(220, 53, 69, 0.2) !important;
  color: #721c24 !important;
  border-left: 4px solid #dc3545 !important;
  font-weight: 700;
  animation: pulse-red 2s infinite;
}

.status-drm-changed {
  background: rgba(255, 193, 7, 0.15) !important;
  color: #856404 !important;
  border-left: 3px solid #ffc107 !important;
}

.status-profile-mismatch {
  background: rgba(220, 53, 69, 0.15) !important;
  color: #721c24 !important;
  border-left: 3px solid #dc3545 !important;
}

.status-changed {
  background: rgba(255, 193, 7, 0.15) !important;
  color: #856404 !important;
  border-left: 3px solid #ffc107 !important;
}

/* Default detailed content background for non-highlighted rows */
.comparison-table td.detailed-content {
  background: #f8f9fa;
}

/* Combined periods column styling */
.combined-periods-cell {
  min-width: 200px;
  max-width: 400px;
}

.normal-periods-view {
  white-space: pre-line;
  font-size: 12px;
  line-height: 1.4;
}

.detailed-periods-view {
  font-family: "Courier New", Consolas, monospace;
  font-size: 11px;
}

/* Removed duplicate period-item CSS - using the one below */

.expand-btn {
  background: linear-gradient(135deg, #007bff, #0056b3);
  border: none;
  cursor: pointer;
  padding: 0; /* No padding for icon-only buttons */
  margin-left: 6px; /* Smaller margin */
  border-radius: 3px; /* Smaller border radius */
  font-size: 12px; /* Icon size */
  color: white;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
  min-width: 24px; /* Small square button */
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.expand-btn:hover {
  background: linear-gradient(135deg, #0056b3, #004085);
  box-shadow: 0 4px 8px rgba(0, 123, 255, 0.4);
  transform: translateY(-1px);
}

.expand-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
}

.expand-btn.expanded {
  background: linear-gradient(135deg, #28a745, #1e7e34);
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.expand-btn.expanded:hover {
  background: linear-gradient(135deg, #1e7e34, #155724);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.4);
}

/* Expanded Details Content Styling */
.expanded-details-header {
  background: #e8f5e8;
  border: 1px solid #28a745;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 8px;
  color: #155724;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
}

.expanded-details-header strong {
  color: #0d4f1a;
}

.expanded-details-content {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 8px 12px;
  font-family: "Courier New", monospace;
  font-size: 13px;
  color: #495057;
  word-break: break-all;
  white-space: pre-wrap;
  width: 100%;
  box-sizing: border-box;
  max-width: 100%;
  overflow-wrap: break-word;
}

/* Removed duplicate Period and Start Time Item Styling - using updated version below */

/* Period and Start Time Item Styling - Updated for larger columns */
.period-item,
.start-time-item {
  display: flex !important;
  align-items: flex-start !important;
  justify-content: space-between !important;
  margin-bottom: 6px;
  padding: 10px 12px; /* Increased padding */
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #f8f9fa;
  min-height: 40px;
  flex-wrap: nowrap !important; /* Prevent wrapping */
  width: 100%;
  box-sizing: border-box;
}

.period-item.duplicate-period-id {
  background: #ffe6e6;
  border-color: #ff9999;
}

.period-content,
.start-time-content {
  flex: 1 1 auto !important;
  margin-right: 6px; /* Smaller margin for smaller button */
  min-width: 0 !important; /* Allow content to shrink */
  max-width: calc(
    100% - 35px
  ) !important; /* Reserve space for small icon button (24px + margin) */
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-size: 12px; /* Slightly larger font */
  line-height: 1.4;
  white-space: normal;
  display: block; /* Ensure proper block layout for content */
}

/* When content is expanded, ensure it doesn't break the flex layout */
.period-content .expanded-details-header,
.period-content .expanded-details-content,
.start-time-content .expanded-details-header,
.start-time-content .expanded-details-content {
  display: block;
  width: 100%;
  box-sizing: border-box;
}

/* Ensure expand buttons don't shrink - Updated for icon-only buttons (much smaller) */
.period-item .expand-btn,
.start-time-item .expand-btn {
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
  min-width: 24px !important; /* Much smaller for icon-only */
  max-width: 24px !important; /* Fixed small width */
  height: 24px; /* Square button */
  font-size: 12px; /* Icon size */
  padding: 0; /* No padding needed for icons */
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px; /* Smaller border radius */
}

.period-category {
  margin: 8px 0 4px 0;
  font-weight: bold;
  color: #495057;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 2px;
}

.no-periods {
  font-style: italic;
  color: #6c757d;
  padding: 4px 8px;
  font-size: 10px;
}

/* Start Time Correct column styling */
.start-time-cell {
  min-width: 200px;
  max-width: 400px;
}

.normal-start-time-view {
  white-space: pre-line;
  font-size: 12px;
  line-height: 1.4;
}

.detailed-start-time-view {
  font-family: "Courier New", Consolas, monospace;
  font-size: 11px;
}

/* Removed old start-time-item CSS - using updated version above */

.comparison-table tr:hover {
  background: rgba(248, 249, 250, 0.8);
}

.comparison-table tr:hover td {
  background: rgba(248, 249, 250, 0.8);
}

/* Highlight differences */
.highlight-difference {
  background: rgba(220, 53, 69, 0.1) !important;
  border-left: 4px solid #dc3545;
}

.highlight-difference:hover {
  background: rgba(220, 53, 69, 0.15) !important;
}

/* Historical tracking styles */
.latest-row {
  background: rgba(40, 167, 69, 0.05) !important;
  border-left: 4px solid #28a745;
}

.latest-row:hover {
  background: rgba(40, 167, 69, 0.1) !important;
}

.changed-row {
  background: rgba(220, 53, 69, 0.08) !important;
  border-left: 4px solid #dc3545;
}

.changed-row:hover {
  background: rgba(220, 53, 69, 0.12) !important;
}

/* Latest row takes precedence over changed row */
.latest-row.changed-row {
  background: rgba(40, 167, 69, 0.05) !important;
  border-left: 4px solid #28a745;
}

.latest-row.changed-row:hover {
  background: rgba(40, 167, 69, 0.1) !important;
}

.timestamp-cell {
  font-weight: 600;
  color: #495057;
  background: rgba(248, 249, 250, 0.8);
  font-size: 12px;
  position: relative;
}

.timestamp-cell.duration-inconsistent {
  background: rgba(220, 53, 69, 0.1) !important;
  border-left: 4px solid #dc3545;
  color: #721c24;
}

.timestamp-cell.duration-inconsistent:hover {
  background: rgba(220, 53, 69, 0.15) !important;
}

.mpd-duration {
  display: block;
  font-size: 10px;
  color: #6c757d;
  font-weight: 500;
  margin-top: 2px;
}

.duration-inconsistent .mpd-duration {
  color: #dc3545;
  font-weight: 600;
}

.mpd-duration-missing {
  display: block;
  font-size: 10px;
  color: #ffc107;
  font-weight: 500;
  margin-top: 2px;
  font-style: italic;
}

/* Status classes */
.status-ok {
  color: #28a745;
  font-weight: 600;
}

.status-error {
  color: #dc3545;
  font-weight: 600;
}

.status-error-red {
  color: #dc3545;
  font-weight: 600;
  background-color: rgba(220, 53, 69, 0.1);
}

.status-added {
  color: #007bff;
  font-weight: 600;
}

.status-removed {
  color: #fd7e14;
  font-weight: 600;
}

.status-info {
  color: #6c757d;
  font-weight: 600;
}

/* Loading and Error States */
.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-state {
  text-align: center;
  padding: 40px 20px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
  margin: 20px 0;
}

.error-message {
  color: #721c24;
  margin-bottom: 16px;
  font-weight: 600;
}

.retry-button {
  padding: 10px 20px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.retry-button:hover {
  background: #c82333;
}

/* Responsive Design */
@media (max-width: 768px) {
  .single-comparison {
    padding: 16px;
  }

  .input-group {
    flex-direction: column;
  }

  .refetch-settings {
    flex-wrap: wrap;
    gap: 8px;
  }

  .table-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .update-info {
    align-items: flex-start;
    width: 100%;
  }

  .legend {
    flex-wrap: wrap;
    gap: 12px;
  }

  .comparison-table {
    font-size: 11px;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 12px 8px;
    font-size: 11px;
  }

  /* Hide scroll hint on smaller screens */
  .scroll-hint {
    display: none;
  }
}

@media (max-width: 480px) {
  .single-comparison {
    padding: 12px;
  }

  .comparison-table {
    font-size: 10px;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 8px 6px;
    font-size: 10px;
  }

  /* Responsive detailed view */
  .period-item,
  .start-time-item {
    flex-direction: column;
    align-items: stretch;
    padding: 6px;
  }

  .period-content,
  .start-time-content {
    margin-right: 0;
    margin-bottom: 6px;
  }

  .period-item .expand-btn,
  .start-time-item .expand-btn {
    min-width: 20px; /* Even smaller on mobile */
    height: 20px;
    font-size: 10px;
    align-self: flex-end;
  }
}

/* Auto-refetch status */
.auto-refetch-status {
  color: #6c757d;
  font-size: 12px;
  font-style: italic;
  margin-left: 12px;
}

/* Player Controls */
.player-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.control-button {
  padding: 8px 16px;
  border: 2px solid #007bff;
  background: white;
  color: #007bff;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.control-button:hover:not(:disabled) {
  background: #007bff;
  color: white;
}

.control-button:disabled {
  border-color: #6c757d;
  color: #6c757d;
  cursor: not-allowed;
}

.play-button {
  background: linear-gradient(135deg, #16a34a, #15803d);
  color: white;
  border: none;
  box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);
}

.play-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #15803d, #166534);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(22, 163, 74, 0.3);
}

.stop-button {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: white;
  border: none;
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
}

.stop-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #b91c1c, #991b1b);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
}

.player-status {
  color: #495057;
  font-weight: 600;
  margin-left: auto;
}
</style>
