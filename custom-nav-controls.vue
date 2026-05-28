<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import TimerBar from './components/TimerBar.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import { EVENTS } from './utils/constants'

const showSettingsDialog = ref(false)

const handleOpenSettings = () => {
    showSettingsDialog.value = true
}

const onSettingsUpdated = () => {
    showSettingsDialog.value = false
}

onMounted(() => {
    window.addEventListener(EVENTS.OPEN_SETTINGS, handleOpenSettings)
})

onUnmounted(() => {
    window.removeEventListener(EVENTS.OPEN_SETTINGS, handleOpenSettings)
})
</script>

<template>
    <TimerBar />

    <SettingsDialog :show="showSettingsDialog" @close="showSettingsDialog = false"
        @settings-updated="onSettingsUpdated" />
</template>
