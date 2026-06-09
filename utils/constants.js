// Shared identifiers for the pacer addon.

export const CONFIG_KEY = 'pacer'

const STORAGE_PREFIX = 'slidev-pacer-'

// Per-segment maps: { [segmentIndex]: <ms-string> }. Decks without
// pacerBoundary frontmatter have a single segment at index 0.
export const STORAGE_KEYS = {
  PRESENTATION_STARTS: `${STORAGE_PREFIX}presentation-starts`,
  TARGET_COMPLETIONS: `${STORAGE_PREFIX}target-completions`,
  // Per-segment ordered visit log. Each entry is one continuous block of
  // time the presenter spent on a slide (a slide visited multiple times,
  // or a slide interrupted by a break, produces multiple entries).
  //   { "<segIdx>": [{ id, slideNumber, title, startedAt, endedAt,
  //                    plannedMinutes, segmentIndex, segmentLabel }, ...] }
  SLIDE_VISITS: `${STORAGE_PREFIX}slide-visits`,
  // Per-segment break lists, stored as JSON:
  //   { "<segIdx>": [{ id, startTime: <ms>, durationMinutes: <num> }, ...] }
  BREAKS: `${STORAGE_PREFIX}breaks`,
  // Active activity timer (global, not per-segment). Position/scale are
  // synced so dragging or resizing on the presenter view moves it on the
  // audience view too. Coordinates are the widget CENTER as a percentage
  // of the viewport, so different-resolution screens stay proportional.
  //   { id, startedAt: <ms>, durationMinutes: <num>,
  //     xPct: <0..100>, yPct: <0..100>, scale: <number> } or absent when idle
  ACTIVITY: `${STORAGE_PREFIX}activity`,
}

// A visit must last at least this many seconds to be counted as
// "presented" in the saved artifact. Override per-deck via
// pacer.presentationThresholdSeconds in the deck frontmatter.
export const DEFAULT_PRESENTED_THRESHOLD_SECONDS = 5

export const EVENTS = {
  OPEN_SETTINGS: 'pacer-open-settings',
  SETTINGS_UPDATED: 'pacer-settings-updated',
  // Fired when a presenter raises or dismisses a break overlay.
  // detail: { activeBreak: <break-object> | null }
  BREAK_STATE_CHANGED: 'pacer-break-state-changed',
  // Fired when an activity timer is started or dismissed.
  // detail: { activity: <activity-object> | null }
  ACTIVITY_STATE_CHANGED: 'pacer-activity-state-changed',
}

// Browser `storage` events only fire in *other* tabs, so settings changes
// made in this window need a same-window CustomEvent to propagate.
export function writeSetting(key, value) {
  if (value === null || value === undefined) {
    localStorage.removeItem(key)
  } else {
    localStorage.setItem(key, String(value))
  }
  window.dispatchEvent(new CustomEvent(EVENTS.SETTINGS_UPDATED, {
    detail: { key, value: value == null ? null : String(value) },
  }))
}

// Read one entry from a per-segment JSON-map stored under mapKey.
export function readSegmentValue(mapKey, segmentIndex) {
  try {
    const raw = localStorage.getItem(mapKey)
    if (!raw) return null
    const map = JSON.parse(raw)
    const v = map[String(segmentIndex)]
    return v ?? null
  } catch {
    return null
  }
}

// Write one entry into a per-segment JSON-map, then fire SETTINGS_UPDATED.
// Passing null/undefined as value deletes that segment's entry.
export function writeSegmentValue(mapKey, segmentIndex, value) {
  let map = {}
  try {
    const raw = localStorage.getItem(mapKey)
    if (raw) map = JSON.parse(raw)
  } catch {
    map = {}
  }
  const segKey = String(segmentIndex)
  if (value === null || value === undefined) {
    delete map[segKey]
  } else {
    map[segKey] = String(value)
  }
  if (Object.keys(map).length === 0) {
    localStorage.removeItem(mapKey)
  } else {
    localStorage.setItem(mapKey, JSON.stringify(map))
  }
  window.dispatchEvent(new CustomEvent(EVENTS.SETTINGS_UPDATED, {
    detail: { key: mapKey, segmentIndex, value: value == null ? null : String(value) },
  }))
}

