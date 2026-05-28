<template>
    <BreakOverlay :active-break="activeBreak" :current-time="currentTime" @dismiss="dismissActive" />
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BreakOverlay from './components/BreakOverlay.vue'
import {
    STORAGE_KEYS,
    EVENTS,
    readSegmentBreaks,
    writeSegmentBreaks,
    computeSegments,
} from './utils/constants'

// The overlay needs to render on BOTH presenter and audience windows.
// TimerBar only mounts in presenter view, so the overlay lives here and
// derives its own state from localStorage. Cross-window sync rides on
// the browser's real `storage` event (which fires in other tabs/windows
// for the same origin); same-window sync rides on our CustomEvent.

const currentTime = ref(Date.now())
const tickId = ref(null)
const allBreaks = ref([])

const loadAllBreaks = () => {
    try {
        const segs = computeSegments($slidev?.nav?.slides ?? [])
        const collected = []
        for (const seg of segs) {
            for (const b of readSegmentBreaks(seg.index)) {
                collected.push({ ...b, segmentIndex: seg.index })
            }
        }
        allBreaks.value = collected
    } catch {
        allBreaks.value = []
    }
}

const activeBreak = computed(() => allBreaks.value.find(b => b.raisedAt && !b.dismissedAt) ?? null)

const dismissActive = () => {
    const a = activeBreak.value
    if (!a) return
    const segBreaks = readSegmentBreaks(a.segmentIndex)
    const updated = segBreaks.map(b => b.id === a.id ? { ...b, dismissedAt: Date.now() } : b)
    writeSegmentBreaks(a.segmentIndex, updated)
    loadAllBreaks()
}

const onSettingsUpdated = (event) => {
    if (event.detail?.key === STORAGE_KEYS.BREAKS) loadAllBreaks()
}

const onStorage = (event) => {
    if (event.key === STORAGE_KEYS.BREAKS) loadAllBreaks()
}

onMounted(() => {
    loadAllBreaks()
    window.addEventListener(EVENTS.SETTINGS_UPDATED, onSettingsUpdated)
    window.addEventListener('storage', onStorage)
    tickId.value = setInterval(() => {
        currentTime.value = Date.now()
    }, 1000)
})

onUnmounted(() => {
    window.removeEventListener(EVENTS.SETTINGS_UPDATED, onSettingsUpdated)
    window.removeEventListener('storage', onStorage)
    if (tickId.value) clearInterval(tickId.value)
})
</script>
