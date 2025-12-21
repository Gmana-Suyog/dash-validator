<template>
  <div id="app">
    <!-- <Dash_debug_player/> -->
    <Dash_play/>
  </div>
</template>

<script>
import Dash_play from './components/Dash_play.vue';
// import Dash_debug_player from './components/dash_debug_player.vue';

export default {
  name: 'App',
  components: {
    // Dash_debug_player,
    Dash_play
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
