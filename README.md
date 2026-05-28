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
