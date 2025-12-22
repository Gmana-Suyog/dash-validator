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
              <span class="view-icon">📊</span>
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
</style>
