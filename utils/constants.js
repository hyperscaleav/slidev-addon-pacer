// Shared identifiers for the pacer addon.

export const CONFIG_KEY = 'pacer'

const STORAGE_PREFIX = 'slidev-pacer-'

// Per-segment maps: { [segmentIndex]: <ms-string> }. Decks without
// pacerBoundary frontmatter have a single segment at index 0.
export const STORAGE_KEYS = {
  PRESENTATION_STARTS: `${STORAGE_PREFIX}presentation-starts`,
  TARGET_COMPLETIONS: `${STORAGE_PREFIX}target-completions`,
  SLIDE_TIMES: `${STORAGE_PREFIX}slide-times`,
  // Per-segment break lists, stored as JSON:
  //   { "<segIdx>": [{ id, startTime: <ms>, durationMinutes: <num> }, ...] }
  BREAKS: `${STORAGE_PREFIX}breaks`,
}

export const EVENTS = {
  OPEN_SETTINGS: 'pacer-open-settings',
  SETTINGS_UPDATED: 'pacer-settings-updated',
  // Fired when a presenter raises or dismisses a break overlay.
  // detail: { activeBreak: <break-object> | null }
  BREAK_STATE_CHANGED: 'pacer-break-state-changed',
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
