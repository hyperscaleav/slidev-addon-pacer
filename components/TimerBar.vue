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

        <ActivityTimerNav :activity-active="!!activeActivity" :current-time="currentTime"
            :activity-end-time="activityEndTime" @start-activity="raiseActivity"
            @dismiss-activity="dismissActivity" />

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
import ActivityTimerNav from './ActivityTimerNav.vue'
import {
    CONFIG_KEY,
    STORAGE_KEYS,
    EVENTS,
    readSegmentValue,
    readSegmentBreaks,
    writeSegmentBreaks,
    readSegmentVisits,
    appendSegmentVisit,
    computeSegments,
    findSegmentForPage,
    newBreakId,
    newVisitId,
    getSlideTitle,
    readActivity,
    writeActivity,
    newActivityId,
    DEFAULT_TIMER_POS,
} from '../utils/constants'

const { PRESENTATION_STARTS, TARGET_COMPLETIONS, SLIDE_VISITS, BREAKS } = STORAGE_KEYS

const currentTime = ref(Date.now())
const intervalId = ref(null)
const presentationStartTime = ref(null)
const targetCompletionTime = ref(null)
// Visit log per segment: { [segIdx]: [...persisted visit entries] }.
const segmentVisits = ref({})
// The visit currently in progress, or null while paused (e.g. during a
// break). When a slide transition happens this gets flushed to
// segmentVisits + persisted via appendSegmentVisit.
const currentVisit = ref(null)
const segmentBreaks = ref([])
const activeActivity = ref(null)

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

const loadAllSegmentVisits = () => {
    const next = {}
    for (const seg of segments.value) {
        next[seg.index] = readSegmentVisits(seg.index)
    }
    segmentVisits.value = next
}

const activeBreak = computed(() => segmentBreaks.value.find(b => b.raisedAt && !b.dismissedAt) ?? null)

const nextBreak = computed(() => {
    return segmentBreaks.value.find(b => !b.dismissedAt && !b.raisedAt) ?? null
})

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

const segmentTotalBreakMinutes = computed(() => {
    return segmentBreaks.value.reduce((sum, b) => sum + b.durationMinutes, 0)
})

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

// { slideNumber: totalSeconds } from the persisted visit log for the
// CURRENT segment only. Excludes the visit-in-progress; the live counter
// adds that on top.
const slideTotalsThisSegment = computed(() => {
    const segIdx = currentSegment.value.index
    const visits = segmentVisits.value[segIdx] ?? []
    const totals = {}
    for (const v of visits) {
        const sec = Math.max(0, (v.endedAt - v.startedAt) / 1000)
        totals[v.slideNumber] = (totals[v.slideNumber] || 0) + sec
    }
    return totals
})

