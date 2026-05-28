<template>
  <button v-if="$slidev.nav.isPresenter" class="slidev-icon-btn aspect-ratio-initial end-time-nav" :title="tooltipText"
    @click="openSettings">
    <mdi-crystal-ball class="slidev-icon" />
    <div class="time-container">
      <span class="end-time-text" :class="timeClass">{{ formattedEndTime }}</span>
      <span v-if="directionArrow" class="end-time-arrow" :class="timeClass">{{ directionArrow }}</span>
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

// Signed minutes: positive = projected to end AFTER target (running long),
// negative = projected to end BEFORE target (running short).
const deltaMinutes = computed(() => {
  if (!props.targetCompletionTime || !props.estimatedEndTime) return null
  return (props.estimatedEndTime.getTime() - props.targetCompletionTime) / 60000
})

const timeClass = computed(() => {
  const d = deltaMinutes.value
  if (d === null || !props.presentationStartTime) return 'time-neutral'

  const abs = Math.abs(d)
  if (abs <= 5) return 'time-ahead'        // on target: green
  if (abs <= 15) return 'time-warning'     // slightly off either way: yellow
  if (d > 0) return 'time-behind'          // ending too LATE (>15min over): red
  return 'time-early'                       // ending too EARLY (>15min under): blue
})

// Up arrow = running long (ending after target). Down arrow = running short.
// No arrow when we're within the on-target window or have no target.
const directionArrow = computed(() => {
  const d = deltaMinutes.value
  if (d === null || Math.abs(d) <= 5) return ''
  return d > 0 ? '↑' : '↓'
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

  let paceNote = ''
  const d = deltaMinutes.value
  if (d !== null && Math.abs(d) > 5) {
    const mins = Math.abs(Math.round(d))
    paceNote = d > 0
      ? ` | ${mins}min over target (running long)`
      : ` | ${mins}min under target (running short)`
  } else if (d !== null) {
    paceNote = ' | on target'
  }

  return `Estimated end: ${formattedEndTime.value}${paceNote} | ${targetInfo} | ${remainingTime}${bankedText} | Click to configure`
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
  gap: 0.15rem;
}

.end-time-text {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  font-weight: bold;
  min-width: 3rem;
  text-align: center;
}

.end-time-arrow {
  font-size: 0.75rem;
  font-weight: bold;
  line-height: 1;
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

.time-early {
  color: #2563eb !important;
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

.dark .time-early {
  color: #60a5fa !important;
}
</style>
