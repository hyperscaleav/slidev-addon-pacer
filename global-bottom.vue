<template>
    <BreakOverlay :active-break="activeBreak" :current-time="currentTime" @dismiss="dismissActiveBreak" />
    <ActivityOverlay :active-activity="activeActivity" :current-time="currentTime" @dismiss="dismissActiveActivity" />
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BreakOverlay from './components/BreakOverlay.vue'
import ActivityOverlay from './components/ActivityOverlay.vue'
import {
    STORAGE_KEYS,
    EVENTS,
    readSegmentBreaks,
    writeSegmentBreaks,
    computeSegments,
    readActivity,
    writeActivity,
} from './utils/constants'

// Both overlays render on BOTH presenter and audience windows.
// TimerBar only mounts in presenter view, so overlays live here and
// derive their own state from localStorage. Cross-window sync rides on
// the browser's real `storage` event; same-window sync on CustomEvents.

const currentTime = ref(Date.now())
const tickId = ref(null)
const allBreaks = ref([])
const activeActivity = ref(null)

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

const loadActivity = () => {
    activeActivity.value = readActivity()
}

const activeBreak = computed(() => allBreaks.value.find(b => b.raisedAt && !b.dismissedAt) ?? null)

const dismissActiveBreak = () => {
    const a = activeBreak.value
    if (!a) return
    const segBreaks = readSegmentBreaks(a.segmentIndex)
    const updated = segBreaks.map(b => b.id === a.id ? { ...b, dismissedAt: Date.now() } : b)
    writeSegmentBreaks(a.segmentIndex, updated)
    loadAllBreaks()
}

const dismissActiveActivity = () => {
    writeActivity(null)
    activeActivity.value = null
}

const onDismissActivityKey = () => {
    if (activeActivity.value) dismissActiveActivity()
}

const onSettingsUpdated = (event) => {
    if (event.detail?.key === STORAGE_KEYS.BREAKS) loadAllBreaks()
}

const onActivityChanged = (event) => {
    activeActivity.value = event.detail?.activity ?? null
}

const onStorage = (event) => {
    if (event.key === STORAGE_KEYS.BREAKS) loadAllBreaks()
    if (event.key === STORAGE_KEYS.ACTIVITY) loadActivity()
}

onMounted(() => {
    loadAllBreaks()
    loadActivity()
    window.addEventListener(EVENTS.SETTINGS_UPDATED, onSettingsUpdated)
    window.addEventListener(EVENTS.ACTIVITY_STATE_CHANGED, onActivityChanged)
    window.addEventListener('pacer-activity-dismiss-key', onDismissActivityKey)
    window.addEventListener('storage', onStorage)
    tickId.value = setInterval(() => {
        currentTime.value = Date.now()
    }, 1000)
})

onUnmounted(() => {
    window.removeEventListener(EVENTS.SETTINGS_UPDATED, onSettingsUpdated)
    window.removeEventListener(EVENTS.ACTIVITY_STATE_CHANGED, onActivityChanged)
    window.removeEventListener('pacer-activity-dismiss-key', onDismissActivityKey)
    window.removeEventListener('storage', onStorage)
    if (tickId.value) clearInterval(tickId.value)
})
</script>
