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
            :dynamic-banking-minutes="dynamicBankingMinutes" :time-delta-info="timeDeltaInfo" />

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
import { CONFIG_KEY, STORAGE_KEYS, EVENTS } from '../utils/constants'

const { PRESENTATION_START, TARGET_COMPLETION, SLIDE_TIMES } = STORAGE_KEYS

// Reactive data
const currentTime = ref(Date.now())
const intervalId = ref(null)
const presentationStartTime = ref(null)
const targetCompletionTime = ref(null)
const slideStartTime = ref(Date.now())

// Load data from localStorage
const loadStoredData = () => {
    const startTime = localStorage.getItem(PRESENTATION_START)
    if (startTime) {
        presentationStartTime.value = parseInt(startTime)
    }

    const targetTime = localStorage.getItem(TARGET_COMPLETION)
    if (targetTime) {
        targetCompletionTime.value = parseInt(targetTime)
    }
}

// Check if presentation has started
const presentationHasStarted = computed(() => {
    if (!presentationStartTime.value) return true // No start time set, consider started
    return currentTime.value >= presentationStartTime.value
})

// Get slide times from configuration
const slideTimes = computed(() => {
    const slides = $slidev.nav.slides
    const defaultSlideTime = $slidev.configs?.[CONFIG_KEY]?.defaultSlideTime || 2

    return slides.map(slide => {
        const slideTime = slide.meta.slide.frontmatter?.slideTime
        const time = slideTime !== undefined ? parseFloat(slideTime) : defaultSlideTime
        return !isNaN(time) && time > 0 ? time : defaultSlideTime
    })
})

// Current slide elapsed time - calculated directly here, no delegation needed
const currentSlideElapsed = computed(() => {
    const slideNum = $slidev.nav.currentPage
    const storedTime = slideElapsedTimes.value[slideNum] || 0

    // Only count session time if presentation has started
    if (!presentationHasStarted.value) {
        return storedTime
    }

    // Calculate session time, but only from when presentation actually started
    // If slideStartTime is before presentation start, use presentation start time instead
    const effectiveStartTime = Math.max(slideStartTime.value, presentationStartTime.value || slideStartTime.value)
    const sessionTime = Math.max(0, (currentTime.value - effectiveStartTime) / 1000)

    return storedTime + sessionTime
})

// Current slide planned time in minutes
const currentSlidePlannedMinutes = computed(() => {
    const currentSlideIndex = $slidev.nav.currentPage - 1
    return slideTimes.value[currentSlideIndex] || 2
})

// Number of completed slides
const completedSlides = computed(() => {
    return Math.max(0, $slidev.nav.currentPage - 1)
})

// Reactive slide elapsed times that updates when localStorage changes
const slideElapsedTimes = ref({})

// Function to load slide elapsed times
const loadSlideElapsedTimes = () => {
    try {
        const saved = localStorage.getItem(SLIDE_TIMES)
        slideElapsedTimes.value = saved ? JSON.parse(saved) : {}
    } catch (e) {
        slideElapsedTimes.value = {}
    }
}

// Start timing for current slide
const startSlideTimer = () => {
    // If presentation hasn't started yet, set slide start time to presentation start time
    // This ensures we don't count time before the presentation begins
    if (!presentationHasStarted.value && presentationStartTime.value) {
        slideStartTime.value = presentationStartTime.value
    } else {
        // Reset the slide start time to current time for accurate session tracking
        slideStartTime.value = currentTime.value
    }
}

// Save current slide time 
const saveCurrentSlideTime = () => {
    const slideNum = $slidev.nav.currentPage

    // Use our calculated current slide elapsed time
    const totalElapsedTime = currentSlideElapsed.value

    // Store the elapsed time for this slide
    slideElapsedTimes.value[slideNum] = totalElapsedTime
    localStorage.setItem(SLIDE_TIMES, JSON.stringify(slideElapsedTimes.value))
}

