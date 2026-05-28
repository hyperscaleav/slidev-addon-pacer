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

        <BreakTimerNav :next-break="nextBreak" :is-break-due="isBreakDue" :current-time="currentTime"
            :projected-landing-page="projectedLanding.page" :projected-landing-title="projectedLanding.title"
            @raise-break="raiseBreak" />

        <BreakNowNav :break-active="!!activeBreak" @break-now="raiseBreakNow" />

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
import BreakTimerNav from './BreakTimerNav.vue'
import BreakNowNav from './BreakNowNav.vue'
import {
    CONFIG_KEY,
    STORAGE_KEYS,
    EVENTS,
    readSegmentValue,
    readSegmentBreaks,
    writeSegmentBreaks,
    computeSegments,
    findSegmentForPage,
    newBreakId,
} from '../utils/constants'

const { PRESENTATION_STARTS, TARGET_COMPLETIONS, SLIDE_TIMES, BREAKS } = STORAGE_KEYS

const currentTime = ref(Date.now())
const intervalId = ref(null)
const presentationStartTime = ref(null)
const targetCompletionTime = ref(null)
const slideStartTime = ref(Date.now())
const slideElapsedTimes = ref({})
const segmentBreaks = ref([])

const segments = computed(() => computeSegments($slidev.nav.slides))
const currentSegment = computed(() => findSegmentForPage(segments.value, $slidev.nav.currentPage))

const loadSegmentSettings = () => {
    const segIdx = currentSegment.value.index
    const start = readSegmentValue(PRESENTATION_STARTS, segIdx)
    const target = readSegmentValue(TARGET_COMPLETIONS, segIdx)
    presentationStartTime.value = start ? parseInt(start) : null
    targetCompletionTime.value = target ? parseInt(target) : null
}

const loadSegmentBreaks = () => {
    segmentBreaks.value = readSegmentBreaks(currentSegment.value.index)
}

// The single break that is currently raised (raisedAt set, not yet dismissed).
const activeBreak = computed(() => segmentBreaks.value.find(b => b.raisedAt && !b.dismissedAt) ?? null)

// First upcoming break that hasn't been dismissed yet, sorted by startTime.
const nextBreak = computed(() => {
    return segmentBreaks.value.find(b => !b.dismissedAt && !b.raisedAt) ?? null
})

// A break is "due" when its scheduled start has passed and nothing's active.
const isBreakDue = computed(() => {
    if (activeBreak.value || !nextBreak.value) return false
    return currentTime.value >= nextBreak.value.startTime
})

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

const segmentTotalPlannedMinutes = computed(() => {
    const seg = currentSegment.value
    let total = 0
    for (let i = seg.start; i <= seg.end; i++) {
        total += slideTimes.value[i] || 2
    }
    return total
})

// Sum of all break durations in the current segment (planned, not consumed).
const segmentTotalBreakMinutes = computed(() => {
    return segmentBreaks.value.reduce((sum, b) => sum + b.durationMinutes, 0)
})

// Time still to be spent on breaks: any unfinished portion of the active
// break plus the full duration of every still-upcoming (undismissed,
// unraised) break.
const unconsumedBreakMinutes = computed(() => {
    let mins = 0
    if (activeBreak.value) {
        const resumeAt = (activeBreak.value.raisedAt ?? activeBreak.value.startTime)
            + activeBreak.value.durationMinutes * 60 * 1000
        const remainingMs = Math.max(0, resumeAt - currentTime.value)
        mins += remainingMs / 60000
    }
    for (const b of segmentBreaks.value) {
        if (!b.raisedAt && !b.dismissedAt) {
            mins += b.durationMinutes
        }
    }
    return mins
})

// While a break is active the slide timer freezes. We achieve that by
// returning the stored elapsed time as-is.
const currentSlideElapsed = computed(() => {
    const slideNum = $slidev.nav.currentPage
    const storedTime = slideElapsedTimes.value[slideNum] || 0

    if (!presentationHasStarted.value || activeBreak.value) {
        return storedTime
    }

    const effectiveStartTime = Math.max(slideStartTime.value, presentationStartTime.value || slideStartTime.value)
    const sessionTime = Math.max(0, (currentTime.value - effectiveStartTime) / 1000)
    return storedTime + sessionTime
})

