import { ref } from 'vue';
import { DashPlayerService } from '../services/dashPlayerService.js';
import { ManifestService } from '../services/manifestService.js';
import { ManifestComparison } from '../services/manifestComparison.js';

export function useDashPlayer() {
  // Services (create once)
  const dashPlayerService = new DashPlayerService();
  const manifestService = new ManifestService();
  const manifestComparison = new ManifestComparison();

  // Reactive state
  const sourceUrl = ref('');
  const ssaiUrl = ref('');
  const sourceManifest = ref(null);
  const ssaiManifest = ref(null);
  const sourceMpdInfo = ref({});
  const ssaiMpdInfo = ref({});
  const comparison = ref([]);
  const viewMode = ref('manifest');

  // Segment state
  const sourceSegments = ref([]);
  const ssaiSegments = ref([]);
  const sourceSegmentsLoading = ref(false);
  const ssaiSegmentsLoading = ref(false);

  // Player references
  const sourcePlayer = ref(null);
  const ssaiPlayer = ref(null);

  // Methods
  const loadManifest = async (type) => {
    const url = type === 'source' ? sourceUrl.value : ssaiUrl.value;
    
    try {
      const xml = await manifestService.loadManifest(url);
      const mpdInfo = manifestService.extractMpdInfo(xml);

      if (type === 'source') {
        sourceManifest.value = xml;
        sourceMpdInfo.value = mpdInfo;
      } else {
        ssaiManifest.value = xml;
        ssaiMpdInfo.value = mpdInfo;
      }

      await compareManifests();
    } catch (error) {
      alert(`Failed to load ${type} manifest: ${error.message}`);
    }
  };

  const playStream = (type, videoElement) => {
    const url = type === 'source' ? sourceUrl.value : ssaiUrl.value;
    const manifest = type === 'source' ? sourceManifest.value : ssaiManifest.value;

    if (!url || !videoElement || !manifest) {
      alert(`Cannot play ${type}: ${!url ? 'No URL' : !videoElement ? 'No video element' : 'No manifest loaded'}`);
      return;
    }

    // Mute videos
    videoElement.muted = true;

    // Reset segments
    if (type === 'source') {
      sourceSegmentsLoading.value = true;
      sourceSegments.value = [];
    } else {
      ssaiSegmentsLoading.value = true;
      ssaiSegments.value = [];
    }

    const onSegmentLoaded = (segment) => {
      if (segment.error) {
        alert(`Error loading segment: ${segment.url}\nStatus: ${segment.status}\n${segment.error}`);
      }

      if (type === 'source') {
        sourceSegments.value.push(segment);
        sourceSegmentsLoading.value = false;
      } else {
        ssaiSegments.value.push(segment);
        ssaiSegmentsLoading.value = false;
      }
    };

    const onError = (errorMessage) => {
      alert(errorMessage);
      if (type === 'source') sourceSegmentsLoading.value = false;
      else ssaiSegmentsLoading.value = false;
    };

    const player = dashPlayerService.createPlayer(type, videoElement, url, onSegmentLoaded, onError);
    
    if (type === 'source') {
      sourcePlayer.value = player;
    } else {
      ssaiPlayer.value = player;
    }
  };

  const stopStream = (type) => {
    dashPlayerService.stopPlayer(type);
    
    if (type === 'source') {
      sourceSegments.value = [];
      sourceSegmentsLoading.value = false;
      sourcePlayer.value = null;
    } else {
      ssaiSegments.value = [];
      ssaiSegmentsLoading.value = false;
      ssaiPlayer.value = null;
    }
  };

  const clearSegments = (type) => {
    if (type === 'source') {
      sourceSegments.value = [];
      sourceSegmentsLoading.value = false;
    } else {
      ssaiSegments.value = [];
      ssaiSegmentsLoading.value = false;
    }
  };

  const clearAllSegments = () => {
    sourceSegments.value = [];
    ssaiSegments.value = [];
    sourceSegmentsLoading.value = false;
    ssaiSegmentsLoading.value = false;
  };

  const compareManifests = async () => {
    const differences = await manifestComparison.compareManifests(
      sourceManifest.value, 
      ssaiManifest.value
    );
    comparison.value = differences;
  };

  const formatManifest = (xml) => {
    return manifestService.formatManifest(xml);
  };

  return {
    // State
    sourceUrl,
    ssaiUrl,
    sourceManifest,
    ssaiManifest,
    sourceMpdInfo,
    ssaiMpdInfo,
    comparison,
    viewMode,
    sourceSegments,
    ssaiSegments,
    sourceSegmentsLoading,
    ssaiSegmentsLoading,
    sourcePlayer,
    ssaiPlayer,

    // Methods
    loadManifest,
    playStream,
    stopStream,
    clearSegments,
    clearAllSegments,
    formatManifest
  };
}