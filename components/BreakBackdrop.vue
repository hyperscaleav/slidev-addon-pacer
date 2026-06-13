<template>
    <!-- Fullscreen break screen, rendered behind the break card while a break
         is active. The deck points `pacer.breakScreen` at a slide route (e.g.
         "/ic26-loop"); we load it in an iframe so it lives in its own document:
         its components (the SlideLoop carousel) keep their own lifecycle and
         auto-advance, and it is completely independent of the presenter's own
         slide navigation in the parent window. -->
    <div v-if="activeBreak && breakScreen" class="break-backdrop">
        <iframe class="break-backdrop-frame" :src="frameSrc" frameborder="0"
            scrolling="no" title="Break screen" />
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { CONFIG_KEY } from '../utils/constants'

const props = defineProps({
    activeBreak: {
        type: Object,
        default: null,
    },
})

// `pacer.breakScreen` from the deck headmatter. A route path (usually a
// `routeAlias`, e.g. "/ic26-loop") that resolves to a slide showing the
// break content. Absent => no backdrop, existing break behaviour unchanged.
const breakScreen = computed(() => $slidev.configs?.[CONFIG_KEY]?.breakScreen ?? null)

// Resolve the configured value to an absolute, same-origin route. Accepts
// "/ic26-loop", "ic26-loop", or a slide number. The trailing query disables
// the slide's transitions/clicks UI chrome so it reads as a clean backdrop.
const frameSrc = computed(() => {
    const v = String(breakScreen.value).trim()
    if (/^https?:\/\//.test(v)) return v
    const base = import.meta.env.BASE_URL || '/'
    const path = v.replace(/^\//, '')
    return `${base.replace(/\/$/, '')}/${path}?embedded=true`
})
</script>

<style scoped>
.break-backdrop {
    position: fixed;
    inset: 0;
    /* Below the break card (z-index 5000) and the activity timer, above the
       slide canvas. The presenter keeps navigating the deck underneath. */
    z-index: 4000;
    background: #000;
}

.break-backdrop-frame {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
}
</style>