const currentSlidePlannedMinutes = computed(() => {
    const currentSlideIndex = $slidev.nav.currentPage - 1
    return slideTimes.value[currentSlideIndex] || 2
})

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

// Scheduling delta: how much spare time the schedule has if everything
// ran exactly to plan, including all breaks.
const schedulingDeltaMinutes = computed(() => {
    if (!targetCompletionTime.value) return 0
    const totalPlannedMs = (segmentTotalPlannedMinutes.value + segmentTotalBreakMinutes.value) * 60 * 1000
    const start = presentationStartTime.value ?? Date.now()
    return (targetCompletionTime.value - start - totalPlannedMs) / 60000
})

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

// Banking == target - projected end. Computed as scheduling buffer plus
// slide performance plus break performance (overrun on a finished break
// subtracts; finishing early adds).
const breakPerformanceMinutes = computed(() => {
    let delta = 0
    for (const b of segmentBreaks.value) {
        if (b.raisedAt && b.dismissedAt) {
            const actualMs = b.dismissedAt - b.raisedAt
            const plannedMs = b.durationMinutes * 60 * 1000
            delta += (plannedMs - actualMs) / 60000
        }
    }
    return delta
})

const bankedTimeMinutes = computed(() =>
    schedulingDeltaMinutes.value + dynamicBankingMinutes.value + breakPerformanceMinutes.value
)

// Remaining presentation time in current segment (planned slide time only;
// break time is tracked separately so the ETA can add it back in).
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

const estimatedEndTime = computed(() => {
    if (!presentationStartTime.value && !targetCompletionTime.value) return null

    if (presentationHasStarted.value && presentationStartTime.value) {
        const remainingMs = (remainingTimeMinutes.value + unconsumedBreakMinutes.value) * 60 * 1000
        return new Date(currentTime.value + remainingMs)
    }
    const totalPlannedMs = (segmentTotalPlannedMinutes.value + segmentTotalBreakMinutes.value) * 60 * 1000
    if (presentationStartTime.value) {
        return new Date(presentationStartTime.value + totalPlannedMs)
    }
    if (targetCompletionTime.value) {
        return new Date(currentTime.value + totalPlannedMs)
    }
    return null
})

