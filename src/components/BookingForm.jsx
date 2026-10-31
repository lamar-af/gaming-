// Choose game -> date -> open time -> players. Used by the Book page and the Edit page.
import { useEffect, useState } from 'react'
import StateMessage from './StateMessage.jsx'
import { subscribeToOpenSlots, todayAtVenue, validatePlayers } from '../lib/scheduling.js'
import { formatTimeRange } from '../lib/format.js'
import { friendlyAuthError } from '../lib/authErrors.js'
import { MAX_PLAYERS, MIN_PLAYERS } from '../config.js'

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
}) {
  const today = todayAtVenue()
  const [gameId, setGameId] = useState(initial?.gameId ?? games[0]?.id ?? '')
  const [date, setDate] = useState(initial?.date ?? today)
  const [slotId, setSlotId] = useState(currentSlot?.id ?? '')
  const [players, setPlayers] = useState(String(initial?.players ?? 2))
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!selectedSlot) {
      setError('Please pick a time.')
      return
    }
    const playerCount = Number(players)
    const playersError = validatePlayers(playerCount, maxPlayers)
    if (playersError) {
      setError(playersError)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({ slot: selectedSlot, players: playerCount })
    } catch (err) {
      setError(err.code ? friendlyAuthError(err) : err.message)
      setSlotId('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <fieldset className="card stack">
        <legend className="eyebrow">01 / game</legend>
        <div className="choice-grid">
          {games.map((g) => (
            <label key={g.id} className={`choice ${g.id === gameId ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="game"
                value={g.id}
                checked={g.id === gameId}
                onChange={() => pickGame(g.id)}
              />
              <strong>{g.name}</strong>
              {g.description && <span className="muted">{g.description}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="card stack">
        <legend className="eyebrow">02 / date</legend>
        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => pickDate(e.target.value)}
            required
          />
        </label>
      </fieldset>

      <fieldset className="card stack">
        <legend className="eyebrow">03 / time</legend>
        {!date ? (
          <StateMessage type="empty">Pick a date first.</StateMessage>
        ) : slotsLoading ? (
          <StateMessage type="loading" title="Loading open times…" />
        ) : slotsResult.error ? (
          <StateMessage type="error" title="Could not load times.">
            {friendlyAuthError(slotsResult.error)}
          </StateMessage>
        ) : slots.length === 0 ? (
          <StateMessage type="empty" title="No open times for this date.">
            Try another date or game.
          </StateMessage>
        ) : (
          <div className="slot-grid">
            {slots.map((slot) => (
              <label
                key={slot.id}
                className={`choice slot ${slot.id === slotId ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="slot"
                  value={slot.id}
                  checked={slot.id === slotId}
                  onChange={() => setSlotId(slot.id)}
                />
                {formatTimeRange(slot.start, slot.end)}
                {slot.id === currentSlot?.id && <span className="small muted">current</span>}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="card stack">
        <legend className="eyebrow">04 / players</legend>
        <label className="field">
          <span>
            Number of players ({MIN_PLAYERS}–{maxPlayers})
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_PLAYERS}
            max={maxPlayers}
            step={1}
            value={players}
            onChange={(e) => setPlayers(e.target.value)}
            required
          />
        </label>
      </fieldset>

      {error && <StateMessage type="error">{error}</StateMessage>}

      <div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}
