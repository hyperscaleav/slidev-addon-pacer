<template>
    <button v-if="$slidev.nav.isPresenter && targetCompletionTime"
        class="slidev-icon-btn aspect-ratio-initial target-completion-nav" :title="tooltipText"
        @click="openSettings">
        <carbon-navaid-military class="slidev-icon" />
        <span class="target-time-text">{{ formattedTargetTime }}</span>
    </button>
</template>

<script setup>
import { computed } from 'vue'
import { CONFIG_KEY, EVENTS } from '../utils/constants'

const props = defineProps({
    targetCompletionTime: {
        type: Number,
        default: null,
    },
})

const use12HourFormat = $slidev.configs?.[CONFIG_KEY]?.use12HourFormat ?? false

const formattedTargetTime = computed(() => {
    if (!props.targetCompletionTime) return '--:--'

    const date = new Date(props.targetCompletionTime)
    if (isNaN(date.getTime())) return '--:--'

    const hours = date.getHours()
    const minutes = date.getMinutes()

    if (use12HourFormat) {
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
        const ampm = hours >= 12 ? 'PM' : 'AM'
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
})

const tooltipText = computed(() => {
    if (!props.targetCompletionTime) return 'No target completion time set'

    const targetDate = new Date(props.targetCompletionTime)
    const today = new Date()

    let dateInfo = ''
    if (targetDate.toDateString() !== today.toDateString()) {
        dateInfo = ` on ${targetDate.toLocaleDateString()}`
    }

    return `Target completion time: ${formattedTargetTime.value}${dateInfo} | Click to configure`
})

const openSettings = () => {
    window.dispatchEvent(new CustomEvent(EVENTS.OPEN_SETTINGS))
}
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
</style>
