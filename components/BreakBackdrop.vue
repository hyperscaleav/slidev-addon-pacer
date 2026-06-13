<template>
    <!-- Fullscreen break screen. When a break is raised it mirrors to every
         window (presenter + audience) via the shared break state and covers the
         slide. The deck names a GLOBAL component in `pacer.breakComponent`
         (Slidev auto-registers everything in the deck's components/ dir) and we
         mount it here directly, in the same Vue app: no iframe, no route load,
         so it appears instantly, keeps its own lifecycle (a carousel keeps
         auto-advancing), and never flashes. With no component configured we
         fall back to a plain countdown modal. The draggable BreakCard floats
         above this for presenter control (Resume / drag). -->
    <div v-if="activeBreak" class="break-backdrop">
        <component :is="breakComponent" v-if="breakComponent" v-bind="breakProps" class="break-backdrop-content" />
        <div v-else class="break-backdrop-fallback">
            <div class="break-backdrop-label">On a break</div>
            <div class="break-backdrop-time" :class="{ overrun: isOverrun }">{{ formattedCountdown }}</div>
            <div class="break-backdrop-sub">{{ isOverrun ? 'resuming shortly' : `back at ${formattedResumeTime}` }}</div>
        </div>
    </div>
</template>

<script setup>
import { computed, resolveComponent } from 'vue'
import { CONFIG_KEY } from '../utils/constants'

const props = defineProps({
    activeBreak: {
        type: Object,
        default: null,
    },
    currentTime: {
        type: Number,
        required: true,
    },
})

// `pacer.breakComponent` (string) names a globally-registered component to fill
// the break screen — e.g. a SlideLoop carousel of pre-show slides. `pacer.breakProps`
// is an optional object spread onto it. Absent => the countdown-modal fallback.
// Resolve the configured name against registered components. resolveComponent
// returns the name string unchanged when nothing matches; treat that as "not
// found" and fall back to the countdown modal rather than rendering a stray
// native element. The component must be registered globally (setup/main.ts).
const breakComponent = computed(() => {
    const name = $slidev.configs?.[CONFIG_KEY]?.breakComponent
    if (!name) return null
    const resolved = resolveComponent(name)
    return typeof resolved === 'string' ? null : resolved
})
const breakProps = computed(() => $slidev.configs?.[CONFIG_KEY]?.breakProps ?? {})

// Fallback countdown. Resume time = when the break ends: raised-at (or its
// scheduled start) plus its duration. Matches BreakCard so the two agree.
const resumeAt = computed(() => {
    const b = props.activeBreak
    if (!b) return 0
    const base = b.raisedAt ?? b.startTime
    return base + (b.durationMinutes ?? 0) * 60 * 1000
})
const remainingMs = computed(() => resumeAt.value - props.currentTime)
const isOverrun = computed(() => remainingMs.value < 0)
const formattedCountdown = computed(() => {
    const total = Math.floor(Math.abs(remainingMs.value) / 1000)
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
})
const formattedResumeTime = computed(() =>
    new Date(resumeAt.value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
</script>

<style scoped>
.break-backdrop {
    position: fixed;
    inset: 0;
    /* Above the slide canvas, below the draggable break card (z 5000) and the
       activity timer, so the presenter's Resume control stays reachable. */
    z-index: 4000;
    background: #000;
    overflow: hidden;
}

/* The mounted component fills the screen. SlideLoop already positions itself
   absolute inset:0; this is a guard for components that don't. */
.break-backdrop-content {
    position: absolute;
    inset: 0;
}

.break-backdrop-fallback {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: #e2e8f0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    background: radial-gradient(circle at 50% 38%, #1e293b, #020617 72%);
    user-select: none;
}

.break-backdrop-label {
    font-size: 4vmin;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.7;
}

.break-backdrop-time {
    font-size: 22vmin;
    font-weight: 800;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
    margin: 0.1em 0;
}

.break-backdrop-time.overrun {
    color: #f87171;
}

.break-backdrop-sub {
    font-size: 3.4vmin;
    opacity: 0.7;
}
</style>
