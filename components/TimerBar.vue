<template>
    <div v-if="$slidev.nav.isPresenter" class="timer-bar">
        <div class="w-1px opacity-10 bg-current m-1 lg:m-2"></div>

        <PresentationTimer :presentation-start-time="presentationStartTime"
            :presentation-has-started="presentationHasStarted" :current-time="currentTime" />

        <SlideTimerNav :current-slide-elapsed="currentSlideElapsed"
            :current-slide-planned-minutes="currentSlidePlannedMinutes"
            :presentation-has-started="presentationHasStarted" />

        <BankedTimeNav :banked-time-minutes="bankedTimeMinutes" :presentation-start-time="presentationStartTime"
            :completed-slides="completedSlides" :scheduling-delta-minutes="schedulingDeltaMinutes"
            :dynamic-banking-minutes="dynamicBankingMinutes" :time-delta-info="timeDeltaInfo"
            :segment-label="currentSegment.label" />

        <EstimatedEndTimeNav :estimated-end-time="estimatedEndTime" :banked-time-minutes="bankedTimeMinutes"
            :remaining-time-minutes="remainingTimeMinutes" :target-completion-time="targetCompletionTime"
            :presentation-start-time="presentationStartTime" :current-slide-elapsed="currentSlideElapsed"
            :current-time="currentTime" />

        <TargetCompletionTime :target-completion-time="targetCompletionTime" />

        <div class="w-1px opacity-10 bg-current m-1 lg:m-2"></div>
    </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import PresentationTimer from './PresentationTimer.vue'
import SlideTimerNav from './SlideTimerNav.vue'
import BankedTimeNav from './BankedTimeNav.vue'
import EstimatedEndTimeNav from './EstimatedEndTimeNav.vue'
import TargetCompletionTime from './TargetCompletionTime.vue'
import {
    CONFIG_KEY,
    STORAGE_KEYS,
    EVENTS,
    readSegmentValue,
    computeSegments,
    findSegmentForPage,
} from '../utils/constants'

const { PRESENTATION_STARTS, TARGET_COMPLETIONS, SLIDE_TIMES } = STORAGE_KEYS

const currentTime = ref(Date.now())
const intervalId = ref(null)
const presentationStartTime = ref(null)
const targetCompletionTime = ref(null)
const slideStartTime = ref(Date.now())
const slideElapsedTimes = ref({})

// Segment list, derived from slide frontmatter (pacerBoundary: true).
// A deck without boundaries gets a single segment spanning everything.
const segments = computed(() => computeSegments($slidev.nav.slides))

// Segment containing the current slide.
const currentSegment = computed(() => findSegmentForPage(segments.value, $slidev.nav.currentPage))

// Pull start/target for the active segment out of localStorage.
const loadSegmentSettings = () => {
    const segIdx = currentSegment.value.index
    const start = readSegmentValue(PRESENTATION_STARTS, segIdx)
    const target = readSegmentValue(TARGET_COMPLETIONS, segIdx)
    presentationStartTime.value = start ? parseInt(start) : null
    targetCompletionTime.value = target ? parseInt(target) : null
}

const presentationHasStarted = computed(() => {
    if (!presentationStartTime.value) return true
    return currentTime.value >= presentationStartTime.value
})

const slideTimes = computed(() => {
    const slides = $slidev.nav.slides
    const defaultSlideTime = $slidev.configs?.[CONFIG_KEY]?.defaultSlideTime || 2

    return slides.map(slide => {
        const slideTime = slide.meta.slide.frontmatter?.slideTime
        const time = slideTime !== undefined ? parseFloat(slideTime) : defaultSlideTime
        return !isNaN(time) && time > 0 ? time : defaultSlideTime
    })
})

// Planned minutes for slides in the current segment only.
const segmentTotalPlannedMinutes = computed(() => {
    const seg = currentSegment.value
    let total = 0
    for (let i = seg.start; i <= seg.end; i++) {
        total += slideTimes.value[i] || 2
    }
    return total
})

const currentSlideElapsed = computed(() => {
    const slideNum = $slidev.nav.currentPage
    const storedTime = slideElapsedTimes.value[slideNum] || 0

    if (!presentationHasStarted.value) {
        return storedTime
    }

    // If slideStartTime predates presentation start, clamp to presentation start
    // so we don't count time spent on a slide before the presentation began.
    const effectiveStartTime = Math.max(slideStartTime.value, presentationStartTime.value || slideStartTime.value)
    const sessionTime = Math.max(0, (currentTime.value - effectiveStartTime) / 1000)

    return storedTime + sessionTime
})

const currentSlidePlannedMinutes = computed(() => {
    const currentSlideIndex = $slidev.nav.currentPage - 1
    return slideTimes.value[currentSlideIndex] || 2
})

// Slides in the current segment that the presenter has already passed.
const completedSlides = computed(() => {
    const seg = currentSegment.value
    const passedAbsolute = Math.max(0, $slidev.nav.currentPage - 1)
    return Math.max(0, Math.min(passedAbsolute, seg.end + 1) - seg.start)
})

const loadSlideElapsedTimes = () => {
    try {
        const saved = localStorage.getItem(SLIDE_TIMES)
        slideElapsedTimes.value = saved ? JSON.parse(saved) : {}
    } catch (e) {
        slideElapsedTimes.value = {}
    }
}

const startSlideTimer = () => {
    if (!presentationHasStarted.value && presentationStartTime.value) {
        slideStartTime.value = presentationStartTime.value
    } else {
        slideStartTime.value = currentTime.value
    }
}

