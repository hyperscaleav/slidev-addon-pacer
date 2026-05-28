<template>
    <button v-if="$slidev.nav.isPresenter" class="slidev-icon-btn aspect-ratio-initial presentation-timer"
        :title="tooltipText" @click="openSettings">
        <carbon-time class="slidev-icon" />
        <span class="timer-text" :class="timerClass">{{ formattedTime }}</span>
    </button>
</template>

<script setup>
import { computed } from 'vue'
import { EVENTS } from '../utils/constants'

const props = defineProps({
    presentationStartTime: {
        type: Number,
        default: null,
    },
    presentationHasStarted: {
        type: Boolean,
        required: true,
    },
    currentTime: {
        type: Number,
        required: true,
    },
})

const timeUntilStart = computed(() => {
    if (!props.presentationStartTime) return 0
    return props.presentationStartTime - props.currentTime
})

const elapsedTime = computed(() => {
    if (!props.presentationStartTime || !props.presentationHasStarted) return 0
    return props.currentTime - props.presentationStartTime
})

const formattedTime = computed(() => {
    let totalMs
    let prefix = ''

    if (props.presentationHasStarted) {
        totalMs = elapsedTime.value
    } else {
        totalMs = Math.abs(timeUntilStart.value)
        prefix = 'T-'
    }

    const totalSeconds = Math.floor(totalMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
        return `${prefix}${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${prefix}${minutes}:${seconds.toString().padStart(2, '0')}`
})

const timerClass = computed(() => {
    if (!props.presentationHasStarted) {
        if (timeUntilStart.value <= 60000) return 'time-warning'
        if (timeUntilStart.value <= 300000) return 'time-ahead'
        return 'time-neutral'
    }
    return 'time-started'
})

const tooltipText = computed(() => {
    if (!props.presentationStartTime) {
        return 'No start time set | Click to configure in settings'
    }

    const startTimeStr = new Date(props.presentationStartTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })

    if (props.presentationHasStarted) {
        return `Presentation started at ${startTimeStr} | Click to configure in settings`
    }
    return `Presentation starts at ${startTimeStr} | Click to configure in settings`
})

const openSettings = () => {
    window.dispatchEvent(new CustomEvent(EVENTS.OPEN_SETTINGS))
}
</script>

<style scoped>
.presentation-timer {
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

.time-neutral {
    color: #6b7280;
}

.time-ahead {
    color: #10b981;
}

.time-warning {
    color: #f59e0b;
}

.time-started {
    color: #3b82f6;
}
</style>
