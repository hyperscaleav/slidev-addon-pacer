<template>
    <div v-if="$slidev.nav.isPresenter" class="activity-nav-wrapper">
        <button v-if="!activityActive"
            class="slidev-icon-btn aspect-ratio-initial activity-trigger"
            title="Start an activity timer for students"
            @click="togglePopover"
            ref="triggerRef">
            <mdi-pencil-outline class="slidev-icon" />
            <span class="activity-label">Activity</span>
        </button>

        <button v-else
            class="slidev-icon-btn aspect-ratio-initial activity-active-btn"
            :title="`Activity timer: ${chipText} remaining — click to end`"
            @click="$emit('dismiss-activity')">
            <mdi-pencil-outline class="slidev-icon" />
            <span class="activity-chip" :class="chipClass">{{ chipText }}</span>
        </button>

        <div v-if="open" class="activity-popover" ref="popoverRef">
            <div class="activity-popover-label">Activity timer:</div>
            <form class="activity-custom" @submit.prevent="startCustom">
                <input ref="inputRef" v-model="customInput" type="text" inputmode="numeric"
                    class="activity-input" :class="{ invalid: showInvalid }" placeholder="12 or 12:30"
                    aria-label="Custom duration (minutes or mm:ss)" @input="showInvalid = false" />
                <button type="submit" class="activity-start">Start</button>
            </form>
            <div class="activity-options">
                <button v-for="d in durations" :key="d" type="button" class="activity-option" @click="pick(d)">
                    {{ d }}m
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { parseDuration } from '../utils/constants'

const props = defineProps({
    activityActive: {
        type: Boolean,
        default: false,
    },
    currentTime: {
        type: Number,
        required: true,
    },
    activityEndTime: {
        type: Number,
        default: null,
    },
})

const emit = defineEmits(['start-activity', 'dismiss-activity'])

const open = ref(false)
const triggerRef = ref(null)
const popoverRef = ref(null)
const inputRef = ref(null)
const customInput = ref('')
const showInvalid = ref(false)
const durations = [5, 10, 15, 20, 30]

const msRemaining = computed(() => (props.activityEndTime ? props.activityEndTime - props.currentTime : 0))

const chipText = computed(() => {
    if (!props.activityActive) return ''
    if (msRemaining.value <= 0) return 'Done'
    const totalSeconds = Math.floor(msRemaining.value / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

const chipClass = computed(() => {
    const minutesLeft = msRemaining.value / 60000
    if (minutesLeft <= 0) return 'time-done'
    if (minutesLeft < 2) return 'time-warning'
    return 'time-active'
})

const togglePopover = async () => {
    open.value = !open.value
    if (open.value) {
        showInvalid.value = false
        await nextTick()
        inputRef.value?.focus()
    }
}

const start = (minutes) => {
    emit('start-activity', minutes)
    open.value = false
    customInput.value = ''
}

const pick = (durationMinutes) => start(durationMinutes)

const startCustom = () => {
    const minutes = parseDuration(customInput.value)
    if (minutes == null) {
        showInvalid.value = true
        return
    }
    start(minutes)
}

const onDocClick = (e) => {
    if (!open.value) return
    if (triggerRef.value?.contains(e.target)) return
    if (popoverRef.value?.contains(e.target)) return
    open.value = false
}

const onKeydown = (e) => {
    if (e.key === 'Escape' && open.value) open.value = false
}

onMounted(() => {
    document.addEventListener('click', onDocClick)
    window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
    document.removeEventListener('click', onDocClick)
    window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.activity-nav-wrapper {
    position: relative;
    display: inline-flex;
}

.activity-trigger,
.activity-active-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.activity-label {
    font-size: 0.75rem;
    font-weight: bold;
}

.activity-chip {
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    font-weight: bold;
    min-width: 3rem;
    text-align: center;
}

.time-active {
    color: #d97706;
}

.time-warning {
    color: #ef4444;
}

.time-done {
    color: #6b7280;
}

.dark .time-active {
    color: #f59e0b;
}

.dark .time-warning {
    color: #ef4444;
}

.activity-popover {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: #f9fafb;
    border: 1px solid #374151;
    border-radius: 6px;
    padding: 8px 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    z-index: 1200;
    white-space: nowrap;
}

.activity-popover-label {
    font-size: 0.7rem;
    opacity: 0.7;
    margin-bottom: 6px;
    text-align: center;
}

.activity-custom {
    display: flex;
    gap: 4px;
    margin-bottom: 6px;
}

.activity-input {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    font-size: 0.75rem;
    font-family: 'Courier New', monospace;
    background: #111827;
    color: #f9fafb;
    border: 1px solid #4b5563;
    border-radius: 4px;
}

.activity-input:focus {
    outline: none;
    border-color: #d97706;
}

.activity-input.invalid {
    border-color: #ef4444;
}

.activity-start {
    padding: 4px 8px;
    font-size: 0.75rem;
    font-weight: 600;
    background: #d97706;
    color: #fff;
    border: 1px solid #d97706;
    border-radius: 4px;
    cursor: pointer;
}

.activity-start:hover {
    background: #b8650a;
}

.activity-options {
    display: flex;
    gap: 4px;
}

.activity-option {
    padding: 4px 8px;
    font-size: 0.75rem;
    font-weight: 600;
    background: #374151;
    color: #f9fafb;
    border: 1px solid #4b5563;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    font-family: 'Courier New', monospace;
    min-width: 36px;
}

.activity-option:hover {
    background: #d97706;
    color: #ffffff;
    border-color: #d97706;
}
</style>