const saveCurrentSlideTime = () => {
    const slideNum = $slidev.nav.currentPage
    slideElapsedTimes.value[slideNum] = currentSlideElapsed.value
    localStorage.setItem(SLIDE_TIMES, JSON.stringify(slideElapsedTimes.value))
}

// Scheduling delta scoped to current segment:
// (segmentTarget - segmentStart - segmentPlannedTotal)
const schedulingDeltaMinutes = computed(() => {
    if (!targetCompletionTime.value) return 0
    const totalPlannedMs = segmentTotalPlannedMinutes.value * 60 * 1000
    const start = presentationStartTime.value ?? Date.now()
    const schedulingDeltaMs = targetCompletionTime.value - start - totalPlannedMs
    return schedulingDeltaMs / (60 * 1000)
})

// Dynamic banking scoped to current segment: sum of (planned - actual) for
// slides in this segment that have been completed.
const dynamicBankingMinutes = computed(() => {
    if (!presentationHasStarted.value) return 0
    const seg = currentSegment.value
    const lastCompletedIdx = Math.min($slidev.nav.currentPage - 2, seg.end)
    let dynamic = 0
    for (let idx = seg.start; idx <= lastCompletedIdx; idx++) {
        const slideNum = idx + 1
        const planned = slideTimes.value[idx] || 2
        const actual = (slideElapsedTimes.value[slideNum] || 0) / 60
        dynamic += planned - actual
    }
    return dynamic
})

const bankedTimeMinutes = computed(() => schedulingDeltaMinutes.value + dynamicBankingMinutes.value)

// Remaining time in current segment: planned time for current slide and
// the rest of this segment, minus what the presenter has already spent
// on the current slide.
const remainingTimeMinutes = computed(() => {
    const seg = currentSegment.value
    const startIdx = Math.max($slidev.nav.currentPage - 1, seg.start)
    let remaining = 0
    for (let i = startIdx; i <= seg.end; i++) {
        remaining += slideTimes.value[i] || 2
    }
    const currentInSegment = $slidev.nav.currentPage - 1 >= seg.start && $slidev.nav.currentPage - 1 <= seg.end
    if (currentInSegment) {
        remaining -= currentSlideElapsed.value / 60
    }
    return Math.max(0, remaining)
})

// Estimated end time for the CURRENT segment.
const estimatedEndTime = computed(() => {
    if (!presentationStartTime.value && !targetCompletionTime.value) return null

    if (presentationHasStarted.value && presentationStartTime.value) {
        const remainingMs = remainingTimeMinutes.value * 60 * 1000
        return new Date(currentTime.value + remainingMs)
    }
    const totalPlannedMs = segmentTotalPlannedMinutes.value * 60 * 1000
    if (presentationStartTime.value) {
        return new Date(presentationStartTime.value + totalPlannedMs)
    }
    if (targetCompletionTime.value) {
        return new Date(currentTime.value + totalPlannedMs)
    }
    return null
})

// Banking == EstimatedEnd - Target. This delta is shown on the banked-time chip.
const timeDeltaInfo = computed(() => {
    if (!targetCompletionTime.value || !estimatedEndTime.value) {
        return { show: false, delta: 0, formattedDelta: '' }
    }

    const deltaMs = estimatedEndTime.value.getTime() - targetCompletionTime.value
    const deltaMinutes = deltaMs / (60 * 1000)

    let formattedDelta
    if (Math.abs(deltaMinutes) < 1) {
        formattedDelta = `${deltaMinutes > 0 ? '+' : '-'}${Math.abs(Math.round(deltaMinutes * 60))}s`
    } else if (Math.abs(deltaMinutes) < 60) {
        formattedDelta = `${deltaMinutes > 0 ? '+' : '-'}${Math.abs(Math.round(deltaMinutes))}m`
    } else {
        const hours = Math.floor(Math.abs(deltaMinutes) / 60)
        const minutes = Math.round(Math.abs(deltaMinutes) % 60)
        formattedDelta = `${deltaMinutes > 0 ? '+' : '-'}${hours}h${minutes > 0 ? ' ' + minutes + 'm' : ''}`
    }

    return { show: true, delta: deltaMinutes, formattedDelta }
})

const handleSettingsUpdated = (event) => {
    const { key, segmentIndex } = event.detail
    if (key === SLIDE_TIMES) {
        loadSlideElapsedTimes()
    } else if (key === PRESENTATION_STARTS || key === TARGET_COMPLETIONS) {
        if (segmentIndex === currentSegment.value.index) {
            loadSegmentSettings()
        }
    }
}

// Reload segment-scoped settings whenever the current segment changes.
watch(() => currentSegment.value.index, loadSegmentSettings)

watch(() => $slidev.nav.currentPage, (newPage, oldPage) => {
    if (oldPage !== undefined) {
        const slideNum = oldPage
        const previousStoredTime = slideElapsedTimes.value[slideNum] || 0
        let sessionTime = 0
        if (presentationHasStarted.value) {
            sessionTime = (currentTime.value - slideStartTime.value) / 1000
        }
        slideElapsedTimes.value[slideNum] = previousStoredTime + sessionTime
        localStorage.setItem(SLIDE_TIMES, JSON.stringify(slideElapsedTimes.value))
    }
    startSlideTimer()
}, { immediate: true })

onMounted(() => {
    loadSegmentSettings()
    loadSlideElapsedTimes()
    startSlideTimer()
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)

    intervalId.value = setInterval(() => {
        currentTime.value = Date.now()
    }, 1000)
})

onUnmounted(() => {
    saveCurrentSlideTime()
    window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)
    if (intervalId.value) {
        clearInterval(intervalId.value)
    }
})
</script>

<style scoped>
.timer-bar {
    display: contents;
}
</style>
