// Shared identifiers for the pacer addon.

export const CONFIG_KEY = 'pacer'

const STORAGE_PREFIX = 'slidev-pacer-'

export const STORAGE_KEYS = {
  PRESENTATION_START: `${STORAGE_PREFIX}presentation-start-time`,
  TARGET_COMPLETION: `${STORAGE_PREFIX}target-completion`,
  SLIDE_TIMES: `${STORAGE_PREFIX}slide-times`,
}

export const EVENTS = {
  OPEN_SETTINGS: 'pacer-open-settings',
  SETTINGS_UPDATED: 'pacer-settings-updated',
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