// Build the segment list from a slidev slides array. Slides with
// `pacerBoundary: true` in their frontmatter start a new segment.
// Returns [{ index, start, end, label }] where start/end are 0-based
// slide indices (inclusive). Decks with no boundaries return a single
// segment spanning the whole deck.
export function computeSegments(slides) {
  if (!slides || slides.length === 0) {
    return [{ index: 0, start: 0, end: 0, label: 'Presentation' }]
  }

  const boundaries = []
  slides.forEach((slide, idx) => {
    if (slide.meta?.slide?.frontmatter?.pacerBoundary) {
      boundaries.push(idx)
    }
  })

  if (boundaries.length === 0) {
    return [{ index: 0, start: 0, end: slides.length - 1, label: 'Presentation' }]
  }

  const segs = []
  if (boundaries[0] > 0) {
    segs.push({ index: 0, start: 0, end: boundaries[0] - 1, label: 'Preamble' })
  }
  boundaries.forEach((b, i) => {
    const end = i + 1 < boundaries.length ? boundaries[i + 1] - 1 : slides.length - 1
    const fm = slides[b].meta?.slide?.frontmatter
    // `pacerBoundary` accepts true (use slide's own `title` as label) or a
    // string (used directly, so the deck's title can stay decoupled).
    const label = typeof fm?.pacerBoundary === 'string' && fm.pacerBoundary.trim() !== ''
      ? fm.pacerBoundary
      : fm?.title ?? `Segment ${segs.length + 1}`
    segs.push({ index: segs.length, start: b, end, label })
  })
  return segs
}

// Find which segment a 1-based page number belongs to.
export function findSegmentForPage(segments, currentPage) {
  const pageIdx = currentPage - 1
  return segments.find(s => pageIdx >= s.start && pageIdx <= s.end) ?? segments[0]
}

// Read the break list for a segment. Returns an array (possibly empty),
// sorted by startTime ascending.
export function readSegmentBreaks(segmentIndex) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BREAKS)
    if (!raw) return []
    const map = JSON.parse(raw)
    const arr = map[String(segmentIndex)] ?? []
    return [...arr].sort((a, b) => a.startTime - b.startTime)
  } catch {
    return []
  }
}

// Replace the break list for a segment, then fire SETTINGS_UPDATED.
// Pass an empty array (or null) to clear the segment's entry.
export function writeSegmentBreaks(segmentIndex, breaks) {
  let map = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BREAKS)
    if (raw) map = JSON.parse(raw)
  } catch {
    map = {}
  }
  const segKey = String(segmentIndex)
  if (!breaks || breaks.length === 0) {
    delete map[segKey]
  } else {
    map[segKey] = breaks
  }
  if (Object.keys(map).length === 0) {
    localStorage.removeItem(STORAGE_KEYS.BREAKS)
  } else {
    localStorage.setItem(STORAGE_KEYS.BREAKS, JSON.stringify(map))
  }
  window.dispatchEvent(new CustomEvent(EVENTS.SETTINGS_UPDATED, {
    detail: { key: STORAGE_KEYS.BREAKS, segmentIndex },
  }))
}

