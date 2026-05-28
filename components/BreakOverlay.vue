<template>
    <div v-if="activeBreak" class="break-overlay">
        <div class="break-content">
            <h1 class="break-title">Break</h1>
            <p class="break-resume-at">Back at {{ formattedResumeTime }}</p>
            <div class="break-countdown" :class="{ overrun: isOverrun }">
                {{ formattedCountdown }}
            </div>
            <p v-if="isOverrun" class="break-overrun-note">Break over &mdash; running long</p>
            <button class="break-dismiss" @click="$emit('dismiss')">Resume presentation</button>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

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

defineEmits(['dismiss'])

// Resume time = the moment the break is scheduled to end:
// raisedAt + duration. Falls back to startTime + duration if raisedAt
// is not set yet (shouldn't happen in practice).
const resumeTime = computed(() => {
    if (!props.activeBreak) return null
    const base = props.activeBreak.raisedAt ?? props.activeBreak.startTime
    return base + props.activeBreak.durationMinutes * 60 * 1000
})

const remainingMs = computed(() => {
    if (!resumeTime.value) return 0
    return resumeTime.value - props.currentTime
})

const isOverrun = computed(() => remainingMs.value < 0)

const formattedCountdown = computed(() => {
    const total = Math.abs(remainingMs.value)
    const totalSeconds = Math.floor(total / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const sign = isOverrun.value ? '-' : ''
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`
})

const formattedResumeTime = computed(() => {
    if (!resumeTime.value) return '--:--'
    return new Date(resumeTime.value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })
})

// Allow Escape to dismiss the overlay for keyboard-driven presenters.
const onKeydown = (e) => {
    if (e.key === 'Escape' && props.activeBreak) {
        e.preventDefault()
        // Defer to parent via emit so state stays in TimerBar.
        // Note: emit access from a non-template handler needs the
        // setup context; we use a window event instead for simplicity.
        window.dispatchEvent(new CustomEvent('pacer-break-dismiss-key'))
    }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.break-overlay {
    position: fixed;
    inset: 0;
    z-index: 5000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(8, 12, 22, 0.95);
    color: #f9fafb;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}

.break-content {
    text-align: center;
    padding: 4rem 6rem;
    max-width: 90vw;
}

.break-title {
    font-size: clamp(3rem, 8vw, 6rem);
    font-weight: 700;
    margin: 0 0 1rem 0;
    letter-spacing: 0.05em;
    color: #21cab9;
}

.break-resume-at {
    font-size: clamp(1.25rem, 2.5vw, 1.75rem);
    margin: 0 0 2rem 0;
    color: #9ca3af;
}

.break-countdown {
    font-family: 'Courier New', monospace;
    font-size: clamp(5rem, 14vw, 11rem);
    font-weight: 700;
    line-height: 1;
    color: #f9fafb;
    margin: 0 0 1.5rem 0;
    font-variant-numeric: tabular-nums;
}

.break-countdown.overrun {
    color: #ef4444;
    animation: pulse 2s ease-in-out infinite;
}

.break-overrun-note {
    font-size: clamp(1rem, 2vw, 1.25rem);
    color: #ef4444;
    margin: 0 0 2rem 0;
}

.break-dismiss {
    padding: 0.75rem 2rem;
    font-size: 1rem;
    background: #21cab9;
    color: #080c16;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: background-color 0.2s ease, transform 0.1s ease;
}

.break-dismiss:hover {
    background: #1ba99a;
}

.break-dismiss:active {
    transform: translateY(1px);
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.7;
    }
}
</style>
