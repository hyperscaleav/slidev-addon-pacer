<template>
    <button v-if="$slidev.nav.isPresenter" class="slidev-icon-btn aspect-ratio-initial slide-timer-nav"
        :title="tooltipText" @click="openSettingsDialog">
        <carbon-timer class="slidev-icon" />
        <span class="timer-text" :class="timerClass">{{ formattedSlideTime }}</span>
    </button>
</template>

<script setup>
import { computed } from 'vue'
import { EVENTS } from '../utils/constants'

// Props from TimerBar
const props = defineProps({
    currentSlideElapsed: {
        type: Number,
        required: true
    },
    currentSlidePlannedMinutes: {
        type: Number,
        required: true
    },
    presentationHasStarted: {
        type: Boolean,
        required: true
    }
})

// Calculate slide remaining time in seconds (can go negative)
const slideRemainingSeconds = computed(() => {
    const slideTimeSeconds = props.currentSlidePlannedMinutes * 60
    return slideTimeSeconds - props.currentSlideElapsed
})

// Format slide time for display
const formattedSlideTime = computed(() => {
    const totalSeconds = Math.abs(slideRemainingSeconds.value)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    const sign = slideRemainingSeconds.value < 0 ? '-' : ''

    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`
})

// CSS class for timer styling
const timerClass = computed(() => {
    if (slideRemainingSeconds.value < 0) {
        return 'time-behind' // Red when over slide time
    } else if (slideRemainingSeconds.value < 30) {
        return 'time-warning' // Yellow when less than 30 seconds left
    } else {
        return 'time-ahead' // Green when plenty of time left
    }
})

// Tooltip text
const tooltipText = computed(() => {
    const slideTime = props.currentSlidePlannedMinutes

    if (!props.presentationHasStarted) {
        return `Presentation not started - Timer paused | Click to configure`
    }

    if (slideRemainingSeconds.value < 0) {
        const overTime = Math.abs(slideRemainingSeconds.value)
        const overMinutes = Math.floor(overTime / 60)
        const overSeconds = Math.floor(overTime % 60)
        return `Over slide time by ${overMinutes}:${overSeconds.toString().padStart(2, '0')}`
    }
    return `Slide timer (${slideTime}min planned) | Click to configure`
})

// Function to open settings dialog
const openSettingsDialog = () => {
    window.dispatchEvent(new CustomEvent(EVENTS.OPEN_SETTINGS))
}
</script>

<style scoped>
.slide-timer-nav {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.timer-text {
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    font-weight: bold;
    min-width: 3rem;
    text-align: center;
}

.time-future {
    color: #6b7280;
}

.time-ahead {
    color: #059669;
}

.time-warning {
    color: #d97706;
}

.time-behind {
    color: #dc2626;
}

/* Dark mode adjustments */
.dark .time-future {
    color: #9ca3af;
}

.dark .time-ahead {
    color: #10b981;
}

.dark .time-warning {
    color: #f59e0b;
}

.dark .time-behind {
    color: #ef4444;
}
</style>
