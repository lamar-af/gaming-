// ALL booking and scheduling logic lives here. Pages call these functions.
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import {
  DEFAULT_GAMES,
  EDIT_LOCK_HOURS,
  LAST_START_HOUR,
  MAX_PLAYERS,
  MIN_PLAYERS,
  OPEN_HOUR,
  RIYADH_UTC_OFFSET_HOURS,
  SESSION_MINUTES,
  TIMEZONE,
} from '../config.js'

// Firestore allows at most 500 writes in one batch.
const BATCH_LIMIT = 500
// Safety limit so an admin can't accidentally create thousands of slots.
export const MAX_GENERATE_DAYS = 60

// ---------------------------------------------------------------------------
// Date helpers (venue time = Asia/Riyadh, UTC+3, no daylight saving)
// ---------------------------------------------------------------------------

// Today's date at the venue as "YYYY-MM-DD".
export function todayAtVenue() {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
}

// Timestamp -> its date at the venue as "YYYY-MM-DD".
export function venueDateOf(timestamp) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(timestamp.toDate())
}

// "2026-11-05" + 14 -> the exact moment 14:00 Riyadh time on that day.
export function venueDateTime(dateStr, hour) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hour - RIYADH_UTC_OFFSET_HOURS))
}

// "2026-11-05" + 3 -> "2026-11-08"
export function addDays(dateStr, days) {
  const day = new Date(`${dateStr}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}

// All dates from start to end (inclusive), as "YYYY-MM-DD" strings.
export function datesBetween(startStr, endStr) {
  const dates = []
  const day = new Date(`${startStr}T00:00:00Z`)
  const last = new Date(`${endStr}T00:00:00Z`)
  while (day <= last) {
    dates.push(day.toISOString().slice(0, 10))
    day.setUTCDate(day.getUTCDate() + 1)
  }
  return dates
}

// Predictable ID: the same game/date/hour always gives the same slot ID.
export function makeSlotId(gameId, dateStr, hour) {
  return `${gameId}_${dateStr}_${String(hour).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export async function getGames() {
  const snap = await getDocs(query(collection(db, 'games'), orderBy('order')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Creates the default games. Games that already exist are left untouched,
// so names changed in the console are not overwritten.
export async function seedGames() {
  const existing = await getGames()
  const existingIds = new Set(existing.map((g) => g.id))

  const batch = writeBatch(db)
  let created = 0
  for (const game of DEFAULT_GAMES) {
    if (existingIds.has(game.id)) continue
    batch.set(doc(db, 'games', game.id), {
      name: game.name,
      description: game.description,
      durationMinutes: SESSION_MINUTES,
      maxPlayers: MAX_PLAYERS,
      order: game.order,
    })
    created++
  }
  if (created > 0) await batch.commit()

  return { created, skipped: DEFAULT_GAMES.length - created }
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

// Creates hourly slots (OPEN_HOUR to LAST_START_HOUR) for every game on every
// date in the range. Existing slots are skipped, never overwritten, so bookings
// and blocked slots stay safe.
export async function generateSlots(startDate, endDate) {
  if (!startDate || !endDate) throw new Error('Pick a start and end date.')
  if (startDate > endDate) throw new Error('Start date must be before end date.')

  const dates = datesBetween(startDate, endDate)
  if (dates.length > MAX_GENERATE_DAYS) {
    throw new Error(`You can generate at most ${MAX_GENERATE_DAYS} days at a time.`)
  }

  const games = await getGames()
  if (games.length === 0) throw new Error('No games found. Seed the games first.')

  // Find slots that already exist in this date range.
  const existingSnap = await getDocs(
    query(
      collection(db, 'slots'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
    ),
  )
  const existingIds = new Set(existingSnap.docs.map((d) => d.id))

  // Build the list of new slots.
  const newSlots = []
  for (const date of dates) {
    for (const game of games) {
      for (let hour = OPEN_HOUR; hour <= LAST_START_HOUR; hour++) {
        const id = makeSlotId(game.id, date, hour)
        if (existingIds.has(id)) continue

        const start = venueDateTime(date, hour)
        const end = new Date(start.getTime() + SESSION_MINUTES * 60 * 1000)
        newSlots.push({
          id,
          data: {
            gameId: game.id,
            gameName: game.name,
            date,
            start: Timestamp.fromDate(start),
            end: Timestamp.fromDate(end),
            status: 'open',
            bookedBy: null,
            bookingId: null,
          },
        })
      }
    }
  }

  // Write in batches of up to 500.
  for (let i = 0; i < newSlots.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const slot of newSlots.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(db, 'slots', slot.id), slot.data)
    }
    await batch.commit()
  }

  const total = dates.length * games.length * (LAST_START_HOUR - OPEN_HOUR + 1)
  return { created: newSlots.length, skipped: total - newSlots.length }
}

// A slot can be booked if it is open and has not started yet.
export function isSlotAvailable(slot, now = new Date()) {
  return slot.status === 'open' && slot.start.toDate() > now
}

// Live list of bookable slots for one game on one date, sorted by time.
// Uses a listener so a slot disappears the moment someone else books it.
// Returns a function that stops listening.
export function subscribeToOpenSlots(gameId, date, onChange, onError) {
  const q = query(
    collection(db, 'slots'),
    where('gameId', '==', gameId),
    where('date', '==', date),
    where('status', '==', 'open'),
  )
  return onSnapshot(
    q,
    (snap) => {
      const slots = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((slot) => isSlotAvailable(slot))
        .sort((a, b) => a.start.toMillis() - b.start.toMillis())
      onChange(slots)
    },
    onError,
  )
}

// Admin: live list of ALL slots (any status) for one game on one date, sorted by time.
export function subscribeToSlots(gameId, date, onChange, onError) {
  const q = query(
    collection(db, 'slots'),
    where('gameId', '==', gameId),
    where('date', '==', date),
  )
  return onSnapshot(
    q,
    (snap) => {
      const slots = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.start.toMillis() - b.start.toMillis())
      onChange(slots)
    },
    onError,
  )
}

// Admin: block an open slot (nobody can book it) or unblock it again.
// Booked slots can't be blocked; cancel the booking first.
export async function setSlotBlocked(slotId, blocked) {
  const slotRef = doc(db, 'slots', slotId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(slotRef)
    if (!snap.exists()) throw new Error('Slot not found.')
    const { status } = snap.data()

    if (blocked && status !== 'open') throw new Error('Only open slots can be blocked.')
    if (!blocked && status !== 'blocked') throw new Error('This slot is not blocked.')

    tx.update(slotRef, { status: blocked ? 'blocked' : 'open' })
  })
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

// Fields that make a slot free again (used when cancelling or moving a booking).
const OPEN_SLOT = { status: 'open', bookedBy: null, bookingId: null }

// Per-customer time lock: a customer can hold only ONE confirmed booking per hour,
// even across different games. The lock ID is the slot's date + hour with the user's ID:
//   slot "the-maze_2026-11-05_15" -> lock "userSlots/{uid}_2026-11-05_15"
// Every game at 15:00 that day maps to the same lock. firestore.rules builds it the same way.
export function userSlotId(uid, slotId) {
  const [, date, hour] = slotId.split('_')
  return `${uid}_${date}_${hour}`
}

function userSlotRef(uid, slotId) {
  return doc(db, 'userSlots', userSlotId(uid, slotId))
}

// Thrown when the customer already has a booking at that hour (any game).
export class OverlapError extends Error {
  constructor() {
    super('You already have a booking at this time.')
    this.name = 'OverlapError'
  }
}

// Thrown when the chosen slot is no longer free (someone else got it first).
export class SlotUnavailableError extends Error {
  constructor() {
    super('This time was just taken, pick another.')
    this.name = 'SlotUnavailableError'
  }
}

// Thrown when a customer tries to change a booking less than 6 hours before it starts.
export class BookingLockedError extends Error {
  constructor() {
    super(`Changes close ${EDIT_LOCK_HOURS} hours before your session.`)
    this.name = 'BookingLockedError'
  }
}

// The 6-hour rule: a customer can edit or cancel only a confirmed booking,
// and only until EDIT_LOCK_HOURS before it starts.
// The same rule is enforced in firestore.rules.
export function canModifyBooking(booking, now = new Date()) {
  const lockTime = booking.start.toMillis() - EDIT_LOCK_HOURS * 60 * 60 * 1000
  return booking.status === 'confirmed' && now.getTime() < lockTime
}

// Splits bookings (sorted soonest first) into upcoming (soonest first)
// and past (most recent first).
export function splitUpcomingPast(bookings, now = new Date()) {
  const upcoming = bookings.filter((b) => b.start.toDate() >= now)
  const past = bookings.filter((b) => b.start.toDate() < now).reverse()
  return { upcoming, past }
}

// Live list of one customer's bookings, soonest first.
// Returns a function that stops listening.
export function subscribeToMyBookings(userId, onChange, onError) {
  const q = query(collection(db, 'bookings'), where('userId', '==', userId))
  return onSnapshot(
    q,
    (snap) => {
      const bookings = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.start.toMillis() - b.start.toMillis())
      onChange(bookings)
    },
    onError,
  )
}

// Admin: live list of ALL bookings, soonest first.
export function subscribeToAllBookings(onChange, onError) {
  return onSnapshot(
    collection(db, 'bookings'),
    (snap) => {
      const bookings = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.start.toMillis() - b.start.toMillis())
      onChange(bookings)
    },
    onError,
  )
}

// Admin: numbers for the stats bar (upcoming confirmed sessions and players expected).
export function bookingStats(bookings, now = new Date()) {
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && b.start.toDate() > now)
  return {
    upcomingSessions: upcoming.length,
    playersExpected: upcoming.reduce((sum, b) => sum + b.players, 0),
  }
}

// Admin: filter bookings by venue date ("YYYY-MM-DD"), game, and status.
// An empty filter value means "all".
export function filterBookings(bookings, { date, gameId, status }) {
  return bookings.filter(
    (b) =>
      (!date || venueDateOf(b.start) === date) &&
      (!gameId || b.gameId === gameId) &&
      (!status || b.status === status),
  )
}

// Returns an error message, or null if the number of players is valid.
export function validatePlayers(players, maxPlayers = MAX_PLAYERS) {
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > maxPlayers) {
    return `Players must be a whole number from ${MIN_PLAYERS} to ${maxPlayers}.`
  }
  return null
}

// Books a slot in ONE transaction, so two people can never book the same slot
// and one customer can never hold two bookings at the same hour:
//   1. read the slot and check it is still open and in the future
//   2. read the customer's lock for that hour and check it doesn't exist
//   3. mark the slot as booked, create the booking, create the lock
// If two requests race, Firestore retries the slower one, which then fails.
export async function bookSlot({ slotId, players, user, profile }) {
  const playersError = validatePlayers(players)
  if (playersError) throw new Error(playersError)

  const slotRef = doc(db, 'slots', slotId)
  const bookingRef = doc(collection(db, 'bookings')) // new ID, created in the transaction
  const lockRef = userSlotRef(user.uid, slotId)

  try {
    await runTransaction(db, async (tx) => {
      const slotSnap = await tx.get(slotRef)
      const lockSnap = await tx.get(lockRef)
      if (!slotSnap.exists() || !isSlotAvailable(slotSnap.data())) {
        throw new SlotUnavailableError()
      }
      if (lockSnap.exists()) throw new OverlapError()
      const slot = slotSnap.data()

      tx.set(lockRef, { uid: user.uid, bookingId: bookingRef.id, createdAt: serverTimestamp() })

      // The slot stores which booking holds it, so the security rules can check both sides.
      tx.update(slotRef, { status: 'booked', bookedBy: user.uid, bookingId: bookingRef.id })
      tx.set(bookingRef, {
        slotId,
        gameId: slot.gameId,
        gameName: slot.gameName,
        userId: user.uid,
        userName: profile.name,
        userEmail: profile.email,
        start: slot.start,
        end: slot.end,
        players,
        status: 'confirmed',
        cancelledBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
  } catch (err) {
    // The security rules also reject booking a slot that is not open.
    if (err.code === 'permission-denied') throw new SlotUnavailableError()
    throw err
  }

  return bookingRef.id
}

// Inside a transaction: delete the customer's time lock if it belongs to this booking.
// (Bookings made before locks existed have none, and deleting a missing doc is denied.)
async function readOwnLock(tx, booking, bookingId) {
  const lockRef = userSlotRef(booking.userId, booking.slotId)
  const lockSnap = await tx.get(lockRef)
  const isOwn = lockSnap.exists() && lockSnap.data().bookingId === bookingId
  return { lockRef, isOwn }
}

// Customer cancels their own booking in ONE transaction:
// check owner + 6-hour rule -> mark booking cancelled -> reopen the slot -> remove the lock.
export async function cancelBooking(bookingId, userId) {
  const bookingRef = doc(db, 'bookings', bookingId)

  await runTransaction(db, async (tx) => {
    const bookingSnap = await tx.get(bookingRef)
    if (!bookingSnap.exists()) throw new Error('Booking not found.')
    const booking = bookingSnap.data()

    if (booking.userId !== userId) throw new Error('This is not your booking.')
    if (!canModifyBooking(booking)) throw new BookingLockedError()
    const lock = await readOwnLock(tx, booking, bookingId)

    tx.update(bookingRef, {
      status: 'cancelled',
      cancelledBy: 'customer',
      updatedAt: serverTimestamp(),
    })
    tx.update(doc(db, 'slots', booking.slotId), OPEN_SLOT)
    if (lock.isOwn) tx.delete(lock.lockRef)
  })
}

// One booking by ID. Returns null if it doesn't exist or isn't readable by this user.
export async function getBooking(bookingId) {
  try {
    const snap = await getDoc(doc(db, 'bookings', bookingId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (err) {
    // Security rules hide other people's bookings.
    if (err.code === 'permission-denied') return null
    throw err
  }
}

// Customer edits their booking (game, date, time, and/or players) in ONE transaction:
//   1. check owner + 6-hour rule on the CURRENT booking
//   2. check the customer has no OTHER booking at the new hour (time lock)
//   3. if the slot changed: check the new slot is open, release the old slot,
//      book the new slot
//   4. if the hour changed: delete the old lock, create the new one
//      (same hour, different game: the lock stays)
//   5. update the booking (updatedAt)
// Changing only the players keeps the same slot and lock.
export async function editBooking(bookingId, userId, { slotId, players }) {
  const playersError = validatePlayers(players)
  if (playersError) throw new Error(playersError)

  const bookingRef = doc(db, 'bookings', bookingId)
  let slotChanged = false

  try {
    await runTransaction(db, async (tx) => {
      // All reads first (Firestore transactions require reads before writes).
      const bookingSnap = await tx.get(bookingRef)
      if (!bookingSnap.exists()) throw new Error('Booking not found.')
      const booking = bookingSnap.data()

      if (booking.userId !== userId) throw new Error('This is not your booking.')
      if (!canModifyBooking(booking)) throw new BookingLockedError()

      slotChanged = slotId !== booking.slotId
      const newLockRef = userSlotRef(userId, slotId)
      const hourChanged = newLockRef.id !== userSlotId(userId, booking.slotId)

      const newLockSnap = await tx.get(newLockRef)
      if (newLockSnap.exists() && newLockSnap.data().bookingId !== bookingId) {
        throw new OverlapError()
      }
      const oldLock = hourChanged ? await readOwnLock(tx, booking, bookingId) : null

      let newSlot = null
      if (slotChanged) {
        const newSlotSnap = await tx.get(doc(db, 'slots', slotId))
        if (!newSlotSnap.exists() || !isSlotAvailable(newSlotSnap.data())) {
          throw new SlotUnavailableError()
        }
        newSlot = newSlotSnap.data()
      }

      // Writes.
      if (oldLock?.isOwn) tx.delete(oldLock.lockRef)
      // Also creates a missing lock for bookings made before locks existed.
      if (!newLockSnap.exists()) {
        tx.set(newLockRef, { uid: userId, bookingId, createdAt: serverTimestamp() })
      }

      if (!slotChanged) {
        // Only the players changed: same slot, just update the count.
        tx.update(bookingRef, { players, updatedAt: serverTimestamp() })
        return
      }

      tx.update(doc(db, 'slots', booking.slotId), OPEN_SLOT)
      tx.update(doc(db, 'slots', slotId), { status: 'booked', bookedBy: userId, bookingId })
      tx.update(bookingRef, {
        slotId,
        gameId: newSlot.gameId,
        gameName: newSlot.gameName,
        start: newSlot.start,
        end: newSlot.end,
        players,
        updatedAt: serverTimestamp(),
      })
    })
  } catch (err) {
    // The security rules also reject booking a slot that is not open.
    if (err.code === 'permission-denied' && slotChanged) throw new SlotUnavailableError()
    throw err
  }
}

// Admin cancels any confirmed booking, at any time (no 6-hour rule),
// in ONE transaction: mark booking cancelled -> reopen the slot -> remove the customer's lock.
export async function adminCancelBooking(bookingId) {
  const bookingRef = doc(db, 'bookings', bookingId)

  await runTransaction(db, async (tx) => {
    const bookingSnap = await tx.get(bookingRef)
    if (!bookingSnap.exists()) throw new Error('Booking not found.')
    const booking = bookingSnap.data()
    if (booking.status !== 'confirmed') throw new Error('This booking is already cancelled.')
    const lock = await readOwnLock(tx, booking, bookingId)

    tx.update(bookingRef, {
      status: 'cancelled',
      cancelledBy: 'admin',
      updatedAt: serverTimestamp(),
    })
    tx.update(doc(db, 'slots', booking.slotId), OPEN_SLOT)
    if (lock.isOwn) tx.delete(lock.lockRef)
  })
}
