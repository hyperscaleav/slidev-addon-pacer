<template>
  <button v-if="$slidev.nav.isPresenter" class="slidev-icon-btn aspect-ratio-initial end-time-nav" :title="tooltipText"
    @click="openSettingsDialog">
    <mdi-crystal-ball class="slidev-icon" />
    <div class="time-container">
      <span class="end-time-text" :class="timeClass">{{ formattedEndTime }}</span>
    </div>
  </button>
</template>


<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { CONFIG_KEY, STORAGE_KEYS, EVENTS } from '../utils/constants'

const { TARGET_COMPLETION } = STORAGE_KEYS

// Props from TimerBar
const props = defineProps({
  estimatedEndTime: {
    type: Date,
    default: null
  },
  bankedTimeMinutes: {
    type: Number,
    required: true
  },
  remainingTimeMinutes: {
    type: Number,
    required: true
  },
  targetCompletionTime: {
    type: Number,
    default: null
  },
  presentationStartTime: {
    type: Number,
    default: null
  },
  currentSlideElapsed: {
    type: Number,
    required: true
  },
  currentTime: {
    type: Number,
    required: true
  }
})

// Reactive data
const targetCompletionTime = ref(props.targetCompletionTime)

// Watch for changes to targetCompletionTime prop
const loadTargetCompletionTime = () => {
  const stored = localStorage.getItem(TARGET_COMPLETION)
  if (stored) {
    targetCompletionTime.value = parseInt(stored)
  }
}

// Get Slidev configuration
const use12HourFormat = $slidev.configs?.[CONFIG_KEY]?.use12HourFormat ?? false

// Calculate estimated finish time using the passed estimatedEndTime prop
const estimatedFinishTime = computed(() => {
  return props.estimatedEndTime ? props.estimatedEndTime.getTime() : null
})

// Format time for display
const formattedEndTime = computed(() => {
  const timestamp = estimatedFinishTime.value

  // Check for invalid timestamp
  if (!timestamp || isNaN(timestamp)) {
    return '--:--'
  }

  const date = new Date(timestamp)

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

// CSS class for time styling
const timeClass = computed(() => {
  if (!targetCompletionTime.value || !props.presentationStartTime) {
    return 'time-neutral'
  }

  // Compare estimated finish time with target
  const deltaMinutes = (estimatedFinishTime.value - targetCompletionTime.value) / (60 * 1000)

  if (Math.abs(deltaMinutes) <= 5) {
    return 'time-ahead' // Green when within 5 minutes
  } else if (Math.abs(deltaMinutes) <= 15) {
    return 'time-warning' // Yellow when within 15 minutes
  } else {
    return 'time-behind' // Red when outside 15 minutes
  }
})

// Tooltip text
const tooltipText = computed(() => {
  const targetTime = targetCompletionTime.value ?
    new Date(targetCompletionTime.value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: use12HourFormat
    }) : 'Not set'

  const remainingTime = `${props.remainingTimeMinutes.toFixed(1)}min remaining`
  const bankedText = props.bankedTimeMinutes !== 0 ?
    ` | ${props.bankedTimeMinutes > 0 ? '+' : ''}${props.bankedTimeMinutes.toFixed(1)}min banked` : ''

  const targetInfo = targetCompletionTime.value ?
    `Target: ${targetTime}` :
    'No target set'

  return `Estimated end: ${formattedEndTime.value} | ${targetInfo} | ${remainingTime}${bankedText} | Click to configure`
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

.delta-indicator {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  font-weight: normal;
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
