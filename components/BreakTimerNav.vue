<template>
    <button v-if="$slidev.nav.isPresenter && nextBreak" class="slidev-icon-btn aspect-ratio-initial break-timer-nav"
        :class="{ due: isBreakDue }" :title="tooltipText" @click="handleClick">
        <carbon-pause-outline class="slidev-icon" />
        <span class="break-text" :class="chipClass">{{ chipText }}</span>
    </button>
</template>

<script setup>
import { computed } from 'vue'
import { EVENTS } from '../utils/constants'

const props = defineProps({
    nextBreak: {
        type: Object,
        default: null,
    },
    isBreakDue: {
        type: Boolean,
        default: false,
    },
    currentTime: {
        type: Number,
        required: true,
    },
    // 1-based page number the next break is projected to land on at
    // current pacing; null if no projection is meaningful.
    projectedLandingPage: {
        type: Number,
        default: null,
    },
    projectedLandingTitle: {
        type: String,
        default: '',
    },
})

const emit = defineEmits(['raise-break'])

const msUntilBreak = computed(() => {
    if (!props.nextBreak) return 0
    return props.nextBreak.startTime - props.currentTime
})

const chipText = computed(() => {
    if (!props.nextBreak) return ''
    if (props.isBreakDue) return 'DUE'

    const totalSeconds = Math.max(0, Math.floor(msUntilBreak.value / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

const chipClass = computed(() => {
    if (props.isBreakDue) return 'time-due'
    const minutesUntil = msUntilBreak.value / 60000
    if (minutesUntil < 2) return 'time-warning'
    if (minutesUntil < 5) return 'time-ahead'
    return 'time-neutral'
})

const tooltipText = computed(() => {
    if (!props.nextBreak) return 'No upcoming breaks'

    const startStr = new Date(props.nextBreak.startTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })
    const dur = props.nextBreak.durationMinutes

    if (props.isBreakDue) {
        return `Break due (${dur}-min) | Click to raise overlay`
    }

    let projectionNote = ''
    if (props.projectedLandingPage != null) {
        const titleNote = props.projectedLandingTitle ? ` (${props.projectedLandingTitle})` : ''
        projectionNote = ` | projected at slide ${props.projectedLandingPage}${titleNote}`
    }

    return `Next break: ${startStr} (${dur}min)${projectionNote} | Click to configure`
})

const handleClick = () => {
    if (props.isBreakDue) {
        emit('raise-break')
    } else {
        window.dispatchEvent(new CustomEvent(EVENTS.OPEN_SETTINGS))
    }
}
</script>

<style scoped>
.break-timer-nav {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.break-text {
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    font-weight: bold;
    min-width: 3rem;
    text-align: center;
}

.break-timer-nav.due {
    animation: due-pulse 1.5s ease-in-out infinite;
}

.time-neutral {
    color: var(--slidev-color-text, inherit);
}

.time-ahead {
    color: #059669;
}

.time-warning {
    color: #d97706;
}

.time-due {
    color: #ef4444;
}

.dark .time-ahead {
    color: #10b981;
}

.dark .time-warning {
    color: #f59e0b;
}

.dark .time-due {
    color: #ef4444;
}

@keyframes due-pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.55;
    }
}
</style>