const currentSlideElapsed = computed(() => {
    const slideNum = $slidev.nav.currentPage
    const fromLog = slideTotalsThisSegment.value[slideNum] || 0

    if (!currentVisit.value || currentVisit.value.slideNumber !== slideNum) return fromLog
    if (!presentationHasStarted.value || activeBreak.value) return fromLog

    const effectiveStart = Math.max(
        currentVisit.value.startedAt,
        presentationStartTime.value || currentVisit.value.startedAt
    )
    const liveSec = Math.max(0, (currentTime.value - effectiveStart) / 1000)
    return fromLog + liveSec
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

const schedulingDeltaMinutes = computed(() => {
    if (!targetCompletionTime.value) return 0
    const totalPlannedMs = (segmentTotalPlannedMinutes.value + segmentTotalBreakMinutes.value) * 60 * 1000
    const start = presentationStartTime.value ?? Date.now()
    return (targetCompletionTime.value - start - totalPlannedMs) / 60000
})

const dynamicBankingMinutes = computed(() => {
    if (!presentationHasStarted.value) return 0
    const seg = currentSegment.value
    const totals = slideTotalsThisSegment.value
    const lastCompletedIdx = Math.min($slidev.nav.currentPage - 2, seg.end)
    let dynamic = 0
    for (let idx = seg.start; idx <= lastCompletedIdx; idx++) {
        const slideNum = idx + 1
        const plannedMin = slideTimes.value[idx] || 2
        const actualMin = (totals[slideNum] || 0) / 60
        dynamic += plannedMin - actualMin
    }
    return dynamic
})

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

const projectedLanding = computed(() => {
    if (!nextBreak.value) return { page: null, title: '' }

    const msUntil = nextBreak.value.startTime - currentTime.value
    if (msUntil <= 0) {
        const slide = $slidev.nav.slides[$slidev.nav.currentPage - 1]
        return {
            page: $slidev.nav.currentPage,
            title: getSlideTitle(slide, $slidev.nav.currentPage),
        }
    }

    let remainingMin = msUntil / 60000
    const seg = currentSegment.value
    const currentIdx = $slidev.nav.currentPage - 1

    const elapsedMin = currentSlideElapsed.value / 60
    const planMin = slideTimes.value[currentIdx] || 2
    const leftOnCurrent = Math.max(0, planMin - elapsedMin)

    if (remainingMin <= leftOnCurrent) {
        const slide = $slidev.nav.slides[currentIdx]
        return {
            page: currentIdx + 1,
            title: getSlideTitle(slide, currentIdx + 1),
        }
    }
    remainingMin -= leftOnCurrent

    for (let idx = currentIdx + 1; idx <= seg.end; idx++) {
        const plan = slideTimes.value[idx] || 2
        if (remainingMin <= plan) {
            const slide = $slidev.nav.slides[idx]
            return {
                page: idx + 1,
                title: getSlideTitle(slide, idx + 1),
            }
        }
        remainingMin -= plan
    }

    return { page: null, title: '(after segment ends)' }
})

// Open a new visit for the slide the presenter is currently on.
const startCurrentVisit = () => {
    const slideIdx = $slidev.nav.currentPage - 1
    const slide = $slidev.nav.slides[slideIdx]
    const seg = findSegmentForPage(segments.value, $slidev.nav.currentPage)
    currentVisit.value = {
        id: newVisitId(),
        slideNumber: $slidev.nav.currentPage,
        title: getSlideTitle(slide, $slidev.nav.currentPage),
        segmentIndex: seg.index,
        segmentLabel: seg.label,
        plannedMinutes: slideTimes.value[slideIdx] || 2,
        startedAt: Date.now(),
    }
}

// Close the visit-in-progress and append it to the persisted log. Called
// on slide transitions, break raises, and unmount. Skips logging if the
// presentation never started, or if clamping startedAt to the
// presentation start eats the entire visit.
const endCurrentVisit = () => {
    if (!currentVisit.value) return
    if (!presentationHasStarted.value) {
        currentVisit.value = null
        return
    }
    const endedAt = Date.now()
    const startedAt = Math.max(
        currentVisit.value.startedAt,
        presentationStartTime.value || currentVisit.value.startedAt
    )
    if (endedAt <= startedAt) {
        currentVisit.value = null
        return
    }
    const visit = {
        id: currentVisit.value.id,
        slideNumber: currentVisit.value.slideNumber,
        title: currentVisit.value.title,
        segmentIndex: currentVisit.value.segmentIndex,
        segmentLabel: currentVisit.value.segmentLabel,
        plannedMinutes: currentVisit.value.plannedMinutes,
        startedAt,
        endedAt,
    }
    appendSegmentVisit(visit.segmentIndex, visit)
    segmentVisits.value = {
        ...segmentVisits.value,
        [visit.segmentIndex]: [...(segmentVisits.value[visit.segmentIndex] || []), visit],
    }
    currentVisit.value = null
}

const raiseBreak = () => {
    if (!nextBreak.value) return
    endCurrentVisit()

    const updated = segmentBreaks.value.map(b =>
        b.id === nextBreak.value.id ? { ...b, raisedAt: Date.now() } : b
    )
    writeSegmentBreaks(currentSegment.value.index, updated)
    segmentBreaks.value = updated
    window.dispatchEvent(new CustomEvent(EVENTS.BREAK_STATE_CHANGED, {
        detail: { activeBreak: updated.find(b => b.id === nextBreak.value.id) },
    }))
}

const raiseBreakNow = (durationMinutes) => {
    if (activeBreak.value) return
    endCurrentVisit()

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

const activityEndTime = computed(() => {
    if (!activeActivity.value) return null
    return activeActivity.value.startedAt + activeActivity.value.durationMinutes * 60 * 1000
})

const raiseActivity = (durationMinutes) => {
    const activity = {
        id: newActivityId(),
        startedAt: Date.now(),
        durationMinutes,
        ...DEFAULT_TIMER_POS,
    }
    writeActivity(activity)
    activeActivity.value = activity
}

const dismissActivity = () => {
    writeActivity(null)
    activeActivity.value = null
}

// Keep the nav chip in sync when the activity is started or dismissed from
// anywhere else (the overlay's Done button, another window). Without this
// the chip keeps counting after the overlay is dismissed.
const onActivityChanged = (event) => {
    activeActivity.value = event.detail?.activity ?? null
}

const dismissBreak = () => {
    if (!activeBreak.value) return
    const activeId = activeBreak.value.id
    const updated = segmentBreaks.value.map(b =>
        b.id === activeId ? { ...b, dismissedAt: Date.now() } : b
    )
    writeSegmentBreaks(currentSegment.value.index, updated)
    segmentBreaks.value = updated
    // Resume by opening a fresh visit for the slide the presenter is on.
    startCurrentVisit()
    window.dispatchEvent(new CustomEvent(EVENTS.BREAK_STATE_CHANGED, {
        detail: { activeBreak: null },
    }))
}

const onDismissKey = () => {
    if (activeBreak.value) dismissBreak()
}

const handleSettingsUpdated = (event) => {
    const { key, segmentIndex } = event.detail
    if (key === SLIDE_VISITS) {
        // Visit log mutated externally (e.g. cleared from settings, or a
        // dismiss in another window). Refresh our cache.
        loadAllSegmentVisits()
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

// Page change: end the visit-in-progress, open a new one for the next
// slide (unless a break is active, in which case we stay paused).
watch(() => $slidev.nav.currentPage, (newPage, oldPage) => {
    if (oldPage !== undefined && oldPage !== newPage) {
        endCurrentVisit()
    }
    if (!activeBreak.value) {
        startCurrentVisit()
    }
}, { immediate: true })

onMounted(() => {
    loadSegmentSettings()
    loadSegmentBreaks()
    loadAllSegmentVisits()
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)
    window.addEventListener('pacer-break-dismiss-key', onDismissKey)
    window.addEventListener(EVENTS.ACTIVITY_STATE_CHANGED, onActivityChanged)
    activeActivity.value = readActivity()

    intervalId.value = setInterval(() => {
        currentTime.value = Date.now()
    }, 1000)
})

onUnmounted(() => {
    endCurrentVisit()
    window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)
    window.removeEventListener('pacer-break-dismiss-key', onDismissKey)
    window.removeEventListener(EVENTS.ACTIVITY_STATE_CHANGED, onActivityChanged)
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
