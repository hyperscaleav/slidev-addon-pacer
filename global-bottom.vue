<template>
    <BreakOverlay :active-break="activeBreak" :current-time="currentTime" @dismiss="dismissActiveBreak" />
    <ActivityTimer :active-activity="activeActivity" :current-time="currentTime"
        :can-control="$slidev.nav.isPresenter" />
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BreakOverlay from './components/BreakOverlay.vue'
import ActivityTimer from './components/ActivityTimer.vue'
import {
    STORAGE_KEYS,
    EVENTS,
    readSegmentBreaks,
    writeSegmentBreaks,
    computeSegments,
    readActivity,
} from './utils/constants'

// The break overlay and the activity timer both render on BOTH presenter
// and audience windows. TimerBar only mounts in presenter view, so these
// live here and derive their own state from localStorage. Cross-window
// sync rides on the browser's real `storage` event; same-window sync on
// CustomEvents. The activity timer is draggable in the presenter window
// (can-control) and mirrors position/size on the audience window.

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
    window.addEventListener('storage', onStorage)
    tickId.value = setInterval(() => {
        currentTime.value = Date.now()
    }, 1000)
})

onUnmounted(() => {
    window.removeEventListener(EVENTS.SETTINGS_UPDATED, onSettingsUpdated)
    window.removeEventListener(EVENTS.ACTIVITY_STATE_CHANGED, onActivityChanged)
    window.removeEventListener('storage', onStorage)
    if (tickId.value) clearInterval(tickId.value)
})
</script>
