<template>
  <button v-if="$slidev.nav.isPresenter" class="slidev-icon-btn aspect-ratio-initial end-time-nav" :title="tooltipText"
    @click="openSettings">
    <mdi-crystal-ball class="slidev-icon" />
    <div class="time-container">
      <span class="end-time-text" :class="timeClass">{{ formattedEndTime }}</span>
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { CONFIG_KEY, EVENTS } from '../utils/constants'

const props = defineProps({
  estimatedEndTime: {
    type: Date,
    default: null,
  },
  bankedTimeMinutes: {
    type: Number,
    required: true,
  },
  remainingTimeMinutes: {
    type: Number,
    required: true,
  },
  targetCompletionTime: {
    type: Number,
    default: null,
  },
  presentationStartTime: {
    type: Number,
    default: null,
  },
  currentSlideElapsed: {
    type: Number,
    required: true,
  },
  currentTime: {
    type: Number,
    required: true,
  },
})

const use12HourFormat = $slidev.configs?.[CONFIG_KEY]?.use12HourFormat ?? false

const formattedEndTime = computed(() => {
  const date = props.estimatedEndTime
  if (!date || isNaN(date.getTime())) return '--:--'

  const hours = date.getHours()
  const minutes = date.getMinutes()

  if (use12HourFormat) {
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    const ampm = hours >= 12 ? 'PM' : 'AM'
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
})

const timeClass = computed(() => {
  if (!props.targetCompletionTime || !props.presentationStartTime || !props.estimatedEndTime) {
    return 'time-neutral'
  }

  const deltaMinutes = (props.estimatedEndTime.getTime() - props.targetCompletionTime) / (60 * 1000)

  if (Math.abs(deltaMinutes) <= 5) return 'time-ahead'
  if (Math.abs(deltaMinutes) <= 15) return 'time-warning'
  return 'time-behind'
})

const tooltipText = computed(() => {
  const targetTime = props.targetCompletionTime
    ? new Date(props.targetCompletionTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: use12HourFormat,
      })
    : 'Not set'

  const remainingTime = `${props.remainingTimeMinutes.toFixed(1)}min remaining`
  const bankedText = props.bankedTimeMinutes !== 0
    ? ` | ${props.bankedTimeMinutes > 0 ? '+' : ''}${props.bankedTimeMinutes.toFixed(1)}min banked`
    : ''
  const targetInfo = props.targetCompletionTime ? `Target: ${targetTime}` : 'No target set'

  return `Estimated end: ${formattedEndTime.value} | ${targetInfo} | ${remainingTime}${bankedText} | Click to configure`
})

const openSettings = () => {
  window.dispatchEvent(new CustomEvent(EVENTS.OPEN_SETTINGS))
}
</script>

<style scoped>
.end-time-nav {
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

.end-time-text {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  font-weight: bold;
  min-width: 3rem;
  text-align: center;
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
