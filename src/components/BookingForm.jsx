// Choose game -> date -> open time -> players. Used by the Book page and the Edit page.
import { useEffect, useState } from 'react'
import StateMessage from './StateMessage.jsx'
import MonthCalendar from './MonthCalendar.jsx'
import Mascot from './Mascot.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { subscribeToOpenSlots, todayAtVenue, validatePlayers } from '../lib/scheduling.js'
import { formatDate, formatTime, formatTimeRange } from '../lib/format.js'
import { friendlyAuthError } from '../lib/authErrors.js'
import {
  DEFAULT_GAME_COLOR,
  GAME_COLORS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SESSION_MINUTES,
} from '../config.js'

function StepTitle({ num, id, children }) {
  return (
    <div className="step-title">
      <span className="step-num" aria-hidden="true">
        {num}
      </span>
      <h2 id={id}>{children}</h2>
    </div>
  )
}

// Edit mode: `initial` = { gameId, date, players } and `currentSlot` = the slot the
// booking already holds. It is booked (by this user), so it is not in the open list;
// we add it back so the customer can keep it.
export default function BookingForm({
  games,
  submitLabel,
  submittingLabel = 'Booking…',
  onSubmit,
  initial,
  currentSlot,
  secondaryAction,
}) {
  const { profile } = useAuth()
  const today = todayAtVenue()
  const [gameId, setGameId] = useState(initial?.gameId ?? games[0]?.id ?? '')
  const [date, setDate] = useState(initial?.date ?? today)
  const [slotId, setSlotId] = useState(currentSlot?.id ?? '')
  const [players, setPlayers] = useState(initial?.players ?? 2)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Slots are stored with the game/date they belong to, so we know when they are stale.
  const slotsKey = `${gameId}|${date}`
  const [slotsResult, setSlotsResult] = useState({ key: null, slots: [], error: null })
  const slotsLoading = slotsResult.key !== slotsKey
  let slots = slotsLoading ? [] : slotsResult.slots
  if (!slotsLoading && currentSlot?.gameId === gameId && currentSlot?.date === date) {
    slots = [...slots, currentSlot].sort((a, b) => a.start.toMillis() - b.start.toMillis())
  }

  useEffect(() => {
    if (!gameId || !date) return
    const key = `${gameId}|${date}`
    return subscribeToOpenSlots(
      gameId,
      date,
      (slots) => setSlotsResult({ key, slots, error: null }),
      (err) => setSlotsResult({ key, slots: [], error: err }),
    )
  }, [gameId, date])

  const game = games.find((g) => g.id === gameId)
  const maxPlayers = game?.maxPlayers ?? MAX_PLAYERS
  // If the chosen slot disappears (someone else booked it), it is no longer selected.
  const selectedSlot = slots.find((s) => s.id === slotId)

  function pickGame(id) {
    setGameId(id)
    setSlotId('')
    setError('')
  }

  function pickDate(value) {
    setDate(value)
    setSlotId('')
    setError('')
  }

  function changePlayers(delta) {
    setPlayers((n) => Math.min(maxPlayers, Math.max(MIN_PLAYERS, n + delta)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!selectedSlot) {
      setError('Pick a game, a day, and a time first.')
      return
    }
    const playersError = validatePlayers(players, maxPlayers)
    if (playersError) {
      setError(playersError)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({ slot: selectedSlot, players })
    } catch (err) {
      setError(err.code ? friendlyAuthError(err) : err.message)
      setSlotId('')
    } finally {
      setSubmitting(false)
    }
  }

  let times
  if (slotsLoading) {
    times = <StateMessage type="loading" title="Loading open times…" />
  } else if (slotsResult.error) {
    times = (
      <StateMessage type="error" title="Could not load times.">
        {friendlyAuthError(slotsResult.error)}
      </StateMessage>
    )
  } else if (slots.length === 0) {
    times = (
      <StateMessage type="empty" title="No open times for this date.">
        Try another day or game.
      </StateMessage>
    )
  } else {
    times = (
      <div className="times">
        {slots.map((slot) => (
          <label key={slot.id} className={`choice time ${slot.id === slotId ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="slot"
              value={slot.id}
              checked={slot.id === slotId}
              onChange={() => setSlotId(slot.id)}
              aria-label={formatTimeRange(slot.start, slot.end)}
            />
            {formatTime(slot.start)}
            {slot.id === currentSlot?.id && <span className="small muted">current</span>}
          </label>
        ))}
      </div>
    )
  }

  return (
    <form className="book-grid" onSubmit={handleSubmit} noValidate>
      <div className="stack">
        <fieldset className="stack" style={{ border: 0, padding: 0 }}>
          <legend>
            <StepTitle num={1}>Pick a game</StepTitle>
          </legend>
          <div className="games">
            {games.map((g) => (
              <label key={g.id} className={`choice ${g.id === gameId ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="game"
                  value={g.id}
                  checked={g.id === gameId}
                  onChange={() => pickGame(g.id)}
                />
                <span
                  className="game-dot"
                  style={{ background: GAME_COLORS[g.id] ?? DEFAULT_GAME_COLOR }}
                  aria-hidden="true"
                />
                <h3>{g.name}</h3>
                {g.description && <span className="muted small">{g.description}</span>}
                <span className="game-meta">
                  {g.durationMinutes ?? SESSION_MINUTES} min · up to {g.maxPlayers ?? MAX_PLAYERS}{' '}
                  players
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <section className="card" aria-labelledby="step-day">
          <StepTitle num={2} id="step-day">
            Pick a day
          </StepTitle>
          <MonthCalendar value={date} min={today} onChange={pickDate} />
        </section>

        <fieldset className="card">
          <legend className="sr-only">Pick a time</legend>
          <StepTitle num={3}>Pick a time</StepTitle>
          {times}
          {!slotsLoading && slots.length > 0 && (
            <p className="muted small" style={{ marginTop: 10 }}>
              Only open times are shown. Times are in Riyadh time.
            </p>
          )}
        </fieldset>

        <section className="card" aria-labelledby="step-players">
          <StepTitle num={4} id="step-players">
            How many players?
          </StepTitle>
          <div className="stepper">
            <button
              type="button"
              onClick={() => changePlayers(-1)}
              disabled={players <= MIN_PLAYERS}
              aria-label="Fewer players"
            >
              −
            </button>
            <output aria-live="polite" aria-label="Players">
              {players}
            </output>
            <button
              type="button"
              onClick={() => changePlayers(1)}
              disabled={players >= maxPlayers}
              aria-label="More players"
            >
              +
            </button>
            <span className="muted">
              {MIN_PLAYERS} to {maxPlayers} players
            </span>
          </div>
        </section>
      </div>

      <aside className="card summary" aria-label="Your booking">
        <div className="summary-head">
          <Mascot size={48} />
          <h2>Your booking</h2>
        </div>
        <dl>
          <dt>Game</dt>
          <dd>{game?.name ?? 'Not picked yet'}</dd>
          <dt>Day</dt>
          <dd>{selectedSlot ? formatDate(selectedSlot.start) : 'Not picked yet'}</dd>
          <dt>Time</dt>
          <dd>{selectedSlot ? formatTimeRange(selectedSlot.start, selectedSlot.end) : 'Not picked yet'}</dd>
          <dt>Players</dt>
          <dd>{players}</dd>
          <dt>Name</dt>
          <dd>{profile?.name}</dd>
          <dt>Email</dt>
          <dd>{profile?.email}</dd>
        </dl>

        {error && (
          <div style={{ marginBottom: 12 }}>
            <StateMessage type="error">{error}</StateMessage>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-big" disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
        {secondaryAction && <div style={{ marginTop: 8 }}>{secondaryAction}</div>}
      </aside>
    </form>
  )
}