// Banked time calculation: net time advantage/deficit relative to target
// Bank = (Target - Start - TotalPlannedTime) + SlidePerformanceDelta
const bankedTimeMinutes = computed(() => {
    let bankedTime = 0

    // 1. Base scheduling delta: (Target - Start - TotalPlannedTime)
    // This is the fundamental time buffer/deficit built into the schedule
    if (targetCompletionTime.value && presentationStartTime.value) {
        const totalPlannedMinutes = slideTimes.value.reduce((sum, slideTime) => sum + slideTime, 0)
        const totalPlannedMs = totalPlannedMinutes * 60 * 1000
        const schedulingDeltaMs = targetCompletionTime.value - presentationStartTime.value - totalPlannedMs
        bankedTime += schedulingDeltaMs / (60 * 1000)
    } else if (targetCompletionTime.value && !presentationStartTime.value) {
        // Before presentation starts, calculate theoretical delta from current time
        const totalPlannedMinutes = slideTimes.value.reduce((sum, slideTime) => sum + slideTime, 0)
        const totalPlannedMs = totalPlannedMinutes * 60 * 1000
        const schedulingDeltaMs = targetCompletionTime.value - Date.now() - totalPlannedMs
        bankedTime += schedulingDeltaMs / (60 * 1000)
    }

    // 2. Dynamic banking: For completed slides, add performance delta (planned - actual)
    // Only add this if presentation has started
    if (presentationHasStarted.value) {
        for (let i = 1; i < $slidev.nav.currentPage; i++) {
            const plannedMinutes = slideTimes.value[i - 1] || 2
            const actualMinutes = (slideElapsedTimes.value[i] || 0) / 60
            const delta = plannedMinutes - actualMinutes  // positive = saved time, negative = over time
            bankedTime += delta
        }
    }

    // Current slide is NOT included in banking - this shows only completed slides
    // This way you can see: +10 mins banked, -5 mins on current slide = 5 mins ahead overall

    return bankedTime
})

// Breakdown components for detailed tooltip
const schedulingDeltaMinutes = computed(() => {
    if (!targetCompletionTime.value) {
        return 0
    }

    const totalPlannedMinutes = slideTimes.value.reduce((sum, slideTime) => sum + slideTime, 0)

    if (presentationStartTime.value) {
        // If presentation has started, calculate: Target - Start - TotalPlannedTime
        const totalPlannedMs = totalPlannedMinutes * 60 * 1000
        const schedulingDeltaMs = targetCompletionTime.value - presentationStartTime.value - totalPlannedMs
        return schedulingDeltaMs / (60 * 1000)
    } else {
        // If presentation hasn't started, calculate: Target - Now - TotalPlannedTime
        const totalPlannedMs = totalPlannedMinutes * 60 * 1000
        const schedulingDeltaMs = targetCompletionTime.value - Date.now() - totalPlannedMs
        return schedulingDeltaMs / (60 * 1000)
    }
})

const dynamicBankingMinutes = computed(() => {
    if (!presentationHasStarted.value) {
        return 0
    }

    let dynamicBanking = 0
    for (let i = 1; i < $slidev.nav.currentPage; i++) {
        const plannedMinutes = slideTimes.value[i - 1] || 2
        const actualMinutes = (slideElapsedTimes.value[i] || 0) / 60
        const delta = plannedMinutes - actualMinutes
        dynamicBanking += delta
    }
    return dynamicBanking
})

// Remaining time for all remaining slides (including current)
const remainingTimeMinutes = computed(() => {
    let remainingTime = 0

    // Add planned time for current slide and all future slides
    for (let i = $slidev.nav.currentPage - 1; i < slideTimes.value.length; i++) {
        remainingTime += slideTimes.value[i] || 2
    }

    // Subtract time already spent on current slide
    const currentSlideActualMinutes = currentSlideElapsed.value / 60
    remainingTime -= currentSlideActualMinutes

    return Math.max(0, remainingTime)
})

