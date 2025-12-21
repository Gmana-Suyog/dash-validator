<template>
  <div class="container">
    <!-- Source Panel -->
    <VideoPanel
      ref="sourcePanel"
      title="Source Manifest"
      placeholder="Source DASH URL"
      panel-type="source"
      :url="sourceUrl"
      :manifest="sourceManifest"
      :mpd-info="sourceMpdInfo"
      :formatted-manifest="formatManifest(sourceManifest)"
      @update:url="sourceUrl = $event"
      @load-manifest="loadManifest('source')"
      @play-stream="playStream('source')"
      @stop-stream="stopStream('source')"
    />

    <!-- SSAI Panel -->
    <VideoPanel
      ref="ssaiPanel"
      title="SSAI Manifest"
      placeholder="SSAI DASH URL"
      panel-type="ssai"
      :url="ssaiUrl"
      :manifest="ssaiManifest"
      :mpd-info="ssaiMpdInfo"
      :formatted-manifest="formatManifest(ssaiManifest)"
      @update:url="ssaiUrl = $event"
      @load-manifest="loadManifest('ssai')"
      @play-stream="playStream('ssai')"
      @stop-stream="stopStream('ssai')"
    />

    <!-- Comparison Panel -->
    <ComparisonPanel
      :view-mode="viewMode"
      :comparison="comparison"
      :source-manifest="sourceManifest"
      :ssai-manifest="ssaiManifest"
      :source-segments="sourceSegments"
      :ssai-segments="ssaiSegments"
      :source-segments-loading="sourceSegmentsLoading"
      :ssai-segments-loading="ssaiSegmentsLoading"
      :has-players="!!(sourcePlayer && ssaiPlayer)"
      @update:view-mode="viewMode = $event"
      @clear-all-segments="clearAllSegments"
      @clear-segments="clearSegments"
    />
  </div>
</template>

<script>
import { useDashPlayer } from '../composables/useDashPlayer.js';
import VideoPanel from './VideoPanel.vue';
import ComparisonPanel from './ComparisonPanel.vue';

export default {
  name: 'DashPlay',
  components: {
    VideoPanel,
    ComparisonPanel
  },
  data() {
    // Initialize the composable
    this.dashPlayerComposable = useDashPlayer();
    
    // Return reactive data
    return {
      sourceUrl: this.dashPlayerComposable.sourceUrl,
      ssaiUrl: this.dashPlayerComposable.ssaiUrl,
      sourceManifest: this.dashPlayerComposable.sourceManifest,
      ssaiManifest: this.dashPlayerComposable.ssaiManifest,
      sourceMpdInfo: this.dashPlayerComposable.sourceMpdInfo,
      ssaiMpdInfo: this.dashPlayerComposable.ssaiMpdInfo,
      comparison: this.dashPlayerComposable.comparison,
      viewMode: this.dashPlayerComposable.viewMode,
      sourceSegments: this.dashPlayerComposable.sourceSegments,
      ssaiSegments: this.dashPlayerComposable.ssaiSegments,
      sourceSegmentsLoading: this.dashPlayerComposable.sourceSegmentsLoading,
      ssaiSegmentsLoading: this.dashPlayerComposable.ssaiSegmentsLoading,
      sourcePlayer: this.dashPlayerComposable.sourcePlayer,
      ssaiPlayer: this.dashPlayerComposable.ssaiPlayer
    };
  },
  methods: {
    loadManifest(type) {
      this.dashPlayerComposable.loadManifest(type);
    },
    playStream(type) {
      const videoElement = type === 'source' 
        ? this.$refs.sourcePanel?.$refs.videoElement
        : this.$refs.ssaiPanel?.$refs.videoElement;
      
      if (videoElement) {
        this.dashPlayerComposable.playStream(type, videoElement);
      }
    },
    stopStream(type) {
      this.dashPlayerComposable.stopStream(type);
    },
    clearSegments(type) {
      this.dashPlayerComposable.clearSegments(type);
    },
    clearAllSegments() {
      this.dashPlayerComposable.clearAllSegments();
    },
    formatManifest(xml) {
      return this.dashPlayerComposable.formatManifest(xml);
    }
  }
};
</script>

<style scoped>
.container {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  max-width: 100%;
  min-height: 100vh;
  background: #f8fafc;
}

/* Responsive breakpoints */
@media (max-width: 1200px) {
  .container {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 8px;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .container {
    padding: 4px;
    gap: 6px;
  }
}
</style>