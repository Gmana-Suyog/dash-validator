<template>
  <div class="panel">
    <h2 class="panel-title">{{ title }}</h2>
    <input
      :value="url"
      @input="$emit('update:url', $event.target.value)"
      @keyup.enter="$emit('load-manifest')"
      :placeholder="placeholder"
      class="input-field"
    />
    <button @click="$emit('load-manifest')" :class="loadButtonClass">
      Load
    </button>

    <div class="button-group">
      <button @click="$emit('play-stream')" class="play-button">▶ Play</button>
      <button @click="$emit('stop-stream')" class="stop-button">■ Stop</button>
    </div>

    <video ref="videoElement" controls class="video-player"></video>

    <div class="mpd-info">
      <div class="mpd-header" @click="toggleMpdInfo">
        <h3>{{ title }} MPD Info</h3>
        <button
          class="collapse-button"
          :class="{ collapsed: !mpdInfoExpanded }"
        >
          <span class="collapse-icon">{{ mpdInfoExpanded ? "▼" : "▶" }}</span>
        </button>
      </div>
      <div v-show="mpdInfoExpanded" class="mpd-content">
        <div v-if="!manifest">
          <p class="placeholder-text">
            No MPD loaded. Load a manifest to see MPD information.
          </p>
        </div>
        <div v-else>
          <!-- View Toggle Buttons -->
          <div class="view-toggle-buttons">
            <button
              @click="setActiveView('table')"
              :class="['view-toggle-btn', { active: activeView === 'table' }]"
              title="Table View"
            >
              <span class="view-icon">🗂️</span>
              <span class="view-label">Table</span>
            </button>
            <button
              @click="setActiveView('xml')"
              :class="['view-toggle-btn', { active: activeView === 'xml' }]"
              title="XML View"
            >
              <span class="view-icon">📄</span>
              <span class="view-label">XML</span>
            </button>
            <button
              @click="setActiveView('profile')"
              :class="['view-toggle-btn', { active: activeView === 'profile' }]"
              title="Profile View - Video quality, resolution, codecs, bitrates"
            >
              <span class="view-icon">📊</span>
              <span class="view-label">Profile</span>
            </button>
          </div>

          <!-- Table View -->
          <div
            v-show="activeView === 'table'"
            class="view-content mpd-table-wrapper"
          >
            <table class="mpd-table">
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(value, key) in mpdInfo" :key="key">
                  <td>{{ key }}</td>
                  <td>{{ formatMpdValue(value) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- XML View -->
          <div
            v-show="activeView === 'xml'"
            class="view-content xml-view-wrapper"
          >
            <pre class="xml-display">{{ formattedManifest }}</pre>
          </div>

          <!-- Profile View -->
          <div
            v-show="activeView === 'profile'"
            class="view-content profile-view-wrapper"
          >
            <div v-if="!mpdProfile" class="profile-loading">
              <p>Loading profile information...</p>
            </div>
            <div v-else class="profile-content">
              <!-- General Information -->
              <div class="profile-section">
                <h4
                  class="profile-section-title"
                  @click="toggleProfileSection('general')"
                >
                  <span class="collapse-icon">{{
                    profileSections.general ? "▼" : "▶"
                  }}</span>
                  General Information
                </h4>
                <div
                  v-show="profileSections.general"
                  class="profile-section-content"
                >
                  <div class="profile-grid">
                    <div class="profile-item">
                      <span class="profile-label">Type:</span>
                      <span class="profile-value">{{
                        mpdProfile.general.type
                      }}</span>
                    </div>
                    <div class="profile-item">
                      <span class="profile-label">Profiles:</span>
                      <span class="profile-value">{{
                        mpdProfile.general.profiles
                      }}</span>
                    </div>
                    <div class="profile-item">
                      <span class="profile-label">Duration:</span>
                      <span class="profile-value">{{
                        mpdProfile.general.mediaPresentationDuration
                      }}</span>
                    </div>
                    <div class="profile-item">
                      <span class="profile-label">Min Buffer Time:</span>
                      <span class="profile-value">{{
                        mpdProfile.general.minBufferTime
                      }}</span>
                    </div>
                    <div
                      class="profile-item"
                      v-if="mpdProfile.streaming.isLive"
                    >
                      <span class="profile-label">Availability Start:</span>
                      <span class="profile-value">{{
                        mpdProfile.general.availabilityStartTime
                      }}</span>
                    </div>
                    <div
                      class="profile-item"
                      v-if="mpdProfile.streaming.isLive"
                    >
                      <span class="profile-label">Time Shift Buffer:</span>
                      <span class="profile-value">{{
                        mpdProfile.general.timeShiftBufferDepth
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Video Tracks -->
              <div class="profile-section" v-if="mpdProfile.video.length > 0">
                <h4
                  class="profile-section-title"
                  @click="toggleProfileSection('video')"
                >
                  <span class="collapse-icon">{{
                    profileSections.video ? "▼" : "▶"
                  }}</span>
                  Video Tracks ({{ mpdProfile.video.length }})
                </h4>
                <div
                  v-show="profileSections.video"
                  class="profile-section-content"
                >
                  <div class="profile-table-wrapper">
                    <table class="profile-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Resolution</th>
                          <th>Bitrate</th>
                          <th>Frame Rate</th>
                          <th>Codec</th>
                          <th>MIME Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="video in mpdProfile.video" :key="video.id">
                          <td>{{ video.id }}</td>
                          <td>{{ video.width }}x{{ video.height }}</td>
                          <td>{{ formatBitrate(video.bandwidth) }}</td>
                          <td>{{ video.frameRate }}</td>
                          <td>{{ video.codecs }}</td>
                          <td>{{ video.mimeType }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- Audio Tracks -->
              <div class="profile-section" v-if="mpdProfile.audio.length > 0">
                <h4
                  class="profile-section-title"
                  @click="toggleProfileSection('audio')"
                >
                  <span class="collapse-icon">{{
                    profileSections.audio ? "▼" : "▶"
                  }}</span>
                  Audio Tracks ({{ mpdProfile.audio.length }})
                </h4>
                <div
                  v-show="profileSections.audio"
                  class="profile-section-content"
                >
                  <div class="profile-table-wrapper">
                    <table class="profile-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Language</th>
                          <th>Bitrate</th>
                          <th>Sample Rate</th>
                          <th>Codec</th>
                          <th>Channels</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="audio in mpdProfile.audio" :key="audio.id">
                          <td>{{ audio.id }}</td>
                          <td>{{ audio.lang || "und" }}</td>
                          <td>{{ formatBitrate(audio.bandwidth) }}</td>
                          <td>
                            {{
                              audio.audioSamplingRate
                                ? audio.audioSamplingRate + " Hz"
                                : ""
                            }}
                          </td>
                          <td>{{ audio.codecs }}</td>
                          <td>
                            {{ audio.audioChannelConfiguration?.value || "" }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- DRM Information -->
              <div class="profile-section" v-if="mpdProfile.drm.length > 0">
                <h4
                  class="profile-section-title"
                  @click="toggleProfileSection('drm')"
                >
                  <span class="collapse-icon">{{
                    profileSections.drm ? "▼" : "▶"
                  }}</span>
                  DRM Systems ({{ mpdProfile.drm.length }})
                </h4>
                <div
                  v-show="profileSections.drm"
                  class="profile-section-content"
                >
                  <div class="profile-table-wrapper">
                    <table class="profile-table">
                      <thead>
                        <tr>
                          <th>System</th>
                          <th>Scheme ID URI</th>
                          <th>Default KID</th>
                          <th>Content Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="drm in mpdProfile.drm" :key="drm.index">
                          <td>{{ drm.systemName }}</td>
                          <td class="small-text">{{ drm.schemeIdUri }}</td>
                          <td class="small-text">{{ drm.defaultKID }}</td>
                          <td>{{ drm.contentType }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- Technical Summary -->
              <div class="profile-section">
                <h4
                  class="profile-section-title"
                  @click="toggleProfileSection('technical')"
                >
                  <span class="collapse-icon">{{
                    profileSections.technical ? "▼" : "▶"
                  }}</span>
                  Technical Summary
                </h4>
                <div
                  v-show="profileSections.technical"
                  class="profile-section-content"
                >
                  <div class="profile-grid">
                    <div class="profile-item">
                      <span class="profile-label">Stream Type:</span>
                      <span class="profile-value">{{
                        mpdProfile.streaming.isLive ? "Live" : "VOD"
                      }}</span>
                    </div>
                    <div class="profile-item">
                      <span class="profile-label">Total Periods:</span>
                      <span class="profile-value">{{
                        mpdProfile.technical.totalPeriods
                      }}</span>
                    </div>
                    <div class="profile-item">
                      <span class="profile-label">Video Resolutions:</span>
                      <span class="profile-value">{{
                        mpdProfile.technical.videoResolutions.join(", ")
                      }}</span>
                    </div>
                    <div class="profile-item">
                      <span class="profile-label">Video Codecs:</span>
                      <span class="profile-value">{{
                        mpdProfile.technical.videoCodecs.join(", ")
                      }}</span>
                    </div>
                    <div class="profile-item">
                      <span class="profile-label">Audio Codecs:</span>
                      <span class="profile-value">{{
                        mpdProfile.technical.audioCodecs.join(", ")
                      }}</span>
                    </div>
                    <div class="profile-item">
                      <span class="profile-label">Has UTC Timing:</span>
                      <span class="profile-value">{{
                        mpdProfile.streaming.hasUTCTiming ? "Yes" : "No"
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "VideoPanel",
  props: {
    title: {
      type: String,
      required: true,
    },
    placeholder: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      default: "",
    },
    manifest: {
      // type: Object,
      type: [Object, XMLDocument],
      default: null,
    },
    mpdInfo: {
      type: Object,
      default: () => ({}),
    },
    formattedManifest: {
      type: String,
      default: "",
    },
    panelType: {
      type: String,
      default: "source",
    },
  },
  data() {
    return {
      mpdInfoExpanded: false, // Start collapsed to save space
      activeView: "table", // Default to table view
      mpdProfile: null, // Profile information
      profileSections: {
        general: true,
        video: true,
        audio: true,
        drm: false,
        technical: false,
      },
    };
  },
  emits: ["update:url", "load-manifest", "play-stream", "stop-stream"],
  computed: {
    loadButtonClass() {
      return this.panelType === "ssai" ? "load-button-ssai" : "load-button";
    },
  },
  methods: {
    toggleMpdInfo() {
      this.mpdInfoExpanded = !this.mpdInfoExpanded;
    },
    setActiveView(view) {
      this.activeView = view;
    },
    formatMpdValue(value) {
      if (value === null || value === undefined || value === "") {
        return "-";
      }
      if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
      }
      return value;
    },
    toggleProfileSection(section) {
      this.profileSections[section] = !this.profileSections[section];
    },
    formatBitrate(bandwidth) {
      if (!bandwidth) return "-";
      if (bandwidth >= 1000000) {
        return (bandwidth / 1000000).toFixed(1) + " Mbps";
      } else if (bandwidth >= 1000) {
        return (bandwidth / 1000).toFixed(0) + " kbps";
      }
      return bandwidth + " bps";
    },
    async extractProfile() {
      if (!this.manifest) {
        this.mpdProfile = null;
        return;
      }

      try {
        // Import the ManifestService
        const { ManifestService } = await import(
          "../services/manifestService.js"
        );
        const manifestService = new ManifestService();

        // Extract profile information
        this.mpdProfile = manifestService.extractMPDProfile(this.manifest);
      } catch (error) {
        console.error("Error extracting MPD profile:", error);
        this.mpdProfile = null;
      }
    },
  },
  watch: {
    manifest: {
      handler() {
        this.extractProfile();
      },
      immediate: true,
    },
  },
};
</script>

<style scoped>
.panel {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 20px;
  background: white;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.panel:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
}

.panel-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 16px;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title::before {
  /* content: '📺'; */
  font-size: 1.2rem;
}

.input-field {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  transition: all 0.2s ease;
  background: #f9fafb;
}

.input-field:focus {
  outline: none;
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-field:hover {
  border-color: #d1d5db;
  background: white;
}

.load-button {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.load-button:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

.load-button:active {
  transform: translateY(0);
}

.load-button-ssai {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.load-button-ssai:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
}

.load-button-ssai:active {
  transform: translateY(0);
}

.button-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  flex-wrap: wrap;
}

.play-button {
  background: linear-gradient(135deg, #16a34a, #15803d);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);
}

.play-button:hover {
  background: linear-gradient(135deg, #15803d, #166534);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(22, 163, 74, 0.3);
}

.stop-button {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
}

.stop-button:hover {
  background: linear-gradient(135deg, #b91c1c, #991b1b);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
}

.video-player {
  width: 100%;
  margin-top: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  background: #000;
}

.mpd-info {
  margin-top: 20px;
}

.mpd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border: 1px solid #e2e8f0;
  margin-bottom: 8px;
}

.mpd-header:hover {
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.mpd-info h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mpd-info h3::before {
  /* content: '📊'; */
  font-size: 1rem;
}

.collapse-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
}

.collapse-button:hover {
  background: rgba(59, 130, 246, 0.1);
}

.collapse-icon {
  font-size: 14px;
  font-weight: bold;
  color: #6b7280;
  transition: transform 0.2s ease;
}

.collapse-button.collapsed .collapse-icon {
  transform: rotate(0deg);
}

.collapse-button:not(.collapsed) .collapse-icon {
  transform: rotate(0deg);
}

.mpd-content {
  animation: slideDown 0.3s ease-out;
  overflow: hidden;
}

.view-toggle-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  padding: 4px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 500;
  min-width: 80px;
  justify-content: center;
}

.view-toggle-btn:hover {
  background: #e2e8f0;
  color: #374151;
}

.view-toggle-btn.active {
  background: #3b82f6;
  color: white;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.view-toggle-btn.active:hover {
  background: #2563eb;
}

.view-icon {
  font-size: 14px;
}

.view-label {
  font-size: 12px;
  font-weight: 600;
}

.view-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.xml-view-wrapper {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.xml-display {
  font-size: 12px;
  overflow: auto;
  max-height: 400px;
  white-space: pre-wrap;
  word-break: break-word;
  background: #1f2937;
  color: #f9fafb;
  padding: 16px;
  margin: 0;
  border: 1px solid #374151;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  line-height: 1.5;
}

.xml-display::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.xml-display::-webkit-scrollbar-track {
  background: #374151;
  border-radius: 4px;
}

.xml-display::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 4px;
}

.xml-display::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.mpd-table-wrapper {
  overflow-x: auto;
  overflow-y: visible;
  max-width: 100%;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background: white;
  position: relative;
  scroll-behavior: smooth;
}

.mpd-table-wrapper::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 20px;
  background: linear-gradient(to left, rgba(255, 255, 255, 0.8), transparent);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.mpd-table-wrapper:hover::after {
  opacity: 1;
}

.mpd-table-wrapper::-webkit-scrollbar {
  height: 8px;
}

.mpd-table-wrapper::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.mpd-table-wrapper::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.mpd-table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.mpd-table {
  width: 100%;
  min-width: 500px; /* Ensure minimum width for proper display */
  border-collapse: collapse;
  margin: 0;
  border-radius: 8px;
  overflow: hidden;
}

.mpd-table th,
.mpd-table td {
  border: 1px solid #e5e7eb;
  padding: 12px 16px;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
  min-width: 120px;
}

.mpd-table th:first-child,
.mpd-table td:first-child {
  min-width: 180px;
  font-weight: 600;
}

.mpd-table th:last-child,
.mpd-table td:last-child {
  min-width: 300px;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 400px;
}

.mpd-table th {
  background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
  font-weight: 600;
  color: #374151;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mpd-table td {
  color: #1f2937;
  font-size: 14px;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
}

.mpd-table tr:nth-child(even) {
  background-color: #f9fafb;
}

.mpd-table tr:hover {
  background-color: #f3f4f6;
}

.placeholder-text {
  color: #6b7280;
  font-style: italic;
  text-align: center;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
  border: 2px dashed #d1d5db;
}

/* Responsive design */
@media (max-width: 768px) {
  .panel {
    padding: 16px;
  }

  .panel-title {
    font-size: 1.3rem;
  }

  .button-group {
    gap: 8px;
  }

  .play-button,
  .stop-button {
    padding: 6px 12px;
    font-size: 13px;
  }

  .load-button,
  .load-button-ssai {
    padding: 10px 20px;
    font-size: 13px;
  }

  .view-toggle-btn {
    padding: 6px 10px;
    font-size: 12px;
    min-width: 70px;
  }

  .view-icon {
    font-size: 13px;
  }

  .view-label {
    font-size: 11px;
  }

  .xml-display {
    font-size: 11px;
    max-height: 300px;
  }

  .mpd-table-wrapper {
    border-radius: 6px;
  }

  .mpd-table {
    min-width: 450px;
  }

  .mpd-table th,
  .mpd-table td {
    padding: 8px 12px;
    font-size: 12px;
  }

  .mpd-table th:first-child,
  .mpd-table td:first-child {
    min-width: 150px;
  }

  .mpd-table th:last-child,
  .mpd-table td:last-child {
    min-width: 250px;
    max-width: 300px;
  }
}

@media (max-width: 480px) {
  .panel {
    padding: 12px;
  }

  .panel-title {
    font-size: 1.2rem;
  }

  .input-field {
    padding: 10px 12px;
    font-size: 13px;
  }

  .button-group {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .play-button,
  .stop-button,
  .load-button,
  .load-button-ssai {
    width: 100%;
    justify-content: center;
  }

  .view-toggle-buttons {
    gap: 4px;
    padding: 3px;
  }

  .view-toggle-btn {
    padding: 6px 8px;
    font-size: 11px;
    min-width: 60px;
    gap: 4px;
  }

  .view-icon {
    font-size: 12px;
  }

  .view-label {
    font-size: 10px;
  }

  .xml-display {
    max-height: 200px;
    font-size: 10px;
    padding: 12px;
  }

  .mpd-table-wrapper {
    border-radius: 4px;
  }

  .mpd-table {
    min-width: 400px;
    font-size: 11px;
  }

  .mpd-table th,
  .mpd-table td {
    padding: 6px 8px;
    font-size: 11px;
  }

  .mpd-table th:first-child,
  .mpd-table td:first-child {
    min-width: 120px;
  }

  .mpd-table th:last-child,
  .mpd-table td:last-child {
    min-width: 200px;
    max-width: 250px;
  }
}

/* Animations */
@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    max-height: 1000px;
    transform: translateY(0);
  }
}

/* Smooth transitions for collapsible content */
.mpd-content {
  transition: all 0.3s ease;
}

/* Profile View Styles */
.profile-view-wrapper {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.profile-content {
  padding: 16px;
  background: #f9fafb;
}

.profile-section {
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.profile-section-title {
  background: #f3f4f6;
  padding: 12px 16px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.2s ease;
}

.profile-section-title:hover {
  background: #e5e7eb;
}

.profile-section-content {
  padding: 16px;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.profile-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.profile-label {
  font-weight: 600;
  color: #374151;
  font-size: 13px;
}

.profile-value {
  color: #6b7280;
  font-size: 13px;
  text-align: right;
  word-break: break-word;
}

.profile-table-wrapper {
  overflow-x: auto;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.profile-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 600px;
}

.profile-table th {
  background: #f3f4f6;
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.profile-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  color: #6b7280;
  vertical-align: top;
}

.profile-table tr:hover {
  background: #f9fafb;
}

.profile-table .small-text {
  font-size: 11px;
  font-family: monospace;
  word-break: break-all;
  max-width: 200px;
}

.profile-loading {
  padding: 40px;
  text-align: center;
  color: #6b7280;
  font-style: italic;
}

/* Responsive adjustments for profile view */
@media (max-width: 768px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }

  .profile-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .profile-value {
    text-align: left;
  }

  .profile-table-wrapper {
    font-size: 12px;
  }

  .profile-table th,
  .profile-table td {
    padding: 8px 6px;
  }
}
</style>
