<template>
    <button v-if="$slidev.nav.isPresenter" class="slidev-icon-btn aspect-ratio-initial presentation-timer"
        :title="tooltipText" @click="toggleStartTime">
        <carbon-time class="slidev-icon" />
        <span class="timer-text" :class="timerClass">{{ formattedTime }}</span>
    </button>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { CONFIG_KEY, STORAGE_KEYS, EVENTS, writeSetting } from '../utils/constants'

const { PRESENTATION_START } = STORAGE_KEYS

// Reactive data
const currentTime = ref(Date.now())
const intervalId = ref(null)
const presentationStartTime = ref(null)

// Get presentation start time from storage or settings
const loadPresentationStartTime = () => {
    const stored = localStorage.getItem(PRESENTATION_START)
    if (stored) {
        presentationStartTime.value = parseInt(stored)
    } else {
        // Check if there's a configured start time in settings
        const startTimeStr = $slidev.configs?.[CONFIG_KEY]?.presentationStartTime
        if (startTimeStr) {
            // Parse time string like "14:30" and convert to timestamp for today
            const [hours, minutes] = startTimeStr.split(':').map(Number)
            const today = new Date()
            today.setHours(hours, minutes, 0, 0)
            presentationStartTime.value = today.getTime()
            writeSetting(PRESENTATION_START, presentationStartTime.value)
        }
    }
}

// Check if presentation has started
const hasStarted = computed(() => {
    if (!presentationStartTime.value) return true // No start time set, consider started
    return currentTime.value >= presentationStartTime.value
})

// Time until start (negative means started)
const timeUntilStart = computed(() => {
    if (!presentationStartTime.value) return 0
    return presentationStartTime.value - currentTime.value
})

// Elapsed time since start
const elapsedTime = computed(() => {
    if (!presentationStartTime.value || !hasStarted.value) return 0
    return currentTime.value - presentationStartTime.value
})

// Format time for display
const formattedTime = computed(() => {
    let totalMs
    let prefix = ''

    if (hasStarted.value) {
        totalMs = elapsedTime.value
        prefix = ''
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
    } else {
        return `${prefix}${minutes}:${seconds.toString().padStart(2, '0')}`
    }
})

// CSS class for timer styling
const timerClass = computed(() => {
    if (!hasStarted.value) {
        if (timeUntilStart.value <= 60000) { // Less than 1 minute to start
            return 'time-warning'
        } else if (timeUntilStart.value <= 300000) { // Less than 5 minutes to start
            return 'time-ahead'
        } else {
            return 'time-neutral'
        }
    } else {
        // Presentation has started - show elapsed time
        return 'time-started'
    }
})

// Tooltip text
const tooltipText = computed(() => {
    if (!presentationStartTime.value) {
        return 'No start time set | Click to configure in settings'
    }

    const startTimeStr = new Date(presentationStartTime.value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    })

    if (hasStarted.value) {
        return `Presentation started at ${startTimeStr} | Click to configure in settings`
    } else {
        return `Presentation starts at ${startTimeStr} | Click to configure in settings`
    }
})

// Toggle/set start time - now opens settings dialog
const toggleStartTime = () => {
    window.dispatchEvent(new CustomEvent(EVENTS.OPEN_SETTINGS))
}

// Update current time every second
const startTimer = () => {
    if (intervalId.value) return

    intervalId.value = setInterval(() => {
        currentTime.value = Date.now()
    }, 1000)
}

const stopTimer = () => {
    if (intervalId.value) {
        clearInterval(intervalId.value)
        intervalId.value = null
    }
}

// Listen for in-window settings changes from SettingsDialog
const handleSettingsUpdated = (event) => {
    const { key, value } = event.detail
    if (key === PRESENTATION_START) {
        presentationStartTime.value = value ? parseInt(value) : null
    }
}

onMounted(() => {
    loadPresentationStartTime()
    startTimer()
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)
})

onUnmounted(() => {
    stopTimer()
    window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)
})
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
    /* Gray */
}

.time-ahead {
    color: #10b981;
    /* Green */
}

.time-warning {
    color: #f59e0b;
    /* Yellow */
}

.time-started {
    color: #3b82f6;
    /* Blue */
}
</style>
