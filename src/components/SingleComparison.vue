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
        <label for="refetchInterval">Refetch Interval:</label>
        <input
          id="refetchInterval"
          v-model.number="refetchInterval"
          @change="updateRefetchInterval"
          type="number"
          min="1"
          max="60"
          class="interval-input"
        />
        <span class="interval-unit">seconds</span>
        <button
          @click="toggleAutoRefetch"
          :class="['toggle-button', { active: isAutoRefetch }]"
        >
          {{ isAutoRefetch ? "Stop Auto-Refetch" : "Start Auto-Refetch" }}
        </button>
        <span class="auto-refetch-status">
          {{
            isAutoRefetch
              ? "Auto-refetch enabled by default"
              : "Auto-refetch disabled"
          }}
        </span>
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
            :class="{ active: isAutoRefetch }"
          >
            {{
              isAutoRefetch
                ? "🔄 Auto-refreshing every " + refetchInterval + "s"
                : "⏸️ Auto-refresh paused"
            }}
          </span>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Total Periods</th>
              <th>Content Periods</th>
              <th>Ad Periods</th>
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
              <th>Profile</th>
              <th>Time Diff(s)</th>
              <th>Switch Profile</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(historyEntry, index) in comparisonHistory"
              :key="index"
              :class="{
                'latest-row': index === 0,
                'changed-row': hasRowChanges(
                  historyEntry,
                  comparisonHistory[index + 1]
                ),
              }"
            >
              <td class="metric-value timestamp-cell">
                {{ historyEntry.timestamp }}
              </td>
              <td class="metric-value">
                {{ getHistoryMetricValue(historyEntry, "Total Periods") }}
              </td>
              <td class="metric-value">
                {{ getHistoryMetricValue(historyEntry, "Content Periods") }}
              </td>
              <td class="metric-value">
                {{ getHistoryMetricValue(historyEntry, "Ad Periods") }}
              </td>
              <td
                class="metric-value"
                :title="
                  getHistoryMetricTooltip(
                    historyEntry,
                    'Number Period Added (provide Id)'
                  )
                "
              >
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Number Period Added (provide Id)"
                  )
                }}
              </td>
              <td
                class="metric-value"
                :title="
                  getHistoryMetricTooltip(
                    historyEntry,
                    'Number of Period Removed'
                  )
                "
              >
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Number of Period Removed"
                  )
                }}
              </td>
              <td class="metric-value">
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Number of Segments Removed"
                  )
                }}
              </td>
              <td class="metric-value">
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Number of Segments Added"
                  )
                }}
              </td>
              <td
                class="metric-value"
                :class="
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Profile same in all Periods'
                  )
                "
              >
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Profile same in all Periods"
                  )
                }}
              </td>
              <td
                class="metric-value"
                :class="
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Video and Audio Duration are Same'
                  )
                "
              >
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Video and Audio Duration are Same"
                  )
                }}
              </td>
              <td
                class="metric-value"
                :title="
                  getHistoryMetricTooltip(historyEntry, 'Start Time Correct?')
                "
                :class="
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Start Time Correct?'
                  )
                "
              >
                {{ getHistoryMetricValue(historyEntry, "Start Time Correct?") }}
              </td>
              <td class="metric-value">
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Period Segment Added (Video)"
                  )
                }}
              </td>
              <td class="metric-value">
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Period Segment Removed (Video)"
                  )
                }}
              </td>
              <td class="metric-value">
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Period Segment Added (Audio)"
                  )
                }}
              </td>
              <td class="metric-value">
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Period Segment Removed (AUDIO)"
                  )
                }}
              </td>
              <td
                class="metric-value"
                :class="
                  getHistoryMetricStatusClass(
                    historyEntry,
                    'Is Segment Timing Correct?'
                  )
                "
              >
                {{
                  getHistoryMetricValue(
                    historyEntry,
                    "Is Segment Timing Correct?"
                  )
                }}
              </td>
              <td class="metric-value">
                {{ getHistoryMetricValue(historyEntry, "Profile") }}
              </td>
              <td class="metric-value">
                {{ getHistoryMetricValue(historyEntry, "Time Diff(s)") }}
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

