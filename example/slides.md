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
- **Breaks**: wall-clock anchored, configured at runtime, raised as a fullscreen overlay
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

# Testing the break overlay

When you raise a break:

- A fullscreen overlay appears on **both** the presenter window and the audience window
- A live countdown ticks down to "Back at H:MM"
- The slide elapsed-time counter **pauses** (the slide you were on isn't charged for break minutes)
- After the countdown hits zero, it goes red and **counts up** as overrun
- Click **Resume presentation** (or press <kbd>Esc</kbd>) to dismiss

To verify the audience overlay: open `http://localhost:3030/` in one window and `http://localhost:3030/presenter` in another. Raise the break from the presenter window; the overlay shows in both.

---
title: Done
slideTime: 0.5
---

# That's the demo

Check the README for the full config reference and the `pacerBoundary` frontmatter contract.
