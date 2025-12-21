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
      <h3>{{ title }} MPD Info</h3>
      <div v-if="!manifest">
        <p class="placeholder-text">
          No MPD loaded. Load a manifest to see MPD information.
        </p>
      </div>
      <div v-else>
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
              <td>{{ value || "-" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <pre class="manifest-display">{{ formattedManifest }}</pre>
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
  emits: ["update:url", "load-manifest", "play-stream", "stop-stream"],
  computed: {
    loadButtonClass() {
      return this.panelType === "ssai" ? "load-button-ssai" : "load-button";
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

.manifest-display {
  font-size: 12px;
  overflow: auto;
  margin-top: 20px;
  max-height: 300px;
  white-space: pre-wrap;
  word-break: break-word;
  background: #1f2937;
  color: #f9fafb;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #374151;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  line-height: 1.5;
}

.manifest-display::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.manifest-display::-webkit-scrollbar-track {
  background: #374151;
  border-radius: 4px;
}

.manifest-display::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 4px;
}

.manifest-display::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.mpd-info {
  margin-top: 20px;
}

.mpd-info h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mpd-info h3::before {
  /* content: '📊'; */
  font-size: 1rem;
}

.mpd-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.mpd-table th,
.mpd-table td {
  border: 1px solid #e5e7eb;
  padding: 12px 16px;
  text-align: left;
  vertical-align: top;
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

  .manifest-display {
    font-size: 11px;
    max-height: 200px;
  }

  .mpd-table th,
  .mpd-table td {
    padding: 8px 12px;
    font-size: 12px;
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

  .manifest-display {
    max-height: 150px;
    font-size: 10px;
  }

  .mpd-table {
    font-size: 11px;
  }

  .mpd-table th,
  .mpd-table td {
    padding: 6px 8px;
  }
}
</style>
