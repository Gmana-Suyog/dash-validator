<template>
  <div class="container">
    <!-- SOURCE Panel -->
    <div class="panel">
      <h2 class="panel-title">Source Manifest</h2>
      <input v-model="sourceUrl" @keyup.enter="loadManifest('source')" placeholder="Source DASH URL"
        class="input-field" />
      <button @click="loadManifest('source')" class="load-button">Load</button>
      <div class="button-group">
        <button @click="playStream('source')" class="play-button">▶ Play</button>
        <button @click="stopStream('source')" class="stop-button">■ Stop</button>
      </div>
      <video ref="sourceVideo" controls class="video-player"></video>
      <pre class="manifest-display">{{ formatManifest(sourceManifest) }}</pre>
    </div>

    <!-- SSAI Panel -->
    <div class="panel">
      <h2 class="panel-title">SSAI Manifest</h2>
      <input v-model="ssaiUrl" @keyup.enter="loadManifest('ssai')" placeholder="SSAI DASH URL" class="input-field" />
      <button @click="loadManifest('ssai')" class="load-button-ssai">Load</button>
      <div class="button-group">
        <button @click="playStream('ssai')" class="play-button">▶ Play</button>
        <button @click="stopStream('ssai')" class="stop-button">■ Stop</button>
      </div>
      <video ref="ssaiVideo" controls class="video-player"></video>
      <pre class="manifest-display">{{ formatManifest(ssaiManifest) }}</pre>
      <div class="segment-info">
        <h3>SSAI Segments (Network)</h3>
        <div v-if="ssaiSegmentsLoading">
          <p>Loading SSAI segments...</p>
        </div>
        <div v-else-if="ssaiSegments.length">
          <table class="segment-table">
            <thead>
              <tr>
                <th>Segment URL</th>
                <th>Status Code</th>
                <th>Method</th>
                <th>Type</th>
                <th>Time (ms)</th>
                <th>Error (if any)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(segment, index) in ssaiSegments" :key="index">
                <td>{{ segment.url }}</td>
                <td :class="segment.status === 200 || segment.status === 302 ? 'success-text' : 'error-text'">{{
                  segment.status }}</td>
                <td>{{ segment.method }}</td>
                <td>{{ segment.type }}</td>
                <td>{{ segment.time ? segment.time.toFixed(2) : '-' }}</td>
                <td>{{ segment.error || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else>
          <p class="placeholder-text">No segments loaded. Click Play to fetch segments.</p>
        </div>
      </div>
    </div>

    <!-- Comparison Panel -->
    <div class="comparison-panel">
      <h2 class="panel-title">Manifest Comparison</h2>
      <div class="radio-group">
        <label class="radio-label">
          <input type="radio" v-model="viewMode" value="manifest" checked />
          Manifest Comparison
        </label>
        <label class="radio-label">
          <input type="radio" v-model="viewMode" value="segments" />
          Segments
        </label>
      </div>
      <div v-if="viewMode === 'manifest' && (comparison.length || sourceManifest || ssaiManifest)">
        <table v-if="comparison.length" class="comparison-table">
          <thead>
            <tr>
              <th>Issue Type</th>
              <th>Tag/Segment</th>
              <th>Attribute</th>
              <th>Source Value</th>
              <th>SSAI Value</th>
              <th>How to Solve the Issue?</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in comparison" :key="index">
              <td>{{ item.type }}</td>
              <td>{{ item.tag }}</td>
              <td>{{ item.attribute || '' }}</td>
              <td>{{ item.sourceValue }}</td>
              <td>{{ item.ssaiValue }}</td>
              <td>{{ item.solution }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="placeholder-text">No differences found. Load both manifests to see differences and timing
          issues.</div>
      </div>
      <div v-else-if="viewMode === 'segments'" class="segment-comparison">
        <div class="segment-panel">
          <h3>Source Segments</h3>
          <div v-if="sourceSegmentsLoading">
            <p>Loading Source segments...</p>
          </div>
          <div v-else-if="sourceSegments.length">
            <table class="segment-table">
              <thead>
                <tr>
                  <th>Segment URL</th>
                  <th>Status Code</th>
                  <th>Method</th>
                  <th>Type</th>
                  <th>Time (ms)</th>
                  <th>Error (if any)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(segment, index) in sourceSegments" :key="index">
                  <td>{{ segment.url }}</td>
                  <td :class="segment.status === 200 || segment.status === 302 ? 'success-text' : 'error-text'">{{
                    segment.status }}</td>
                  <td>{{ segment.method }}</td>
                  <td>{{ segment.type }}</td>
                  <td>{{ segment.time ? segment.time.toFixed(2) : '-' }}</td>
                  <td>{{ segment.error || '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else>
            <p class="placeholder-text">No Source segments loaded. Click Play in Source panel to fetch segments.</p>
          </div>
        </div>
        <div class="segment-panel">
          <h3>SSAI Segments</h3>
          <div v-if="ssaiSegmentsLoading">
            <p>Loading SSAI segments...</p>
          </div>
          <div v-else-if="ssaiSegments.length">
            <table class="segment-table">
              <thead>
                <tr>
                  <th>Segment URL</th>
                  <th>Status Code</th>
                  <th>Method</th>
                  <th>Type</th>
                  <th>Time (ms)</th>
                  <th>Error (if any)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(segment, index) in ssaiSegments" :key="index">
                  <td>{{ segment.url }}</td>
                  <td :class="segment.status === 200 || segment.status === 302 ? 'success-text' : 'error-text'">{{
                    segment.status }}</td>
                  <td>{{ segment.method }}</td>
                  <td>{{ segment.type }}</td>
                  <td>{{ segment.time ? segment.time.toFixed(2) : '-' }}</td>
                  <td>{{ segment.error || '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else>
            <p class="placeholder-text">No SSAI segments loaded. Click Play in SSAI panel to fetch segments.</p>
          </div>
        </div>
      </div>
      <div v-else class="placeholder-text">Load both manifests to see differences and timing issues.</div>
    </div>
  </div>
</template>

<script>
import * as dashjs from "dashjs";

export default {
  data() {
    return {
      sourceUrl: '',
      ssaiUrl: '',
      sourceManifest: null,
      ssaiManifest: null,
      comparison: [],
      sourceSegments: [],
      ssaiSegments: [],
      sourceSegmentsLoading: false,
      ssaiSegmentsLoading: false,
      sourcePlayer: null,
      ssaiPlayer: null,
      viewMode: 'manifest' // Default to manifest comparison
    };
  },
  methods: {
    async loadManifest(type) {
      const url = type === 'source' ? this.sourceUrl : this.ssaiUrl;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'application/xml');
        if (type === 'source') this.sourceManifest = xml;
        else this.ssaiManifest = xml;
        this.compareManifests();
      } catch (e) {
        alert(`Failed to load ${type} manifest: ${e.message}`);
      }
    },
    async playStream(type) {
      const url = type === 'source' ? this.sourceUrl : this.ssaiUrl;
      const videoRef = type === 'source' ? this.$refs.sourceVideo : this.$refs.ssaiVideo;
      const manifest = type === 'source' ? this.sourceManifest : this.ssaiManifest;
      if (!url || !videoRef || !manifest) {
        alert(`Cannot play ${type}: ${!url ? 'No URL' : !videoRef ? 'No video element' : 'No manifest loaded'}`);
        return;
      }

      // Mute both players if they exist
      if (this.$refs.sourceVideo) this.$refs.sourceVideo.muted = true;
      if (this.$refs.ssaiVideo) this.$refs.ssaiVideo.muted = true;

      // Remove previous player, clear segments and set loading state
      if (type === 'source') {
        if (this.sourcePlayer) {
          this.sourcePlayer.reset();
        }
        this.sourceSegmentsLoading = true;
        this.sourceSegments = [];
      } else {
        if (this.ssaiPlayer) {
          this.ssaiPlayer.reset();
        }
        this.ssaiSegmentsLoading = true;
        this.ssaiSegments = [];
      }

      if (dashjs) {
        const player = dashjs.MediaPlayer().create();
        // NEW: Correct API for live delay in dash.js v3+
        player.updateSettings({
          streaming: {
            delay: {
              liveDelay: 4  // 4 seconds delay for live streams; adjust if needed
            },
            fastSwitchEnabled: true
          }
        });
        player.initialize(videoRef, url, true);

        // Segment tracking (USE .push for Vue reactivity in all versions)
        player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, (event) => {
          if (event && event.request && event.request.url) {
            const req = event.request;
            const segment = {
              url: req.url,
              status: event.response ? event.response.httpResponseCode : null,
              method: req.method || 'GET',
              type: req.mediaType || 'media',
              time:
                typeof req.duration === 'number'
                  ? req.duration * 1000
                  : (event.response && typeof event.response.duration === 'number' ? event.response.duration : null),
              error:
                event.response &&
                  event.response.httpResponseCode &&
                  ![200, 206, 302].includes(event.response.httpResponseCode)
                  ? this.getErrorReason(event.response.httpResponseCode)
                  : '',
            };
            if (type === 'source') {
              this.sourceSegments.push(segment);      // Changed to push for Vue reactivity!
              this.sourceSegmentsLoading = false;
            } else {
              this.ssaiSegments.push(segment);
              this.ssaiSegmentsLoading = false;
            }
          }
        });

        // Handle playback errors
        player.on(dashjs.MediaPlayer.events.ERROR, (e) => {
          alert(`Playback error for ${type}: ${e?.error?.message || 'Unknown error'}`);
          if (type === 'source') this.sourceSegmentsLoading = false;
          else this.ssaiSegmentsLoading = false;
        });

        // Store reference for later stop/reset
        if (type === 'source') {
          this.sourcePlayer = player;
        } else {
          this.ssaiPlayer = player;
        }
      } else {
        alert('dash.js is not loaded.');
        if (type === 'source') this.sourceSegmentsLoading = false;
        else this.ssaiSegmentsLoading = false;
      }
    },

    updateSegmentList(type, segment) {
      if (type === 'source') {
        this.sourceSegments = [...this.sourceSegments, segment];
        this.sourceSegmentsLoading = false;
      } else {
        this.ssaiSegments = [...this.ssaiSegments, segment];
        this.ssaiSegmentsLoading = false;
      }
    },
    getErrorReason(status) {
      switch (status) {
        case 404:
          return 'Segment not found. Verify the segment URL or check if the segment file exists on the server.';
        case 403:
          return 'Access forbidden. Check server permissions or authentication requirements.';
        case 500:
          return 'Server error. Check the server logs for issues or retry later.';
        case 503:
          return 'Service unavailable. Server may be down or overloaded; retry later.';
        default:
          return `Unexpected status code ${status}. Investigate server configuration or network issues.`;
      }
    },
    getBaseUrl(xml) {
      return xml?.querySelector('BaseURL')?.textContent || '';
    },
    getSegmentTemplate(xml) {
      return xml?.querySelector('SegmentTemplate')?.getAttribute('media') || '';
    },
    constructSegmentUrl(baseUrl, template, time) {
      if (!baseUrl || !template) return '';
      return baseUrl + template.replace('$Time$', Math.round(time * 90000));
    },
    stopStream(type) {
      const videoRef = type === 'source' ? this.$refs.sourceVideo : this.$refs.ssaiVideo;
      const player = type === 'source' ? this.sourcePlayer : this.ssaiPlayer;
      if (videoRef && player) {
        player.reset();
        if (type === 'source') {
          this.sourceSegments = [];
          this.sourceSegmentsLoading = false;
          this.sourcePlayer = null;
        } else {
          this.ssaiSegments = [];
          this.ssaiSegmentsLoading = false;
          this.ssaiPlayer = null;
        }
      }
    },
    formatManifest(xml) {
      if (!xml) return '';
      return this.prettyPrintXML(xml);
    },
    prettyPrintXML(xmlDoc) {
      const serializer = new XMLSerializer();
      const xmlStr = serializer.serializeToString(xmlDoc);
      let formatted = '';
      let indent = '';
      const indentStep = '  ';

      xmlStr.split(/>\s*</).forEach((node, index) => {
        if (node.match(/^\/\w/)) {
          indent = indent.slice(indentStep.length);
        }
        formatted += `${indent}${index === 0 ? node : `<${node}>`}\n`;
        if (node.match(/^<?\w[^>]*[^/]$/) && !node.match(/^<\w[^>]*\/>/)) {
          indent += indentStep;
        }
      });

      return formatted;
    },
    compareManifests() {
      if (!this.sourceManifest || !this.ssaiManifest) return;

      const differences = [];
      const sourceElems = Array.from(this.sourceManifest.querySelectorAll('*'));
      const ssaiElems = Array.from(this.ssaiManifest.querySelectorAll('*'));

      const tagNames = new Set([...sourceElems.map(e => e.tagName), ...ssaiElems.map(e => e.tagName)]);

      tagNames.forEach(tag => {
        const src = sourceElems.filter(e => e.tagName === tag);
        const ssai = ssaiElems.filter(e => e.tagName === tag);

        if (src.length !== ssai.length) {
          differences.push({
            type: 'MISSING',
            tag: tag,
            attribute: '',
            sourceValue: `Count: ${src.length}`,
            ssaiValue: `Count: ${ssai.length}`,
            solution: src.length > ssai.length
              ? `Add missing ${tag} elements to SSAI manifest to match Source count.`
              : `Remove excess ${tag} elements from SSAI manifest or add to Source.`
          });
        }

        src.forEach((sEl, i) => {
          const sAttrs = this.getAttributes(sEl);
          const aEl = ssai[i];
          if (!aEl) return;
          const aAttrs = this.getAttributes(aEl);
          const allAttrs = new Set([...Object.keys(sAttrs), ...Object.keys(aAttrs)]);

          allAttrs.forEach(attr => {
            if (sAttrs[attr] !== aAttrs[attr]) {
              differences.push({
                type: 'ATTR MISMATCH',
                tag: `${tag} (index ${i})`,
                attribute: attr,
                sourceValue: sAttrs[attr] || '',
                ssaiValue: aAttrs[attr] || '',
                solution: `Update attribute '${attr}' in SSAI manifest to match Source value or verify if difference is intentional.`
              });
            }
          });
        });
      });

      const sourceSegments = this.getSegmentTimings(this.sourceManifest);
      const ssaiSegments = this.getSegmentTimings(this.ssaiManifest);

      if (sourceSegments.length && ssaiSegments.length) {
        for (let i = 0; i < Math.min(sourceSegments.length, ssaiSegments.length); i++) {
          const src = sourceSegments[i];
          const ssai = ssaiSegments[i];
          const timescale = this.getTimescale(this.sourceManifest);
          const diffStart = Math.abs(src.start - ssai.start);
          const diffDur = Math.abs(src.duration - ssai.duration);
          if (diffStart > 0.05 || diffDur > 0.05) {
            differences.push({
              type: 'TIMING MISMATCH',
              tag: `Segment ${i + 1}`,
              attribute: '',
              sourceValue: `${src.start.toFixed(3)}s / ${src.duration.toFixed(3)}s`,
              ssaiValue: `${ssai.start.toFixed(3)}s / ${ssai.duration.toFixed(3)}s`,
              solution: `Adjust SSAI segment timing (start/duration) to align with Source or verify if offset is intentional (e.g., ad insertion). Timescale used: ${timescale}.`
            });
          }
        }
      }

      this.comparison = differences;
    },
    getAttributes(node) {
      const attrs = {};
      for (let attr of node.attributes || []) {
        attrs[attr.name] = attr.value;
      }
      return attrs;
    },
    getTimescale(xml) {
      const segmentTemplate = xml?.querySelector('SegmentTemplate');
      return segmentTemplate ? parseInt(segmentTemplate.getAttribute('timescale')) || 90000 : 90000;
    },
    getSegmentTimings(xml) {
      const timeline = xml?.querySelector('SegmentTimeline');
      if (!timeline) return [];

      const times = [];
      const sElems = timeline.querySelectorAll('S');
      const timescale = this.getTimescale(xml);
      let currentTime = 0;

      sElems.forEach(s => {
        const d = parseInt(s.getAttribute('d')) / timescale;
        const r = parseInt(s.getAttribute('r') || '0');
        const t = s.getAttribute('t') ? parseInt(s.getAttribute('t')) / timescale : null;
        if (t !== null && times.length === 0) {
          currentTime = t;
        }
        for (let i = 0; i <= r; i++) {
          times.push({ start: currentTime, duration: d });
          currentTime += d;
        }
      });

      return times;
    }
  }
};
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  word-break: break-word;
}

.container {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.panel {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  padding: 16px;
}

.panel-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.input-field {
  width: 100%;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  margin-bottom: 8px;
}

.load-button {
  background-color: #3b82f6;
  color: white;
  padding: 8px 16px;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
}

.load-button-ssai {
  background-color: #10b981;
  color: white;
  padding: 8px 16px;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
}

.button-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.play-button {
  background-color: #16a34a;
  color: white;
  padding: 4px 12px;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
}

.stop-button {
  background-color: #dc2626;
  color: white;
  padding: 4px 12px;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
}

.video-player {
  width: 100%;
  margin-top: 8px;
}

.manifest-display {
  font-size: 0.875rem;
  overflow: auto;
  margin-top: 16px;
  max-height: 20rem;
}

.segment-info {
  margin-top: 16px;
}

.segment-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}

.segment-table th,
.segment-table td {
  border: 1px solid #e5e7eb;
  padding: 8px;
  text-align: left;
  vertical-align: top;
}

.segment-table th {
  background-color: #f3f4f6;
  font-weight: 600;
}

.segment-table td {
  color: #1f2937;
}

.segment-table tr:nth-child(even) {
  background-color: #f9fafb;
}

.success-text {
  color: #16a34a;
}

.error-text {
  color: #dc2626;
}

.comparison-panel {
  grid-column: span 2;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  padding: 16px;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}

.comparison-table th,
.comparison-table td {
  border: 1px solid #e5e7eb;
  padding: 8px;
  text-align: left;
  vertical-align: top;
}

.comparison-table th {
  background-color: #f3f4f6;
  font-weight: 600;
}

.comparison-table td {
  color: #1f2937;
}

.comparison-table tr:nth-child(even) {
  background-color: #f9fafb;
}

.timing-explanation {
  margin-bottom: 16px;
}

.timing-explanation h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.timing-explanation p {
  margin-bottom: 8px;
}

.timing-explanation ul {
  list-style-type: disc;
  padding-left: 20px;
}

.timing-explanation li {
  margin-bottom: 4px;
}

.timing-explanation code {
  background-color: #f3f4f6;
  padding: 2px 4px;
  border-radius: 4px;
}

.placeholder-text {
  color: #6b7280;
}

.radio-group {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  color: #1f2937;
  cursor: pointer;
}

.radio-label input {
  cursor: pointer;
}

.segment-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.segment-panel {
  padding: 8px;
}

.segment-panel h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 8px;
}
</style>