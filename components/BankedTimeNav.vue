<template>
    <button v-if="$slidev.nav.isPresenter" class="slidev-icon-btn aspect-ratio-initial banked-time-nav"
        :title="tooltipText" @click="openSettingsDialog">
        <carbon-piggy-bank-slot class="slidev-icon" />
        <div class="time-container">
            <span class="banked-text" :class="bankedClass">{{ formattedBankedTime }}</span>
        </div>
    </button>
</template>

<script setup>
import { computed } from 'vue'
import { EVENTS } from '../utils/constants'

// Props from TimerBar
const props = defineProps({
    bankedTimeMinutes: {
        type: Number,
        required: true
    },
    presentationStartTime: {
        type: Number,
        default: null
    },
    completedSlides: {
        type: Number,
        required: true
    },
    schedulingDeltaMinutes: {
        type: Number,
        default: 0
    },
    dynamicBankingMinutes: {
        type: Number,
        default: 0
    },
    timeDeltaInfo: {
        type: Object,
        default: () => ({ show: false, delta: 0, formattedDelta: '' })
    }
})

// Format banked time for display
const formattedBankedTime = computed(() => {
    // Keep precise calculation, only round for display
    const totalMinutes = props.bankedTimeMinutes
    const absMinutes = Math.abs(totalMinutes)
    const sign = totalMinutes < 0 ? '-' : '+'

    // Round only for display purposes
    const roundedAbsMinutes = Math.round(absMinutes)

    if (roundedAbsMinutes < 1) {
        return `${sign}0m`
    } else if (roundedAbsMinutes < 60) {
        // Less than an hour: show just minutes
        return `${sign}${roundedAbsMinutes}m`
    } else {
        // An hour or more: show HH:MM format
        const hours = Math.floor(roundedAbsMinutes / 60)
        const minutes = roundedAbsMinutes % 60
        return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`
    }
})

// CSS class for banked time styling
const bankedClass = computed(() => {
    if (props.bankedTimeMinutes > 1) {
        return 'time-ahead' // Green when ahead
    } else if (props.bankedTimeMinutes > -1) {
        return 'time-neutral' // Normal when close to target
    } else if (props.bankedTimeMinutes > -3) {
        return 'time-warning' // Yellow when slightly behind
    } else {
        return 'time-behind' // Red when significantly behind
    }
})

// Tooltip text
const tooltipText = computed(() => {
    if (!props.presentationStartTime) {
        return 'Banked time (no start time set) | Click to configure'
    }

    let statusText = ''
    if (props.bankedTimeMinutes > 0) {
        statusText = `${formattedBankedTime.value} ahead of schedule`
    } else if (props.bankedTimeMinutes < 0) {
        statusText = `${formattedBankedTime.value} behind schedule`
    } else {
        statusText = 'On schedule'
    }

    // Show breakdown of banking sources
    const breakdownParts = []

    if (props.schedulingDeltaMinutes !== 0) {
        const sign = props.schedulingDeltaMinutes > 0 ? '+' : ''
        breakdownParts.push(`${sign}${props.schedulingDeltaMinutes.toFixed(1)}min scheduling buffer`)
    }

    if (props.dynamicBankingMinutes !== 0) {
        const sign = props.dynamicBankingMinutes > 0 ? '+' : ''
        const slideText = props.completedSlides === 1 ? 'slide' : 'slides'
        breakdownParts.push(`${sign}${props.dynamicBankingMinutes.toFixed(1)}min from ${props.completedSlides} completed ${slideText}`)
    } else if (props.completedSlides === 0) {
        breakdownParts.push('no completed slides')
    }

    const breakdownText = breakdownParts.length > 0 ? ` (${breakdownParts.join(', ')})` : ''

    return `${statusText}${breakdownText} | Click to configure`
})

// Function to open settings dialog
const openSettingsDialog = () => {
    window.dispatchEvent(new CustomEvent(EVENTS.OPEN_SETTINGS))
}
</script>

<style scoped>
.banked-time-nav {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.time-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
}

.banked-text {
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    font-weight: bold;
    min-width: 3rem;
    text-align: center;
}

.time-future {
    color: #6b7280 !important;
}

.time-neutral {
    color: var(--slidev-color-text, inherit) !important;
}

.time-ahead {
    color: #059669 !important;
}

.time-warning {
    color: #d97706 !important;
}

.time-behind {
    color: #dc2626 !important;
}

/* Dark mode adjustments */
.dark .time-future {
    color: #9ca3af !important;
}

.dark .time-ahead {
    color: #10b981 !important;
}

.dark .time-warning {
    color: #f59e0b !important;
}

.dark .time-behind {
    color: #ef4444 !important;
}
</style>
