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
import { computed, onMounted, onUnmounted } from 'vue'
import { writeActivity } from '../utils/constants'
import { useDraggableTimer } from '../utils/useDraggableTimer'

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

// Drag/resize and cross-window position sync. The persist writes the new
// position back onto the activity object (a single global key), preserving
// its timing fields.
const { isInteracting, cardStyle, onCardPointerDown, onResizePointerDown } = useDraggableTimer({
    active: () => props.activeActivity,
    canControl: () => props.canControl,
    persist: (pos) => writeActivity({ ...props.activeActivity, ...pos }),
})

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

const dismiss = () => writeActivity(null)

const onKeydown = (e) => {
    if (e.key === 'Escape' && props.canControl && props.activeActivity) {
        e.preventDefault()
        dismiss()
    }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
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