// Estimated end time
const estimatedEndTime = computed(() => {
    // We need either presentation start time or current time to calculate
    if (!presentationStartTime.value && !targetCompletionTime.value) {
        return null
    }

    if (presentationHasStarted.value && presentationStartTime.value) {
        // Presentation has started - calculate: CurrentTime + RemainingTime
        // This shows when we'll actually finish based on current performance
        const remainingMs = remainingTimeMinutes.value * 60 * 1000
        return new Date(currentTime.value + remainingMs)
    } else if (presentationStartTime.value) {
        // Presentation hasn't started but we have a start time - show theoretical end time
        const totalPlannedMinutes = slideTimes.value.reduce((sum, slideTime) => sum + slideTime, 0)
        const totalPlannedMs = totalPlannedMinutes * 60 * 1000
        return new Date(presentationStartTime.value + totalPlannedMs)
    } else if (targetCompletionTime.value) {
        // No start time set, but we have a target - show theoretical end based on current time
        const totalPlannedMinutes = slideTimes.value.reduce((sum, slideTime) => sum + slideTime, 0)
        const totalPlannedMs = totalPlannedMinutes * 60 * 1000
        return new Date(currentTime.value + totalPlannedMs)
    }

    return null
})

// Time delta between estimated end time and target completion time
// This should equal bankedTimeMinutes: EstimatedEnd - Target = Banking
const timeDeltaInfo = computed(() => {
    if (!targetCompletionTime.value || !estimatedEndTime.value) {
        return { show: false, delta: 0, formattedDelta: '' }
    }

    const deltaMs = estimatedEndTime.value.getTime() - targetCompletionTime.value
    const deltaMinutes = deltaMs / (60 * 1000)

    // This delta should equal bankedTimeMinutes (EstimatedEnd - Target = Banking)
    // Format the delta as +/- minutes, but keep precise calculation
    let formattedDelta
    if (Math.abs(deltaMinutes) < 1) {
        // Less than a minute difference
        formattedDelta = `${deltaMinutes > 0 ? '+' : '-'}${Math.abs(Math.round(deltaMinutes * 60))}s`
    } else if (Math.abs(deltaMinutes) < 60) {
        // Less than an hour
        formattedDelta = `${deltaMinutes > 0 ? '+' : '-'}${Math.abs(Math.round(deltaMinutes))}m`
    } else {
        // Hours and minutes
        const hours = Math.floor(Math.abs(deltaMinutes) / 60)
        const minutes = Math.round(Math.abs(deltaMinutes) % 60)
        formattedDelta = `${deltaMinutes > 0 ? '+' : '-'}${hours}h${minutes > 0 ? ' ' + minutes + 'm' : ''}`
    }

    return {
        show: true,
        delta: deltaMinutes, // Keep precise delta for calculations
        formattedDelta: formattedDelta
    }
})

// Listen for in-window settings changes from SettingsDialog
const handleSettingsUpdated = (event) => {
    const { key, value } = event.detail
    if (key === PRESENTATION_START) {
        presentationStartTime.value = value ? parseInt(value) : null
    } else if (key === TARGET_COMPLETION) {
        targetCompletionTime.value = value ? parseInt(value) : null
    } else if (key === SLIDE_TIMES) {
        loadSlideElapsedTimes()
    }
}

// Watch for slide changes
watch(() => $slidev.nav.currentPage, (newPage, oldPage) => {
    if (oldPage !== undefined) {
        // Save the time for the slide we're leaving (oldPage)
        const slideNum = oldPage

        // Calculate total elapsed time for the slide we're leaving
        // CRITICAL: Use the current elapsed time calculation to avoid timing jumps
        const previousStoredTime = slideElapsedTimes.value[slideNum] || 0
        let sessionTime = 0
        if (presentationHasStarted.value) {
            sessionTime = (currentTime.value - slideStartTime.value) / 1000
        }
        const totalElapsedTime = previousStoredTime + sessionTime

        // Store the final time for this slide
        slideElapsedTimes.value[slideNum] = totalElapsedTime
        localStorage.setItem(SLIDE_TIMES, JSON.stringify(slideElapsedTimes.value))
    }

    // Start timing for the new slide AFTER saving the old one
    startSlideTimer()
}, { immediate: true })

// Setup and cleanup
onMounted(() => {
    loadStoredData()
    loadSlideElapsedTimes() // Load slide elapsed times for banking calculations
    startSlideTimer() // Initialize slide timer
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSettingsUpdated)

    // Update current time every second
    intervalId.value = setInterval(() => {
        currentTime.value = Date.now()
    }, 1000)
})

onUnmounted(() => {
    saveCurrentSlideTime() // Save current slide time before unmounting
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
