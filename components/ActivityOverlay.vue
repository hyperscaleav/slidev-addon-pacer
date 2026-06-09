<template>
    <div v-if="activeActivity" class="activity-overlay">
        <div class="activity-content">
            <h1 class="activity-title">Activity</h1>
            <p class="activity-end-at">Done at {{ formattedEndTime }}</p>
            <div class="activity-countdown" :class="{ expired: isExpired }">
                {{ formattedCountdown }}
            </div>
            <p v-if="isExpired" class="activity-expired-note">Time's up</p>
            <button v-if="$slidev.nav.isPresenter" class="activity-dismiss" @click="$emit('dismiss')">
                Done
            </button>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
    activeActivity: {
        type: Object,
        default: null,
    },
    currentTime: {
        type: Number,
        required: true,
    },
})

defineEmits(['dismiss'])

const endTime = computed(() => {
    if (!props.activeActivity) return null
    return props.activeActivity.startedAt + props.activeActivity.durationMinutes * 60 * 1000
})

const remainingMs = computed(() => {
    if (!endTime.value) return 0
    return endTime.value - props.currentTime
})

const isExpired = computed(() => remainingMs.value < 0)

const formattedCountdown = computed(() => {
    const total = Math.abs(remainingMs.value)
    const totalSeconds = Math.floor(total / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const sign = isExpired.value ? '+' : ''
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`
})

const formattedEndTime = computed(() => {
    if (!endTime.value) return '--:--'
    return new Date(endTime.value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })
})

const onKeydown = (e) => {
    if (e.key === 'Escape' && props.activeActivity) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('pacer-activity-dismiss-key'))
    }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.activity-overlay {
    position: fixed;
    inset: 0;
    z-index: 5000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(8, 12, 22, 0.95);
    color: #f9fafb;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}

.activity-content {
    text-align: center;
    padding: 4rem 6rem;
    max-width: 90vw;
}

.activity-title {
    font-size: clamp(3rem, 8vw, 6rem);
    font-weight: 700;
    margin: 0 0 1rem 0;
    letter-spacing: 0.05em;
    color: #f59e0b;
}

.activity-end-at {
    font-size: clamp(1.25rem, 2.5vw, 1.75rem);
    margin: 0 0 2rem 0;
    color: #9ca3af;
}

.activity-countdown {
    font-family: 'Courier New', monospace;
    font-size: clamp(5rem, 14vw, 11rem);
    font-weight: 700;
    line-height: 1;
    color: #f9fafb;
    margin: 0 0 1.5rem 0;
    font-variant-numeric: tabular-nums;
}

.activity-countdown.expired {
    color: #f59e0b;
    animation: pulse 2s ease-in-out infinite;
}

.activity-expired-note {
    font-size: clamp(1rem, 2vw, 1.25rem);
    color: #f59e0b;
    margin: 0 0 2rem 0;
}

.activity-dismiss {
    padding: 0.75rem 2rem;
    font-size: 1rem;
    background: #f59e0b;
    color: #1f2937;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: background-color 0.2s ease, transform 0.1s ease;
}

.activity-dismiss:hover {
    background: #d97706;
}

.activity-dismiss:active {
    transform: translateY(1px);
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}
</style>
