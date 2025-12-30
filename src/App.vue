<template>
  <div id="app">
    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button
        @click="activeTab = 'separate'"
        :class="['tab-button', { active: activeTab === 'separate' }]"
      >
        Separate Comparison
      </button>
      <button
        @click="activeTab = 'single'"
        :class="['tab-button', { active: activeTab === 'single' }]"
      >
        Single Comparison
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Separate Comparison Tab (Current UI) -->
      <div v-show="activeTab === 'separate'" class="tab-panel">
        <Dash_play />
      </div>

      <!-- Single Comparison Tab (New UI) -->
      <div v-show="activeTab === 'single'" class="tab-panel">
        <SingleComparison />
      </div>
    </div>
  </div>
</template>

<script>
import Dash_play from "./components/Dash_play.vue";
import SingleComparison from "./components/SingleComparison.vue";

export default {
  name: "App",
  components: {
    Dash_play,
    SingleComparison,
  },
  data() {
    return {
      activeTab: "separate", // Default to separate comparison
    };
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

/* Tab Navigation Styles */
.tab-navigation {
  display: flex;
  background: #f8f9fa;
  border-bottom: 2px solid #e9ecef;
  padding: 0;
  margin: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tab-button {
  flex: 1;
  padding: 16px 24px;
  background: #f8f9fa;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  color: #6c757d;
  transition: all 0.3s ease;
  border-bottom: 3px solid transparent;
}

.tab-button:hover {
  background: #e9ecef;
  color: #495057;
}

.tab-button.active {
  background: white;
  color: #007bff;
  border-bottom-color: #007bff;
}

/* Tab Content Styles */
.tab-content {
  min-height: calc(100vh - 60px);
}

.tab-panel {
  padding: 20px;
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

/* Responsive Design */
@media (max-width: 768px) {
  .tab-button {
    padding: 12px 16px;
    font-size: 14px;
  }

  .tab-panel {
    padding: 16px;
  }
}
</style>
