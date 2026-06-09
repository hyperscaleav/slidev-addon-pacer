import { ref, computed, watch, onUnmounted } from 'vue'
import { DEFAULT_TIMER_POS, TIMER_SCALE_MIN, TIMER_SCALE_MAX } from './constants'

// Shared drag/resize/cross-window-sync behaviour for the floating timer
// cards (activity timer, break timer). The card's position (widget centre as
// a % of the viewport) and uniform scale live on whatever object the caller
// syncs; this composable owns the live local copy, the pointer gestures, and
// a throttled persist.
//
// Options:
//   active     () => <object|null>  the synced object carrying xPct/yPct/scale
//   canControl () => boolean        true only where drag/resize is allowed
//   persist    (pos) => void        called (throttled mid-gesture, once on
//                                   release) with { xPct, yPct, scale }
//
// The `active` getter is watched: when it changes AND this window is not the
// one currently dragging, the local position resyncs from it. That is what
// lets the presenter drag while the audience window follows, without a
// window's own echoed write clobbering its in-progress gesture.
export function useDraggableTimer({ active, canControl, persist }) {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

    const readPos = (a) => ({
        xPct: a?.xPct ?? DEFAULT_TIMER_POS.xPct,
        yPct: a?.yPct ?? DEFAULT_TIMER_POS.yPct,
        scale: a?.scale ?? DEFAULT_TIMER_POS.scale,
    })

    const pos = ref({ ...DEFAULT_TIMER_POS })
    const isInteracting = ref(false)

    watch(active, (a) => {
        if (a && !isInteracting.value) pos.value = readPos(a)
    }, { immediate: true })

    const cardStyle = computed(() => ({
        left: `${pos.value.xPct}%`,
        top: `${pos.value.yPct}%`,
        // Centre the widget on its coordinate, then apply the synced scale.
        transform: `translate(-50%, -50%) scale(${pos.value.scale})`,
    }))

    // performance.now() (not a 1s-resolution clock tick) so the throttle
    // actually paces sub-second drag updates to the other window.
    let lastPersist = 0
    const doPersist = (final = false) => {
        if (!active()) return
        const now = performance.now()
        // ~30fps of cross-window updates is smooth without thrashing storage.
        if (!final && now - lastPersist < 33) return
        lastPersist = now
        persist({ ...pos.value })
    }

    // --- Drag -----------------------------------------------------------------
    let dragStart = null

    const onDragMove = (e) => {
        if (!dragStart) return
        const dxPct = ((e.clientX - dragStart.px) / window.innerWidth) * 100
        const dyPct = ((e.clientY - dragStart.py) / window.innerHeight) * 100
        pos.value = {
            ...pos.value,
            xPct: clamp(dragStart.xPct + dxPct, 3, 97),
            yPct: clamp(dragStart.yPct + dyPct, 5, 95),
        }
        doPersist()
    }

    const onDragUp = () => {
        dragStart = null
        isInteracting.value = false
        window.removeEventListener('pointermove', onDragMove)
        window.removeEventListener('pointerup', onDragUp)
        doPersist(true)
    }

    const onCardPointerDown = (e) => {
        if (!canControl() || e.button !== 0) return
        isInteracting.value = true
        dragStart = { px: e.clientX, py: e.clientY, xPct: pos.value.xPct, yPct: pos.value.yPct }
        window.addEventListener('pointermove', onDragMove)
        window.addEventListener('pointerup', onDragUp)
        // Don't let the slide advance on what is really a drag.
        e.stopPropagation()
    }

    // --- Resize (uniform scale) -----------------------------------------------
    let resizeStart = null

    const onResizeMove = (e) => {
        if (!resizeStart) return
        // Average the x and y travel. ~220px of drag ≈ 1.0 of scale.
        const delta = ((e.clientX - resizeStart.px) + (e.clientY - resizeStart.py)) / 2 / 220
        pos.value = {
            ...pos.value,
            scale: clamp(resizeStart.scale + delta, TIMER_SCALE_MIN, TIMER_SCALE_MAX),
        }
        doPersist()
    }

    const onResizeUp = () => {
        resizeStart = null
        isInteracting.value = false
        window.removeEventListener('pointermove', onResizeMove)
        window.removeEventListener('pointerup', onResizeUp)
        doPersist(true)
    }

    const onResizePointerDown = (e) => {
        if (!canControl() || e.button !== 0) return
        isInteracting.value = true
        resizeStart = { px: e.clientX, py: e.clientY, scale: pos.value.scale }
        window.addEventListener('pointermove', onResizeMove)
        window.addEventListener('pointerup', onResizeUp)
        e.stopPropagation()
    }

    onUnmounted(() => {
        window.removeEventListener('pointermove', onDragMove)
        window.removeEventListener('pointerup', onDragUp)
        window.removeEventListener('pointermove', onResizeMove)
        window.removeEventListener('pointerup', onResizeUp)
    })

    return { pos, isInteracting, cardStyle, onCardPointerDown, onResizePointerDown }
}
