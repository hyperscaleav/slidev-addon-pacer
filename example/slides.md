---
theme: default
title: slidev-addon-pacer demo
class: text-center
transition: slide-left
mdc: true
addons:
  - ./
pacer:
  useSlideTimes: true
  defaultSlideTime: 2
  showSlideMarkers: true
  showSlideCountdown: true
  pauseSlideCountdownUntilStart: true
  use12HourFormat: true
  breakScreen: /pacer-break-demo
pacerBoundary: Day 1
slideTime: 0.5
---

# slidev-addon-pacer

A presentation pacing addon for Slidev

<div class="pt-12 text-sm opacity-60">
Press <kbd>p</kbd> for presenter view, then <kbd>space</kbd> to advance
</div>

---
title: What this demo exercises
slideTime: 1
---

# What this demo exercises

- **Per-day segments**: this deck is split into three by `pacerBoundary` markers
- **Banking, ETA, target completion**: scoped per segment
- **Breaks**: wall-clock anchored, configured at runtime; raise a fullscreen break screen with a draggable corner countdown
- **Break screen**: point `pacer.breakScreen` at any route; it fills the audience view while you keep navigating the deck
- **Slide-time pacing**: the rabbit (your slide) racing the turtle (your elapsed time)

The presenter view's bottom nav bar has the pacer chips. Hover any of them for tooltips; click any of them to open settings.

---
title: The chips
slideTime: 2
---

# The chips

In presenter view's bottom nav bar:

| Icon | What it shows |
|------|---------------|
| Clock | Wall-clock elapsed since presentation start (T- countdown before start) |
| Timer | Current slide's countdown (red if over plan) |
| Piggy bank | Banked time for the current segment |
| Crystal ball | Estimated end time for the current segment |
| Bullseye | Target completion time for the current segment (when set) |
| Pause | Time until the next break (when one is scheduled) |

Click the clock or bullseye to open settings and set the start time / target.

---
title: Day 2
pacerBoundary: true
slideTime: 0.5
---

# Day 2

The pacer chips reset here. Banking, ETA, and target are now scoped to Day 2 only.

---
title: Per-day settings
slideTime: 1
---

# Per-day settings

Open settings from any chip. The header reads:

> Editing: **Day 2** (segment 2 of 3)

Each segment gets its own:

- Presentation start time
- Target completion time
- List of breaks

Setting Day 1's target doesn't affect Day 2's ETA, and vice versa.

---
title: Adding a break
slideTime: 2
---

# Adding a break

In the settings dialog, scroll to the **Breaks** section.

1. Click **+ Add break**
2. Set the start time to about a minute from now
3. Set the duration to 1 minute (for quick testing)
4. Click **Save**

A pause-icon chip appears in the nav bar showing the countdown. Hover it: the tooltip names the slide the break will land on if you keep pace.

When the countdown hits zero, the chip pulses red. Click it to raise the overlay.

---
title: Day 3
pacerBoundary: true
slideTime: 0.5
---

# Day 3

Same per-segment story. Try setting a different target completion for Day 3 to see the ETA chip change as you cross the boundary.

---
title: Testing the break overlay
slideTime: 2
---

# Testing the break screen

When you raise a break:

- The configured **break screen** (`pacer.breakScreen`, here `/pacer-break-demo`) fills the audience view as a fullscreen backdrop
- A **countdown timer** rides in the corner — starts top-right, **drag it** anywhere on the presenter view; the audience mirrors it and it **remembers** its spot across breaks and reloads
- The break screen runs in its own iframe, so you can **navigate the deck freely** behind it — advance slides, jump around; the backdrop stays put
- The slide elapsed-time counter **pauses** (the slide you were on isn't charged for break minutes)
- After the countdown hits zero, it goes red and **counts up** as overrun
- Click **Resume presentation** (or press <kbd>Esc</kbd>) to dismiss

To verify: open `http://localhost:3030/` in one window and `http://localhost:3030/presenter` in another. Raise the break from the presenter window; the break screen + corner timer show in both. With no `breakScreen` set, you get the old plain overlay instead.

---
title: Done
slideTime: 0.5
---

# That's the demo

Check the README for the full config reference and the `pacerBoundary` frontmatter contract.

---
layout: center
class: '!p-0'
hideInToc: true
clicks: 0
routeAlias: pacer-break-demo
---

<div class="break-demo">
  <div class="break-demo-orb"></div>
  <div class="break-demo-text">
    <div class="break-demo-kicker">BREAK</div>
    <div class="break-demo-sub">back shortly</div>
    <div class="break-demo-clock">{{ tick }}</div>
  </div>
</div>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
// Live tick proves the break screen runs its own lifecycle in the iframe:
// it keeps counting while the presenter navigates the deck behind it.
const tick = ref(0)
let t = null
onMounted(() => { t = setInterval(() => { tick.value++ }, 1000) })
onUnmounted(() => { if (t) clearInterval(t) })
</script>

<style scoped>
.break-demo {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 40%, #1e293b, #020617 70%);
  overflow: hidden;
}
.break-demo-orb {
  position: absolute;
  width: 60vmin;
  height: 60vmin;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(56,189,248,0.45), transparent 65%);
  animation: break-pulse 3.2s ease-in-out infinite;
}
@keyframes break-pulse {
  0%, 100% { transform: scale(0.85); opacity: 0.55; }
  50%      { transform: scale(1.15); opacity: 1; }
}
.break-demo-text {
  position: relative;
  text-align: center;
  color: #e2e8f0;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.break-demo-kicker { font-size: 14vmin; font-weight: 800; letter-spacing: 0.15em; }
.break-demo-sub { font-size: 4vmin; opacity: 0.7; margin-top: 0.2em; }
.break-demo-clock {
  margin-top: 1em;
  font-size: 3vmin;
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
}
</style>

<!--
This is the demo break screen. `pacer.breakScreen: /pacer-break-demo` in the deck
headmatter points at this slide's routeAlias. Raise a break and it fills the audience
view behind the corner countdown. The live tick counter proves the iframe keeps its
own lifecycle while you navigate the deck behind it.
-->
