<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
// Demo break-screen component. `pacer.breakComponent: BreakDemo` mounts this
// directly in the break overlay (no iframe). The live tick proves it keeps its
// own lifecycle while the presenter navigates the deck behind it.
const tick = ref(0)
let t = null
onMounted(() => { t = setInterval(() => { tick.value++ }, 1000) })
onUnmounted(() => { if (t) clearInterval(t) })
</script>

<template>
  <div class="break-demo">
    <div class="break-demo-orb"></div>
    <div class="break-demo-text">
      <div class="break-demo-kicker">BREAK</div>
      <div class="break-demo-sub">back shortly</div>
      <div class="break-demo-clock">{{ tick }}</div>
    </div>
  </div>
</template>

<style scoped>
.break-demo {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 40%, #1e293b, #020617 70%);
  overflow: hidden;
}
.break-demo-orb {
  position: absolute;
  width: 60vmin;
  height: 60vmin;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(56,189,248,0.45), transparent 65%);
  animation: break-pulse 3.2s ease-in-out infinite;
}
@keyframes break-pulse {
  0%, 100% { transform: scale(0.85); opacity: 0.55; }
  50%      { transform: scale(1.15); opacity: 1; }
}
.break-demo-text {
  position: relative;
  text-align: center;
  color: #e2e8f0;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.break-demo-kicker { font-size: 14vmin; font-weight: 800; letter-spacing: 0.15em; }
.break-demo-sub { font-size: 4vmin; opacity: 0.7; margin-top: 0.2em; }
.break-demo-clock {
  margin-top: 1em;
  font-size: 3vmin;
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
}
</style>
