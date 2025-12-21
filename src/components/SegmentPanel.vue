<template>
  <div class="segment-panel" :class="{ 'collapsed': isCollapsed }">
    <div class="panel-header" @click="toggleCollapse">
      <div class="header-content">
        <h3>{{ title }}</h3>
        <div class="segment-count" v-if="segments.length">
          {{ segments.length }} segments
        </div>
      </div>
      <div class="header-actions">
        <button 
          v-if="segments.length && !isCollapsed" 
          @click.stop="$emit('clear-segments')" 
          class="clear-button"
        >
          Clear
        </button>
        <button class="collapse-button" :class="{ 'collapsed': isCollapsed }">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="panel-content" v-show="!isCollapsed">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading {{ title.toLowerCase() }}...</p>
      </div>
      
      <div v-else-if="segments.length" class="table-container">
        <div class="table-scroll">
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
              <tr v-for="(segment, index) in segments" :key="index">
                <td data-label="Segment URL" class="url-cell">
                  <span class="url-text" :title="segment.url">{{ segment.url }}</span>
                </td>
                <td data-label="Status Code" :class="getStatusClass(segment.status)">{{ segment.status }}</td>
                <td data-label="Method">{{ segment.method }}</td>
                <td data-label="Type">{{ segment.type }}</td>
                <td data-label="Time (ms)">{{ segment.time ? segment.time.toFixed(2) : '-' }}</td>
                <td data-label="Error" class="error-cell">{{ segment.error || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div v-else class="placeholder-state">
        <div class="placeholder-icon">⚪</div>
        <h4>No segments loaded</h4>
        <p>Click Play in {{ title.split(' ')[0] }} panel to fetch segments.</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SegmentPanel',
  props: {
    title: {
      type: String,
      required: true
    },
    segments: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    initiallyCollapsed: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isCollapsed: this.initiallyCollapsed
    };
  },
  emits: ['clear-segments'],
  methods: {
    getStatusClass(status) {
      return [200, 206, 302].includes(status) ? 'success-text' : 'error-text';
    },
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
    }
  }
};
</script>

<style scoped>
.segment-panel {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  overflow: hidden;
}

.segment-panel:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.segment-panel.collapsed {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.panel-header:hover {
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.segment-panel h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.segment-count {
  background: #3b82f6;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clear-button {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  font-size: 12px;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
}

.clear-button:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
}

.collapse-button {
  background: #f3f4f6;
  color: #6b7280;
  padding: 8px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collapse-button:hover {
  background: #e5e7eb;
  color: #374151;
}

.collapse-button svg {
  transition: transform 0.2s ease;
}

.collapse-button.collapsed svg {
  transform: rotate(-90deg);
}

.panel-content {
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 1000px;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.table-container {
  padding: 0;
  max-height: 500px;
  overflow: hidden;
}

.table-scroll {
  max-height: 500px;
  overflow-y: auto;
  overflow-x: auto;
}

.segment-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  font-size: 13px;
}

.segment-table th,
.segment-table td {
  border: 1px solid #e5e7eb;
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
}

.segment-table th {
  background: linear-gradient(135deg, #374151, #4b5563);
  color: white;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  z-index: 5;
}

.segment-table td {
  color: #1f2937;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.segment-table tr:nth-child(even) {
  background-color: #f9fafb;
}

.segment-table tr:hover {
  background-color: #f3f4f6;
}

.url-cell {
  max-width: 300px;
}

.url-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.error-cell {
  max-width: 200px;
  word-break: break-word;
}

.success-text {
  color: #10b981;
  font-weight: 600;
  background: #ecfdf5;
  padding: 2px 6px;
  border-radius: 4px;
  text-align: center;
}

.error-text {
  color: #dc2626;
  font-weight: 600;
  background: #fef2f2;
  padding: 2px 6px;
  border-radius: 4px;
  text-align: center;
}

.placeholder-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #6b7280;
  text-align: center;
}

.placeholder-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.6;
}

.placeholder-state h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

.placeholder-state p {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

/* Responsive design */
@media (max-width: 768px) {
  .panel-header {
    padding: 12px 16px;
  }
  
  .segment-panel h3 {
    font-size: 1.1rem;
  }
  
  .segment-count {
    font-size: 10px;
    padding: 1px 6px;
  }
  
  .clear-button {
    padding: 4px 8px;
    font-size: 11px;
  }
  
  .collapse-button {
    padding: 6px;
  }
  
  .table-container {
    max-height: 400px;
  }
  
  .table-scroll {
    max-height: 400px;
  }
  
  .segment-table {
    font-size: 11px;
  }
  
  .segment-table th,
  .segment-table td {
    padding: 8px 10px;
  }
  
  .url-cell {
    max-width: 200px;
  }
  
  .error-cell {
    max-width: 150px;
  }
}

@media (max-width: 480px) {
  .panel-header {
    padding: 10px 12px;
  }
  
  .header-content {
    gap: 8px;
  }
  
  .segment-panel h3 {
    font-size: 1rem;
  }
  
  .segment-count {
    font-size: 9px;
  }
  
  .clear-button {
    padding: 3px 6px;
    font-size: 10px;
  }
  
  .collapse-button {
    padding: 4px;
  }
  
  .table-container {
    max-height: 300px;
  }
  
  .table-scroll {
    max-height: 300px;
  }
  
  .segment-table {
    font-size: 10px;
  }
  
  .segment-table th,
  .segment-table td {
    padding: 6px 8px;
  }
  
  .url-cell {
    max-width: 150px;
  }
  
  .error-cell {
    max-width: 100px;
  }
  
  .placeholder-state {
    padding: 40px 16px;
  }
  
  .placeholder-icon {
    font-size: 2.5rem;
  }
  
  .placeholder-state h4 {
    font-size: 1rem;
  }
  
  .placeholder-state p {
    font-size: 13px;
  }
}

/* Table responsiveness for very small screens */
@media (max-width: 640px) {
  .segment-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
  
  .segment-table thead,
  .segment-table tbody,
  .segment-table th,
  .segment-table td,
  .segment-table tr {
    display: block;
  }
  
  .segment-table thead tr {
    position: absolute;
    top: -9999px;
    left: -9999px;
  }
  
  .segment-table tr {
    border: 1px solid #e5e7eb;
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 6px;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .segment-table td {
    border: none;
    position: relative;
    padding-left: 40% !important;
    padding-top: 6px;
    padding-bottom: 6px;
    white-space: normal;
  }
  
  .segment-table td:before {
    content: attr(data-label) ": ";
    position: absolute;
    left: 6px;
    width: 35%;
    padding-right: 8px;
    white-space: nowrap;
    font-weight: 600;
    color: #374151;
    font-size: 10px;
  }
  
  .url-text {
    white-space: normal;
    word-break: break-all;
  }
}
</style>