const timeDeltaInfo = computed(() => {
    if (!targetCompletionTime.value || !estimatedEndTime.value) {
        return { show: false, delta: 0, formattedDelta: '' }
    }
    const deltaMs = estimatedEndTime.value.getTime() - targetCompletionTime.value
    const deltaMinutes = deltaMs / 60000

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

// Walk forward from the current slide using planned slide times to find
// which slide the next break will probably land on. Returns { page, title }
// or { page: null } if the break falls past the end of the segment.
const projectedLanding = computed(() => {
    if (!nextBreak.value) return { page: null, title: '' }

    const msUntil = nextBreak.value.startTime - currentTime.value
    if (msUntil <= 0) {
        // Break is already due: it lands here.
        const slide = $slidev.nav.slides[$slidev.nav.currentPage - 1]
        return {
            page: $slidev.nav.currentPage,
            title: slide?.meta?.slide?.frontmatter?.title ?? '',
        }
    }

    let remainingMin = msUntil / 60000
    const seg = currentSegment.value
    const currentIdx = $slidev.nav.currentPage - 1

    // Time the presenter still has on this slide if they hit plan.
    const elapsedMin = currentSlideElapsed.value / 60
    const planMin = slideTimes.value[currentIdx] || 2
    const leftOnCurrent = Math.max(0, planMin - elapsedMin)

    if (remainingMin <= leftOnCurrent) {
        const slide = $slidev.nav.slides[currentIdx]
        return {
            page: currentIdx + 1,
            title: slide?.meta?.slide?.frontmatter?.title ?? '',
        }
    }
    remainingMin -= leftOnCurrent

    for (let idx = currentIdx + 1; idx <= seg.end; idx++) {
        const plan = slideTimes.value[idx] || 2
        if (remainingMin <= plan) {
            const slide = $slidev.nav.slides[idx]
            return {
                page: idx + 1,
                title: slide?.meta?.slide?.frontmatter?.title ?? '',
            }
        }
        remainingMin -= plan
    }

    return { page: null, title: '(after segment ends)' }
})

const raiseBreak = () => {
    if (!nextBreak.value) return
    // Snapshot the current slide's elapsed time before the timer pauses so
    // session time accumulated up to this point isn't lost.
    saveCurrentSlideTime()

    const updated = segmentBreaks.value.map(b =>
        b.id === nextBreak.value.id ? { ...b, raisedAt: Date.now() } : b
    )
    writeSegmentBreaks(currentSegment.value.index, updated)
    // The settings-updated event triggers loadSegmentBreaks via our handler,
    // but call it directly so the UI updates this tick.
    segmentBreaks.value = updated
    window.dispatchEvent(new CustomEvent(EVENTS.BREAK_STATE_CHANGED, {
        detail: { activeBreak: updated.find(b => b.id === nextBreak.value.id) },
    }))
}

// On-demand break: create a new break with startTime=now AND raisedAt=now,
// so the overlay raises immediately without needing a prior schedule entry.
const raiseBreakNow = (durationMinutes) => {
    if (activeBreak.value) return
    saveCurrentSlideTime()

    const now = Date.now()
    const newBreak = {
        id: newBreakId(),
        startTime: now,
        durationMinutes,
        raisedAt: now,
    }
    const updated = [...segmentBreaks.value, newBreak]
    writeSegmentBreaks(currentSegment.value.index, updated)
    segmentBreaks.value = updated
    window.dispatchEvent(new CustomEvent(EVENTS.BREAK_STATE_CHANGED, {
        detail: { activeBreak: newBreak },
    }))
}

const dismissBreak = () => {
    if (!activeBreak.value) return
    const activeId = activeBreak.value.id
    const updated = segmentBreaks.value.map(b =>
        b.id === activeId ? { ...b, dismissedAt: Date.now() } : b
    )
    writeSegmentBreaks(currentSegment.value.index, updated)
    segmentBreaks.value = updated
    // Reset slideStartTime so post-break session time accumulates from now,
    // not from when the slide was first visited.
    slideStartTime.value = Date.now()
    window.dispatchEvent(new CustomEvent(EVENTS.BREAK_STATE_CHANGED, {
        detail: { activeBreak: null },
    }))
}

// Allow the overlay's Escape-key handler to trigger dismiss.
const onDismissKey = () => {
    if (activeBreak.value) dismissBreak()
}

const handleSettingsUpdated = (event) => {
    const { key, segmentIndex } = event.detail
    if (key === SLIDE_TIMES) {
        loadSlideElapsedTimes()
    } else if (key === PRESENTATION_STARTS || key === TARGET_COMPLETIONS) {
        if (segmentIndex === currentSegment.value.index) {
            loadSegmentSettings()
        }
    } else if (key === BREAKS) {
        if (segmentIndex === currentSegment.value.index) {
            loadSegmentBreaks()
        }
    }
}

watch(() => currentSegment.value.index, () => {
    loadSegmentSettings()
    loadSegmentBreaks()
})

watch(() => $slidev.nav.currentPage, (newPage, oldPage) => {
    if (oldPage !== undefined) {
        const slideNum = oldPage
        const previousStoredTime = slideElapsedTimes.value[slideNum] || 0
        let sessionTime = 0
        if (presentationHasStarted.value && !activeBreak.value) {
            sessionTime = (currentTime.value - slideStartTime.value) / 1000
        }
        slideElapsedTimes.value[slideNum] = previousStoredTime + sessionTime
        localStorage.setItem(SLIDE_TIMES, JSON.stringify(slideElapsedTimes.value))
    }
    startSlideTimer()
}, { immediate: true })

onMounted(() => {
    loadSegmentSettings()
    loadSegmentBreaks()
    loadSlideElapsedTimes()
    startSlideTimer()
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)
    window.addEventListener('pacer-break-dismiss-key', onDismissKey)

    intervalId.value = setInterval(() => {
        currentTime.value = Date.now()
    }, 1000)
})

onUnmounted(() => {
    saveCurrentSlideTime()
    window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)
    window.removeEventListener('pacer-break-dismiss-key', onDismissKey)
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