export default {
  name: "SingleComparison",
  data() {
    return {
      manifestUrl: "",
      refetchInterval: 3, // Default 3 seconds
      isAutoRefetch: true, // Auto-refetch enabled by default
      isLoading: false,
      error: null,

      // Manifest data
      currentManifest: null,
      previousManifest: null,

      // Comparison data
      comparisonData: [],
      comparisonHistory: [], // Store all historical data
      lastUpdateTime: "",

      // Global segment changes (derived from period-level analysis)
      globalSegmentChanges: null,

      // Timers
      refetchTimer: null,

      // Player
      player: null,
      playerStatus: "Ready to play",
      dashPlayerService: new DashPlayerService(),
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

        // Update comparison data
        this.comparisonData = analysis;
        this.lastUpdateTime = new Date().toLocaleTimeString();

        // Add to history with timestamp - keep ALL entries for the entire session
        this.comparisonHistory.unshift({
          timestamp: new Date().toLocaleTimeString(),
          data: [...analysis], // Create a copy of the analysis
        });
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
      const addedValue =
        addedPeriods.count > 0
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
        status: addedPeriods.count > 0 ? "ADDED" : "OK",
        statusClass: addedPeriods.count > 0 ? "status-added" : "status-ok",
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

      // 7. Profile same in all Periods - CORRECT: Validate segment equivalence across profiles
      const profileConsistency =
        this.validateSegmentEquivalenceAcrossProfiles(periods);
      analysis.push({
        metric: "Profile same in all Periods",
        value: profileConsistency.consistent ? "Yes" : "No",
        status: profileConsistency.consistent ? "OK" : "INCONSISTENT",
        statusClass: profileConsistency.consistent
          ? "status-ok"
          : "status-error-red",
        hasDifference: !profileConsistency.consistent,
      });

      // 8. Video and Audio Duration are Same - CORRECT: With proper PTO handling
      const durationConsistency =
        this.validateVideoAudioDurationConsistency(periods);
      const durationValue = durationConsistency.consistent
        ? "Yes"
        : `No (${durationConsistency.issues.join(", ")})`;
      analysis.push({
        metric: "Video and Audio Duration are Same",
        value: durationValue,
        status: durationConsistency.consistent ? "OK" : "MISMATCH",
        statusClass: durationConsistency.consistent
          ? "status-ok"
          : "status-error-red",
        hasDifference: !durationConsistency.consistent,
      });

      // 9. Start Time Correct? - Enhanced with Period continuity and absolute timing
      const startTimeValidation = this.validateStartTimes(periods);
      analysis.push({
        metric: "Start Time Correct?",
        value: startTimeValidation.correct
          ? "Yes"
          : startTimeValidation.issues.join(", "),
        status: startTimeValidation.correct ? "OK" : "INCORRECT",
        statusClass: startTimeValidation.correct ? "status-ok" : "status-error",
        hasDifference: !startTimeValidation.correct,
        tooltip: startTimeValidation.tooltip || "",
      });

      // 8-11. Period Segment Added/Removed (Video/Audio)
      const periodSegmentAnalysis = await this.analyzePeriodSegments(periods);
      analysis.push(...periodSegmentAnalysis);

      // 14. Is Segment Timing Correct? - Enhanced with timeline continuity validation
      const segmentTiming = this.validateSegmentTiming(periods);
      analysis.push({
        metric: "Is Segment Timing Correct?",
        value: segmentTiming.correct ? "Yes" : segmentTiming.issues.join(", "),
        status: segmentTiming.correct ? "OK" : "TIMING_ERROR",
        statusClass: segmentTiming.correct ? "status-ok" : "status-error",
        hasDifference: !segmentTiming.correct,
      });

      // NEW: Period ID Validation
      // 15. Profile (Leave blank for now)
      analysis.push({
        metric: "Profile",
        value: "",
        status: "INFO",
        statusClass: "status-info",
        hasDifference: false,
      });

      // 16. Time Diff(s)
      const timeDiff = await this.calculateTimeDifferences(periods);
      analysis.push({
        metric: "Time Diff(s)",
        value: timeDiff.summary,
        status: "INFO",
        statusClass: "status-info",
        hasDifference: false,
      });

      // 17. Switch Profile (Leave empty for now)
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
      if (!this.previousManifest) {
        // On first load, show current periods
        return {
          count: currentPeriods.length,
          ids: currentPeriods.map(
            (period, index) =>
              period.id?.parsed ||
              period.id?.raw ||
              period.id ||
              `period_${index}`
          ),
        };
      }

      // Extract previous periods for comparison
      const previousPeriods = await this.extractPreviousPeriods();

      console.log("=== DEBUG: Period Comparison ===");
      console.log("Current periods count:", currentPeriods.length);
      console.log("Previous periods count:", previousPeriods.length);
      console.log("Current periods structure:", currentPeriods);
      console.log("Previous periods structure:", previousPeriods);

      // Extract Period IDs for comparison
      const currentPeriodIds = currentPeriods.map((period, index) => {
        const idObject = period.id;
        const extractedId =
          idObject?.parsed || idObject?.raw || idObject || `period_${index}`;
        console.log(
          `Current period ${index}: id object =`,
          idObject,
          "extracted id =",
          extractedId
        );
        console.log(
          `Full ID length: ${extractedId.length}, Full ID: "${extractedId}"`
        );
        return extractedId;
      });

      const previousPeriodIds = previousPeriods.map((period, index) => {
        const idObject = period.id;
        const extractedId =
          idObject?.parsed || idObject?.raw || idObject || `period_${index}`;
        console.log(
          `Previous period ${index}: id object =`,
          idObject,
          "extracted id =",
          extractedId
        );
        console.log(
          `Full ID length: ${extractedId.length}, Full ID: "${extractedId}"`
        );
        return extractedId;
      });

      console.log("Current IDs array:", currentPeriodIds);
      console.log("Previous IDs array:", previousPeriodIds);

      // Find added period IDs
      const addedPeriodIds = currentPeriodIds.filter(
        (id) => !previousPeriodIds.includes(id)
      );

      console.log("Added IDs result:", addedPeriodIds);
      console.log("=== END DEBUG ===");

      return {
        count: addedPeriodIds.length,
        ids: addedPeriodIds,
      };
    },

    async getRemovedPeriods(currentPeriods) {
      if (!this.previousManifest) {
        return { count: 0, ids: [] };
      }

      const previousPeriods = await this.extractPreviousPeriods();

      // Extract Period IDs for comparison
      const currentPeriodIds = currentPeriods.map(
        (period, index) =>
          period.id?.parsed || period.id?.raw || period.id || `period_${index}`
      );

      const previousPeriodIds = previousPeriods.map(
        (period, index) =>
          period.id?.parsed || period.id?.raw || period.id || `period_${index}`
      );

      // Find removed period IDs
      const removedPeriodIds = previousPeriodIds.filter(
        (id) => !currentPeriodIds.includes(id)
      );

      return {
        count: removedPeriodIds.length,
        ids: removedPeriodIds,
      };
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

    // CORRECT: Validate video/audio duration with proper PTO handling
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

        // Compare video and audio durations (ignore Period@duration - SegmentTimeline is authoritative)
        if (videoDuration !== null && audioDuration !== null) {
          const durationDiff = Math.abs(videoDuration - audioDuration);
          if (durationDiff > 0.1) {
            consistent = false;
            issues.push(
              `Period ${periodId}: Video/Audio duration mismatch (${videoDuration.toFixed(
                3
              )}s vs ${audioDuration.toFixed(3)}s)`
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

    checkProfileConsistency(periods) {
      const issues = [];
      let consistent = true;

      try {
        console.log("=== CHECKING PROFILE CONSISTENCY ===");

        // In DASH, profiles are typically defined at the MPD level, not Period level
        // But we need to check if all periods follow the same profile rules

        if (periods.length <= 1) {
          console.log(
            "Only one period found, profile consistency is automatically true"
          );
          return { consistent: true, issues: [] };
        }

        // Check key profile-related attributes across periods
        const periodProfiles = periods.map((period, index) => {
          const adaptationSets = this.ensureArray(period.AdaptationSet);

          // Collect profile-relevant information
          const profile = {
            periodIndex: index,
            periodId: period.id?.parsed || period.id?.raw || `period_${index}`,
            // Check if all AdaptationSets have consistent structure
            adaptationSetCount: adaptationSets.length,
            contentTypes: [],
            segmentAlignment: [],
            bitstreamSwitching: [],
          };

          adaptationSets.forEach((as) => {
            const contentType =
              as.contentType?.parsed ||
              this.inferContentType(as.mimeType?.parsed);
            profile.contentTypes.push(contentType);
            profile.segmentAlignment.push(as.segmentAlignment?.parsed);
            profile.bitstreamSwitching.push(as.bitstreamSwitching?.parsed);
          });

          // Sort arrays for consistent comparison
          profile.contentTypes.sort();

          console.log(`Period ${index} profile:`, profile);
          return profile;
        });

        // Compare profiles between periods
        const firstPeriod = periodProfiles[0];

        for (let i = 1; i < periodProfiles.length; i++) {
          const currentPeriod = periodProfiles[i];

          // Check adaptation set count consistency
          if (
            currentPeriod.adaptationSetCount !== firstPeriod.adaptationSetCount
          ) {
            consistent = false;
            issues.push(
              `Period ${i}: Different number of AdaptationSets (${currentPeriod.adaptationSetCount} vs ${firstPeriod.adaptationSetCount})`
            );
          }

          // Check content type consistency
          if (
            JSON.stringify(currentPeriod.contentTypes) !==
            JSON.stringify(firstPeriod.contentTypes)
          ) {
            consistent = false;
            issues.push(
              `Period ${i}: Different content types (${currentPeriod.contentTypes.join(
                ","
              )} vs ${firstPeriod.contentTypes.join(",")})`
            );
          }

          // Check segment alignment consistency
          if (
            JSON.stringify(currentPeriod.segmentAlignment) !==
            JSON.stringify(firstPeriod.segmentAlignment)
          ) {
            consistent = false;
            issues.push(`Period ${i}: Different segmentAlignment settings`);
          }
        }

        // Additional check: Verify that representation structures are similar
        // This ensures cross-period comparisons remain valid
        const representationStructures = periods
          .map((period, pIndex) => {
            const adaptationSets = this.ensureArray(period.AdaptationSet);
            return adaptationSets.map((as, asIndex) => {
              const representations = this.ensureArray(as.Representation);
              return {
                periodIndex: pIndex,
                asIndex: asIndex,
                contentType:
                  as.contentType?.parsed ||
                  this.inferContentType(as.mimeType?.parsed),
                representationCount: representations.length,
                // Check if representations have similar structure
                hasSegmentTemplate: representations.some(
                  (rep) => rep.SegmentTemplate
                ),
                hasSegmentList: representations.some((rep) => rep.SegmentList),
                hasBaseURL: representations.some((rep) => rep.BaseURL),
              };
            });
          })
          .flat();

        // Group by content type and adaptation set index
        const groupedStructures = {};
        representationStructures.forEach((struct) => {
          const key = `${struct.contentType}_AS${struct.asIndex}`;
          if (!groupedStructures[key]) {
            groupedStructures[key] = [];
          }
          groupedStructures[key].push(struct);
        });

        // Check consistency within each group
        Object.entries(groupedStructures).forEach(([key, structures]) => {
          if (structures.length > 1) {
            const first = structures[0];
            const inconsistent = structures.find(
              (s) =>
                s.representationCount !== first.representationCount ||
                s.hasSegmentTemplate !== first.hasSegmentTemplate ||
                s.hasSegmentList !== first.hasSegmentList ||
                s.hasBaseURL !== first.hasBaseURL
            );

            if (inconsistent) {
              consistent = false;
              issues.push(
                `${key}: Inconsistent representation structure between periods`
              );
            }
          }
        });

        console.log("Profile consistency result:", { consistent, issues });
        console.log("=== END PROFILE CONSISTENCY CHECK ===");
      } catch (error) {
        console.warn("Profile consistency check failed:", error);
        consistent = false;
        issues.push("Profile consistency check failed");
      }

      return { consistent, issues };
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

    validateStartTimes(periods) {
      const issues = [];
      let correct = true;
      let tooltip = "";

      try {
        let expectedStart = 0;
        let absolutePresentationTime = 0;

        periods.forEach((period, pIndex) => {
          const periodId =
            period.id?.parsed ||
            period.id?.raw ||
            period.id ||
            `period_${pIndex}`;
          const actualStart = period.start?.parsed || 0;
          const periodDuration = period.duration?.parsed || 0;

          // Validate Period.start continuity
          if (pIndex > 0 && Math.abs(actualStart - expectedStart) > 0.001) {
            correct = false;
            issues.push(
              `Period ${periodId}: Start time discontinuity - expected ${expectedStart.toFixed(
                3
              )}s, got ${actualStart.toFixed(3)}s`
            );
          }

          // Calculate absolute presentation time for this period
          const periodAbsoluteStart = absolutePresentationTime + actualStart;

          // Validate against segment timeline start times
          const adaptationSets = this.ensureArray(period.AdaptationSet);
          let timelineValidated = false;

          adaptationSets.forEach((as) => {
            if (timelineValidated) return; // Only validate once per period

            const representations = this.ensureArray(as.Representation);
            representations.forEach((rep) => {
              if (timelineValidated) return;

              if (rep.SegmentTemplate && rep.SegmentTemplate.SegmentTimeline) {
                const timescale = rep.SegmentTemplate.timescale?.parsed || 1;
                const pto =
                  rep.SegmentTemplate.presentationTimeOffset?.parsed || 0;
                const firstS = this.ensureArray(
                  rep.SegmentTemplate.SegmentTimeline.S
                )[0];

                if (firstS && firstS.t?.parsed !== undefined) {
                  // CORRECT absolute start calculation:
                  // absoluteSegmentStart = Period.start + (segment.t - presentationTimeOffset) / timescale
                  const segmentRelativeStart =
                    (firstS.t.parsed - pto) / timescale;
                  const absoluteSegmentStart =
                    actualStart + segmentRelativeStart;
                  const expectedAbsoluteStart = periodAbsoluteStart;

                  if (
                    Math.abs(absoluteSegmentStart - expectedAbsoluteStart) >
                    0.001
                  ) {
                    correct = false;
                    issues.push(
                      `Period ${periodId}: First segment absolute start (${absoluteSegmentStart.toFixed(
                        3
                      )}s) doesn't align with expected absolute start (${expectedAbsoluteStart.toFixed(
                        3
                      )}s) [Period.start=${actualStart.toFixed(
                        3
                      )}s, segment.t=${
                        firstS.t.parsed
                      }, PTO=${pto}, timescale=${timescale}]`
                    );
                  }
                  timelineValidated = true;
                }
              }
            });
          });

          // Update expected start for next period
          expectedStart = actualStart + periodDuration;
          absolutePresentationTime += periodDuration;

          // Build tooltip with detailed timing info
          tooltip += `Period ${periodId}: start=${actualStart.toFixed(
            3
          )}s, duration=${periodDuration.toFixed(
            3
          )}s, abs=${periodAbsoluteStart.toFixed(3)}s\\n`;
        });

        // Validate cross-period timing consistency
        if (periods.length > 1) {
          const totalExpectedDuration = periods.reduce((sum, period) => {
            return sum + (period.duration?.parsed || 0);
          }, 0);

          const lastPeriod = periods[periods.length - 1];
          const lastPeriodEnd =
            (lastPeriod.start?.parsed || 0) +
            (lastPeriod.duration?.parsed || 0);

          if (Math.abs(lastPeriodEnd - totalExpectedDuration) > 0.001) {
            correct = false;
            issues.push(
              `Cross-period timing error: Last period ends at ${lastPeriodEnd.toFixed(
                3
              )}s, expected ${totalExpectedDuration.toFixed(3)}s`
            );
          }
        }
      } catch (error) {
        console.warn("Start time validation failed:", error);
        correct = false;
        issues.push("Start time validation failed");
      }

      return { correct, issues, tooltip };
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

        // Build Period ID maps for proper comparison (not array index)
        const currentPeriodMap = new Map();
        periods.forEach((period) => {
          const periodId = period.id?.parsed || period.id?.raw || period.id;
          if (periodId) {
            currentPeriodMap.set(periodId, period);
          }
        });

        const previousPeriodMap = new Map();
        previousPeriods.forEach((period) => {
          const periodId = period.id?.parsed || period.id?.raw || period.id;
          if (periodId) {
            previousPeriodMap.set(periodId, period);
          }
        });

        // Compare periods by ID, not index
        currentPeriodMap.forEach((currentPeriod, periodId) => {
          const previousPeriod = previousPeriodMap.get(periodId);
          if (previousPeriod) {
            // Calculate time differences using the corrected approach
            const timeDiff = this.calculatePeriodTimeDifference(
              currentPeriod,
              previousPeriod
            );

            if (timeDiff.totalDiff > 0.001) {
              differences.push(`Period ${periodId}: ${timeDiff.summary}`);
              totalTimeDiff += timeDiff.totalDiff;
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

    startAutoRefetch() {
      this.stopAutoRefetch(); // Clear any existing timer

      this.refetchTimer = setInterval(async () => {
        if (this.manifestUrl) {
          try {
            await this.loadManifest();
          } catch (error) {
            console.error("Auto-refetch failed:", error);
          }
        }
      }, this.refetchInterval * 1000);
    },

    stopAutoRefetch() {
      if (this.refetchTimer) {
        clearInterval(this.refetchTimer);
        this.refetchTimer = null;
      }
    },

    updateRefetchInterval() {
      if (this.isAutoRefetch) {
        this.startAutoRefetch(); // Restart with new interval
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
  },

  beforeUnmount() {
    this.stopAutoRefetch();
    // Clean up player
    if (this.player) {
      this.stopStream();
    }
  },

  mounted() {
    // Auto-refetch is enabled by default, but only starts when user loads a manifest
    // This ensures the user experience is smooth with automatic updates
  },
};
</script>

<style scoped>
.single-comparison {
  max-width: 100vw; /* Use full viewport width */
  margin: 0;
  padding: 20px;
  width: 100%;
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

.load-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Refetch Settings */
.refetch-settings {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
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

.table-wrapper {
  overflow: auto;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  width: 100%;
  max-height: 70vh; /* Limit height to enable vertical scrolling */
  position: relative;
}

.comparison-table {
  width: 100%;
  min-width: 100%; /* Use full available width */
  border-collapse: collapse;
  font-size: 13px;
  table-layout: auto; /* Let table expand to full width */
}

.comparison-table th {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  padding: 16px 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
  border-right: 1px solid #dee2e6;
  white-space: normal;
  word-wrap: break-word;
  width: auto; /* Allow headers to expand based on content */
  min-width: calc(100% / 19); /* Minimum width distribution (19 columns now) */
  font-size: 12px;
  line-height: 1.4;
  vertical-align: top;
  position: sticky; /* Make headers sticky */
  top: 0; /* Stick to top of scrollable container */
  z-index: 10; /* Ensure headers stay above table content */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Add shadow for better visibility */
}

.comparison-table td {
  padding: 16px 12px;
  border-bottom: 1px solid #f1f3f4;
  border-right: 1px solid #f1f3f4;
  vertical-align: top;
  text-align: left;
  white-space: pre-line; /* Allow line breaks */
  word-wrap: break-word;
  font-size: 13px;
  line-height: 1.5;
  width: auto; /* Allow cells to expand based on content */
  min-width: calc(100% / 19); /* Minimum width distribution (19 columns now) */
  max-height: none;
  overflow: visible;
}

.comparison-table td.metric-value {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

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
