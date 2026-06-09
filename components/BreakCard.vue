<template>
    <div v-if="activeBreak" class="break-card" :class="{ controllable: canControl, dragging: isInteracting }"
        :style="cardStyle" @pointerdown="onCardPointerDown">
        <div class="break-card-label">Break</div>
        <div class="break-card-time" :class="{ overrun: isOverrun }">{{ formattedCountdown }}</div>
        <div class="break-card-sub">{{ isOverrun ? 'running long' : `back at ${formattedResumeTime}` }}</div>

        <!-- Presenter-only controls. The audience window mirrors position and
             size but has no controls. -->
        <template v-if="canControl">
            <button class="break-card-resume" @pointerdown.stop @click.stop="$emit('dismiss')">Resume</button>
            <div class="break-card-resize" title="Drag to resize" @pointerdown.stop="onResizePointerDown">
                <mdi-resize-bottom-right class="break-card-resize-icon" />
            </div>
        </template>
    </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useDraggableTimer } from '../utils/useDraggableTimer'

const props = defineProps({
    activeBreak: {
        type: Object,
        default: null,
    },
    currentTime: {
        type: Number,
        required: true,
    },
    // True only in the presenter window. Gates drag, resize, and Resume.
    canControl: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['dismiss', 'update:pos'])

// Drag/resize + cross-window position sync. Persist emits the new position
// up to the parent, which merges it into the break's entry (breaks live in a
// per-segment list, so the merge happens there, not on a single global key).
const { isInteracting, cardStyle, onCardPointerDown, onResizePointerDown } = useDraggableTimer({
    active: () => props.activeBreak,
    canControl: () => props.canControl,
    persist: (pos) => emit('update:pos', pos),
})

// Resume time = the moment the break ends: raisedAt + duration (falls back to
// startTime + duration). Unchanged from the previous overlay.
const resumeTime = computed(() => {
    if (!props.activeBreak) return null
    const base = props.activeBreak.raisedAt ?? props.activeBreak.startTime
    return base + props.activeBreak.durationMinutes * 60 * 1000
})

const remainingMs = computed(() => (resumeTime.value ? resumeTime.value - props.currentTime : 0))
const isOverrun = computed(() => remainingMs.value < 0)

const formattedCountdown = computed(() => {
    const totalSeconds = Math.floor(Math.abs(remainingMs.value) / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const sign = isOverrun.value ? '-' : ''
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`
})

const formattedResumeTime = computed(() => {
    if (!resumeTime.value) return '--:--'
    return new Date(resumeTime.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

// Escape dismisses via a window event (not a direct emit) so the dismiss
// runs in TimerBar, which also resumes the slide-visit timer that was paused
// when the break was raised. This preserves the existing break counting
// behaviour. (The Resume button goes through the parent's @dismiss path,
// which matches the previous overlay exactly.)
const onKeydown = (e) => {
    if (e.key === 'Escape' && props.activeBreak) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('pacer-break-dismiss-key'))
    }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.break-card {
    position: fixed;
    z-index: 5000;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1em;
    padding: 0.5em 0.9em;
    border-radius: 0.4em;
    /* Font follows the presentation theme (inherit), but the break keeps its
       teal identity for the label/countdown. */
    font-family: inherit;
    color: #21cab9;
    background: rgba(8, 12, 22, 0.82);
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.35);
    -webkit-backdrop-filter: blur(3px);
    backdrop-filter: blur(3px);
    user-select: none;
    touch-action: none;
}

/* Light slides get a light card so the teal stays legible. */
:global(html:not(.dark)) .break-card {
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.18);
}

.break-card.controllable {
    cursor: grab;
}

.break-card.dragging {
    cursor: grabbing;
}

.break-card-label {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.85;
}

.break-card-time {
    font-size: 4rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.break-card-time.overrun {
    color: #ef4444;
    animation: break-pulse 2s ease-in-out infinite;
}

.break-card-sub {
    font-size: 0.85rem;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
}

.break-card-resume {
    margin-top: 0.5rem;
    padding: 0.3rem 1.1rem;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: inherit;
    background: #21cab9;
    color: #080c16;
    border: none;
    border-radius: 0.3rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.break-card-resume:hover {
    background: #1ba99a;
}

.break-card-resize {
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
.break-card:hover .break-card-resize {
    opacity: 0.4;
}

.break-card-resize:hover {
    opacity: 0.8;
}

.break-card-resize-icon {
    width: 0.9rem;
    height: 0.9rem;
}

@keyframes break-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.65; }
}
</style>
