<template>
    <div v-if="$slidev.nav.isPresenter && !breakActive" class="break-now-wrapper">
        <button class="slidev-icon-btn aspect-ratio-initial break-now-trigger" title="Take a break now"
            @click="togglePopover" ref="triggerRef">
            <mdi-coffee class="slidev-icon" />
            <span class="break-now-label">Break</span>
        </button>
        <div v-if="open" class="break-now-popover" ref="popoverRef">
            <div class="break-now-popover-label">Take a break for:</div>
            <div class="break-now-options">
                <button v-for="d in durations" :key="d" class="break-now-option" @click="pick(d)">
                    {{ d < 60 ? `${d}m` : `${d / 60}h` }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

defineProps({
    breakActive: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['break-now'])

const open = ref(false)
const triggerRef = ref(null)
const popoverRef = ref(null)
const durations = [5, 10, 15, 30, 60]

const togglePopover = () => {
    open.value = !open.value
}

const pick = (durationMinutes) => {
    emit('break-now', durationMinutes)
    open.value = false
}

// Click outside the popover closes it.
const onDocClick = (e) => {
    if (!open.value) return
    if (triggerRef.value?.contains(e.target)) return
    if (popoverRef.value?.contains(e.target)) return
    open.value = false
}

const onKeydown = (e) => {
    if (e.key === 'Escape' && open.value) {
        open.value = false
    }
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
.break-now-wrapper {
    position: relative;
    display: inline-flex;
}

.break-now-trigger {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.break-now-label {
    font-size: 0.75rem;
    font-weight: bold;
}

.break-now-popover {
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

.break-now-popover-label {
    font-size: 0.7rem;
    opacity: 0.7;
    margin-bottom: 6px;
    text-align: center;
}

.break-now-options {
    display: flex;
    gap: 4px;
}

.break-now-option {
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

.break-now-option:hover {
    background: #21cab9;
    color: #080c16;
    border-color: #21cab9;
}
</style>