// Build a stable id for a new break entry.
export function newBreakId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `break-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Read the ordered visit log for a segment. Returns an array (possibly
// empty), in append order.
export function readSegmentVisits(segmentIndex) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SLIDE_VISITS)
    if (!raw) return []
    const map = JSON.parse(raw)
    return map[String(segmentIndex)] ?? []
  } catch {
    return []
  }
}

// Read every segment's visit log, flattened in segment-then-append order.
// Used by the export and by reactive consumers that need everything.
export function readAllVisits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SLIDE_VISITS)
    if (!raw) return []
    const map = JSON.parse(raw)
    const out = []
    Object.keys(map)
      .map(k => Number(k))
      .sort((a, b) => a - b)
      .forEach(segIdx => {
        for (const v of map[String(segIdx)] ?? []) out.push(v)
      })
    return out
  } catch {
    return []
  }
}

// Replace the visit log for a segment, then fire SETTINGS_UPDATED.
export function writeSegmentVisits(segmentIndex, visits) {
  let map = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SLIDE_VISITS)
    if (raw) map = JSON.parse(raw)
  } catch {
    map = {}
  }
  const segKey = String(segmentIndex)
  if (!visits || visits.length === 0) {
    delete map[segKey]
  } else {
    map[segKey] = visits
  }
  if (Object.keys(map).length === 0) {
    localStorage.removeItem(STORAGE_KEYS.SLIDE_VISITS)
  } else {
    localStorage.setItem(STORAGE_KEYS.SLIDE_VISITS, JSON.stringify(map))
  }
  window.dispatchEvent(new CustomEvent(EVENTS.SETTINGS_UPDATED, {
    detail: { key: STORAGE_KEYS.SLIDE_VISITS, segmentIndex },
  }))
}

// Append one visit entry to a segment's log, then fire SETTINGS_UPDATED.
export function appendSegmentVisit(segmentIndex, visit) {
  const current = readSegmentVisits(segmentIndex)
  writeSegmentVisits(segmentIndex, [...current, visit])
}

export function newVisitId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `visit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Pick the best human-readable title for a slide. Prefers an explicit
// frontmatter `title:`, then Slidev's own `title` field if exposed, then
// the first markdown heading in the slide's content, then "Slide N".
export function getSlideTitle(slide, slideNumber) {
  const meta = slide?.meta?.slide
  if (!meta) return `Slide ${slideNumber}`

  const fmTitle = meta.frontmatter?.title
  if (typeof fmTitle === 'string' && fmTitle.trim() !== '') return fmTitle.trim()

  if (typeof meta.title === 'string' && meta.title.trim() !== '') return meta.title.trim()

  const content = meta.content ?? meta.raw ?? ''
  if (typeof content === 'string' && content.length > 0) {
    const match = content.match(/^\s*#{1,6}\s+(.+?)\s*$/m)
    if (match) return match[1].trim()
  }

  return `Slide ${slideNumber}`
}

// Read the active activity from localStorage.
export function readActivity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Write (or clear) the activity state, then fire ACTIVITY_STATE_CHANGED.
export function writeActivity(activity) {
  if (!activity) {
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY)
  } else {
    localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(activity))
  }
  window.dispatchEvent(new CustomEvent(EVENTS.ACTIVITY_STATE_CHANGED, {
    detail: { activity: activity ?? null },
  }))
}

export function newActivityId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Default placement for a freshly-started activity timer: horizontally
// centered, near the top, at unit scale.
export const DEFAULT_ACTIVITY_POS = { xPct: 50, yPct: 22, scale: 1 }

// Scale is clamped to this range while resizing.
export const ACTIVITY_SCALE_MIN = 0.4
export const ACTIVITY_SCALE_MAX = 6

// An activity timer is for short in-room exercises; cap it at 24h so a
// fat-fingered entry ("100000000") is rejected rather than rendering a
// nonsensical countdown.
const ACTIVITY_MAX_MINUTES = 24 * 60

// Parse a free-text duration into minutes. Accepts:
//   "12"      -> 12 minutes
//   "12.5"    -> 12.5 minutes
//   "12:30"   -> 12 minutes 30 seconds (12.5)
//   "0:90" is rejected (seconds must be < 60).
// Returns a number of minutes in (0, ACTIVITY_MAX_MINUTES], or null if
// unparseable / out of range.
export function parseDuration(text) {
  if (typeof text !== 'string') return null
  const t = text.trim()
  if (t === '') return null

  let minutes = null
  const clock = t.match(/^(\d+):([0-5]?\d)$/)
  if (clock) {
    minutes = parseInt(clock[1], 10) + parseInt(clock[2], 10) / 60
  } else if (/^\d+(?:\.\d+)?$/.test(t)) {
    minutes = parseFloat(t)
  }

  if (minutes == null || minutes <= 0 || minutes > ACTIVITY_MAX_MINUTES) return null
  return minutes
}
