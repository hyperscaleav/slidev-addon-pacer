<template>
    <div v-if="activeActivity" class="activity-timer" :class="{ controllable: canControl, dragging: isInteracting }"
        :style="cardStyle" @pointerdown="onCardPointerDown">
        <div class="activity-timer-time" :class="{ expired: isExpired }">{{ formattedCountdown }}</div>
        <div class="activity-timer-end">{{ isExpired ? "time's up" : `done at ${formattedEndTime}` }}</div>

        <!-- Presenter-only resize handle, revealed on hover. The audience
             window mirrors position and size but has no controls.
             (Dismiss is the nav chip or Escape.) -->
        <div v-if="canControl" class="activity-timer-resize" title="Drag to resize"
            @pointerdown.stop="onResizePointerDown">
            <mdi-resize-bottom-right class="activity-timer-resize-icon" />
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
    writeActivity,
    DEFAULT_ACTIVITY_POS,
    ACTIVITY_SCALE_MIN,
    ACTIVITY_SCALE_MAX,
} from '../utils/constants'

const props = defineProps({
    activeActivity: {
        type: Object,
        default: null,
    },
    currentTime: {
        type: Number,
        required: true,
    },
    // True only in the presenter window. Gates drag, resize, and dismiss.
    canControl: {
        type: Boolean,
        default: false,
    },
})

// Local render position. Synced from the activity object whenever it
// changes AND we are not the window currently dragging/resizing it (so a
// presenter's live drag is never clobbered by its own echoed write, while
// the audience window follows along).
const pos = ref({ ...DEFAULT_ACTIVITY_POS })
const isInteracting = ref(false)

const readPos = (a) => ({
    xPct: a?.xPct ?? DEFAULT_ACTIVITY_POS.xPct,
    yPct: a?.yPct ?? DEFAULT_ACTIVITY_POS.yPct,
    scale: a?.scale ?? DEFAULT_ACTIVITY_POS.scale,
})

watch(() => props.activeActivity, (a) => {
    if (a && !isInteracting.value) pos.value = readPos(a)
}, { immediate: true, deep: true })

const cardStyle = computed(() => ({
    left: `${pos.value.xPct}%`,
    top: `${pos.value.yPct}%`,
    // Center the widget on its coordinate and apply the synced scale.
    transform: `translate(-50%, -50%) scale(${pos.value.scale})`,
}))

const endTime = computed(() => {
    if (!props.activeActivity) return null
    return props.activeActivity.startedAt + props.activeActivity.durationMinutes * 60 * 1000
})

const remainingMs = computed(() => (endTime.value ? endTime.value - props.currentTime : 0))
const isExpired = computed(() => remainingMs.value < 0)

const formattedCountdown = computed(() => {
    const totalSeconds = Math.floor(Math.abs(remainingMs.value) / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const sign = isExpired.value ? '+' : ''
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`
})

const formattedEndTime = computed(() => {
    if (!endTime.value) return '--:--'
    return new Date(endTime.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

// --- Persisting position/scale (throttled during a gesture) ---------------

let lastPersist = 0
const persist = (final = false) => {
    if (!props.activeActivity) return
    // performance.now() (not the 1s-resolution currentTime tick) so the
    // throttle actually paces sub-second drag updates to the other window.
    const now = performance.now()
    // ~30fps of cross-window updates is smooth without thrashing storage.
    if (!final && now - lastPersist < 33) return
    lastPersist = now
    writeActivity({ ...props.activeActivity, ...pos.value })
}

// --- Drag -----------------------------------------------------------------

let dragStart = null

const onCardPointerDown = (e) => {
    if (!props.canControl) return
    // Ignore secondary buttons; close/resize handle their own pointerdown.
    if (e.button !== 0) return
    isInteracting.value = true
    dragStart = {
        px: e.clientX,
        py: e.clientY,
        xPct: pos.value.xPct,
        yPct: pos.value.yPct,
    }
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragUp)
    // Don't let the slide advance on what is really a drag.
    e.stopPropagation()
}

const onDragMove = (e) => {
    if (!dragStart) return
    const dxPct = ((e.clientX - dragStart.px) / window.innerWidth) * 100
    const dyPct = ((e.clientY - dragStart.py) / window.innerHeight) * 100
    pos.value = {
        ...pos.value,
        xPct: clamp(dragStart.xPct + dxPct, 3, 97),
        yPct: clamp(dragStart.yPct + dyPct, 5, 95),
    }
    persist()
}

const onDragUp = () => {
    dragStart = null
    isInteracting.value = false
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragUp)
    persist(true)
}

// --- Resize (uniform scale) -----------------------------------------------

let resizeStart = null

const onResizePointerDown = (e) => {
    if (!props.canControl || e.button !== 0) return
    isInteracting.value = true
    resizeStart = { px: e.clientX, py: e.clientY, scale: pos.value.scale }
    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', onResizeUp)
    e.stopPropagation()
}

const onResizeMove = (e) => {
    if (!resizeStart) return
    // Average the x and y travel. ~220px of drag ≈ 1.0 of scale.
    const delta = ((e.clientX - resizeStart.px) + (e.clientY - resizeStart.py)) / 2 / 220
    pos.value = {
        ...pos.value,
        scale: clamp(resizeStart.scale + delta, ACTIVITY_SCALE_MIN, ACTIVITY_SCALE_MAX),
    }
    persist()
}

const onResizeUp = () => {
    resizeStart = null
    isInteracting.value = false
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeUp)
    persist(true)
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

const dismiss = () => writeActivity(null)

const onKeydown = (e) => {
    if (e.key === 'Escape' && props.canControl && props.activeActivity) {
        e.preventDefault()
        dismiss()
    }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragUp)
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeUp)
})
</script>

<style scoped>
.activity-timer {
    position: fixed;
    z-index: 5000;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15em;
    padding: 0.5em 0.9em;
    border-radius: 0.4em;
    /* Font follows the presentation: inherit the slide's body font so the
       timer respects the active theme / UnoCSS web fonts rather than
       hardcoding a family. Size is em-based so the resize scale carries it. */
    font-family: inherit;
    color: var(--slidev-theme-primary, inherit);
    background: rgba(8, 12, 22, 0.82);
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.35);
    -webkit-backdrop-filter: blur(3px);
    backdrop-filter: blur(3px);
    user-select: none;
    touch-action: none;
}

/* Light slides get a light chip so the inherited text color stays legible. */
:global(html:not(.dark)) .activity-timer {
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.18);
}

.activity-timer.controllable {
    cursor: grab;
}

.activity-timer.dragging {
    cursor: grabbing;
}

.activity-timer-time {
    font-size: 4rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.activity-timer-time.expired {
    color: #ef4444;
    animation: activity-pulse 2s ease-in-out infinite;
}

.activity-timer-end {
    font-size: 0.9rem;
    opacity: 0.65;
    font-variant-numeric: tabular-nums;
}

.activity-timer-resize {
    position: absolute;
    bottom: 3px;
    right: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    color: inherit;
    opacity: 0;
    transition: opacity 0.15s ease;
    cursor: nwse-resize;
}

/* Reveal the resize affordance only on hover, and keep it subtle. */
.activity-timer:hover .activity-timer-resize {
    opacity: 0.4;
}

.activity-timer-resize:hover {
    opacity: 0.8;
}

.activity-timer-resize-icon {
    width: 0.9rem;
    height: 0.9rem;
}

@keyframes activity-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.65; }
}
</style>
