# slidev-addon-pacer

Presentation pacing for [Slidev](https://sli.dev): a dual-lane race between **the rabbit** (the slide you're on) and **the turtle** (the time you've burned), plus per-slide time budgets, banked time, and target completion tracking.

Inspired by the original [slidev-addon-rabbit](https://github.com/kaakaa/slidev-addon-rabbit) (itself inspired by [rabbit-shocker/rabbit](https://github.com/rabbit-shocker/rabbit/)). This fork has diverged enough that it now lives as its own addon.

![](./assets/screen.gif)

## Description

As the presentation begins, the rabbit and the turtle aim for the goal. **The rabbit** represents **the current page**, and **the turtle** represents **the elapsed time** since the start. Keep the rabbit ahead of the turtle to stay on schedule.

![](./assets/description.png)

## Usage

1. Apply `slidev-addon-pacer` to your slidev project
   - See [Use Addon | Slidev](https://sli.dev/addons/use.html)
2. Run slidev (e.g. `npm run dev`)
3. Either:
   - Attach url query `?time=10` to the presentation url (e.g. `http://localhost:3030/?time=10`), OR
   - Use per-slide time attributes with `useSlideTimes: true` (see below) and no query parameter is needed

### Using per-slide time attributes

You can specify a time budget for individual slides by adding a `slideTime` attribute to each slide's frontmatter. Values are in minutes.

```md
---
title: My First Slide
slideTime: 2  # 2-minute budget
---

# My Presentation

---
title: Complex Topic
slideTime: 5  # 5-minute budget
---

# Complex Topic
```

To enable time-based slide tracking, add `useSlideTimes: true` to your pacer configuration:

```yaml
---
addons:
  - slidev-addon-pacer
pacer:
  useSlideTimes: true   # enable time-based slide tracking
  defaultSlideTime: 2   # default time for slides without slideTime (minutes)
  showSlideMarkers: true
---
```

When `useSlideTimes` is enabled:

- The **flag** represents the total presentation time (sum of all slide budgets)
- The **turtle** represents the actual elapsed time since presentation start
- No `?time=` query parameter is needed

> If no `slideTime` attributes are found, the addon falls back to slide-count-based positioning.

### Multi-day decks (segments)

For decks taught across multiple days (or any deck where pacing should reset partway through), mark each segment's opener slide with `pacerBoundary` in its frontmatter:

```md
---
layout: section
title: Day 2
pacerBoundary: true
---

# Day 2
```

Pass a string instead of `true` to give the segment its own label (independent of the slide's `title`):

```md
---
title: Applied Monitoring
pacerBoundary: Day 1
---

# Cover
```

The addon then groups slides into segments at each boundary. Banking, ETA, and remaining-time math scope to the current segment only. Each segment gets its own presentation start time and target completion time in the settings dialog (when the dialog opens on a slide in segment N, you're editing segment N's settings).

If no `pacerBoundary` markers exist, the whole deck is treated as a single segment (the default).

### Breaks

Breaks are wall-clock-anchored, not content-anchored: you tell the pacer when your breaks are (10:30 AM, 12:00 PM, 2:30 PM, ...) and how long they last, and the pacer shows you where they'll fall in your content given your current pacing. There are no break slides to maintain in the deck.

Configure breaks per segment in the settings dialog (the dialog adds a "Breaks" section scoped to whichever segment contains the slide you're on). Each break has a start time and a duration.

While a break is upcoming:
- A break chip appears in the presenter nav bar showing the time until the next break.
- The chip's tooltip names the slide the break is projected to land on at current pacing.
- Banking and ETA both account for the break (target completion factors in upcoming break time).

When a break is due:
- The chip turns red and pulses.
- Click it to raise the break overlay.

While a break is active:
- A fullscreen overlay shows on both the presenter and audience screens, with a "Back at H:MM" message and a live countdown.
- The slide elapsed-time counter pauses (so the slide you were on doesn't get charged for break minutes).
- When the countdown hits zero, it goes red and counts up (overrun).
- The presenter clicks the "Resume presentation" button (or presses Escape) to dismiss.

If a break runs over, the overrun shows up in the banking math the moment it's dismissed.

## Configs

```yaml
---
addons:
  - slidev-addon-pacer
pacer:
  useSlideTimes: false                  # enable time-based slide tracking (default: false)
  defaultSlideTime: 2                   # default minutes per slide (default: 2)
  showSlideMarkers: false               # tick marks along the track divider (default: false)
  showSlideCountdown: false             # per-slide countdown on the rabbit (default: false)
  pauseSlideCountdownUntilStart: true   # pause slide countdown until start in wall-clock mode (default: true)
  use12HourFormat: false                # 12-hour AM/PM time format (default: false)
  debug: false                          # console debug logging (default: false)
---
```

## License

This repository distributes under [MIT License](./LICENSE).

Icons used in this addon come from [Emoji One (Monotone)](https://icon-sets.iconify.design/emojione-monotone/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja).
