<template>
    <button v-if="$slidev.nav.isPresenter && targetCompletionTime"
        class="slidev-icon-btn aspect-ratio-initial target-completion-nav" :title="tooltipText"
        @click="openSettingsDialog">
        <carbon-navaid-military class="slidev-icon" />
        <span class="target-time-text">{{ formattedTargetTime }}</span>
    </button>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { CONFIG_KEY, STORAGE_KEYS, EVENTS } from '../utils/constants'

const { TARGET_COMPLETION } = STORAGE_KEYS

// Reactive data
const targetCompletionTime = ref(null)

// Get Slidev configuration
const use12HourFormat = $slidev.configs?.[CONFIG_KEY]?.use12HourFormat ?? false

// Load target completion time
const loadTargetCompletionTime = () => {
    const stored = localStorage.getItem(TARGET_COMPLETION)
    if (stored) {
        targetCompletionTime.value = parseInt(stored)
    }
}

// Format target time for display
const formattedTargetTime = computed(() => {
    if (!targetCompletionTime.value) {
        return '--:--'
    }

    const date = new Date(targetCompletionTime.value)

    // Check for invalid date
    if (isNaN(date.getTime())) {
        return '--:--'
    }

    const hours = date.getHours()
    const minutes = date.getMinutes()

    if (use12HourFormat) {
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
        const ampm = hours >= 12 ? 'PM' : 'AM'
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`
    } else {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
})

// Tooltip text
const tooltipText = computed(() => {
    if (!targetCompletionTime.value) {
        return 'No target completion time set'
    }

    // Only show date if it's not today
    const targetDate = new Date(targetCompletionTime.value)
    const today = new Date()

    let dateInfo = ''
    if (targetDate.toDateString() !== today.toDateString()) {
        dateInfo = ` on ${targetDate.toLocaleDateString()}`
    }

    return `Target completion time: ${formattedTargetTime.value}${dateInfo} | Click to configure`
})

// Function to open settings dialog
const openSettingsDialog = () => {
    window.dispatchEvent(new CustomEvent(EVENTS.OPEN_SETTINGS))
}

// Listen for in-window settings changes from SettingsDialog
const handleSettingsUpdated = (event) => {
    const { key, value } = event.detail
    if (key === TARGET_COMPLETION) {
        targetCompletionTime.value = value ? parseInt(value) : null
    }
}

onMounted(() => {
    loadTargetCompletionTime()
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)
})

onUnmounted(() => {
    window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)
})
</script>

<style scoped>
.target-completion-nav {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.target-time-text {
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    font-weight: bold;
    min-width: 3rem;
    text-align: center;
    color: var(--slidev-color-text, inherit);
}

/* Dark mode adjustments not needed as we use the default text color */
</style>
