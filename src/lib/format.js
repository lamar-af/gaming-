// Show dates and times in venue time (Asia/Riyadh), whatever the user's device timezone is.
import { TIMEZONE } from '../config.js'

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// Accepts a Firestore Timestamp or a JS Date.
function toDate(value) {
  return typeof value?.toDate === 'function' ? value.toDate() : value
}

export function formatTime(value) {
  return timeFormat.format(toDate(value)) // "14:00"
}

export function formatDate(value) {
  return dateFormat.format(toDate(value)) // "Thu, 5 Nov 2026"
}

export function formatTimeRange(start, end) {
  return `${formatTime(start)}–${formatTime(end)}` // "14:00–15:00"
}
