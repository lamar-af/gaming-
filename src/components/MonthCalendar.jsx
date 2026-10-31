// Month grid date picker. Dates are "YYYY-MM-DD" strings in venue time.
// Uses UTC math on the date strings so the user's device timezone can't shift days.
import { useState } from 'react'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n) => String(n).padStart(2, '0')

const monthLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })
const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export default function MonthCalendar({ value, min, onChange }) {
  // The month being shown, as { year, month (0-11) }. Starts at the selected date.
  const [view, setView] = useState(() => {
    const [y, m] = (value || min).split('-').map(Number)
    return { year: y, month: m - 1 }
  })

  const { year, month } = view
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const minMonth = min.slice(0, 7)
  const canGoBack = `${year}-${pad(month + 1)}` > minMonth

  function shift(delta) {
    const d = new Date(Date.UTC(year, month + delta, 1))
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() })
  }

  const days = []
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${pad(month + 1)}-${pad(day)}`
    days.push(
      <button
        key={key}
        type="button"
        className={`day ${key === min ? 'today' : ''}`}
        disabled={key < min}
        aria-pressed={key === value}
        aria-label={dayLabel.format(new Date(Date.UTC(year, month, day)))}
        onClick={() => onChange(key)}
      >
        {day}
      </button>,
    )
  }

  return (
    <div role="group" aria-label="Pick a day">
      <div className="cal-head">
        <button type="button" onClick={() => shift(-1)} disabled={!canGoBack} aria-label="Previous month">
          ‹
        </button>
        <strong aria-live="polite">{monthLabel.format(new Date(Date.UTC(year, month, 1)))}</strong>
        <button type="button" onClick={() => shift(1)} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="cal">
        {WEEKDAYS.map((d) => (
          <div key={d} className="dow" aria-hidden="true">
            {d}
          </div>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days}
      </div>
    </div>
  )
}
