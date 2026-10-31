// Security rules tests. Runs against the local Firestore emulator (never the real database).
// Run with: npm run test:rules
//
// Each write below copies what src/lib/scheduling.js sends in its transactions.
// (Batches are used here; the rules check a batch exactly like a transaction's writes.)
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'

const env = await initializeTestEnvironment({
  projectId: 'demo-test',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
})

const HOUR = 3600 * 1000
const ts = (msFromNow) => Timestamp.fromMillis(Date.now() + msFromNow)
const DAY = '2026-12-01' // slot IDs only need the real format: {gameId}_{YYYY-MM-DD}_{HH}

// Slot IDs and times. All "future" ones are > 1 hour away (editable).
const T15 = { start: ts(48 * HOUR), end: ts(49 * HOUR) }
const T16 = { start: ts(49 * HOUR), end: ts(50 * HOUR) }
const T18 = { start: ts(51 * HOUR), end: ts(52 * HOUR) }
const SOON = { start: ts(0.5 * HOUR), end: ts(1.5 * HOUR) } // 30 min away: inside the 1-hour lock
const TWO_HOURS = { start: ts(2 * HOUR), end: ts(3 * HOUR) } // 2 h away: still editable
const MAZE_2H = `the-maze_${DAY}_13`
const MAZE_15 = `the-maze_${DAY}_15`
const ESCAPE_15 = `escape-room_${DAY}_15`
const ESCAPE_16 = `escape-room_${DAY}_16`
const MAZE_18 = `the-maze_${DAY}_18`
const MAZE_SOON = `the-maze_${DAY}_12`
const HELD = `mystery-lab_${DAY}_20` // Alice already holds this one (b-held)

function slotDoc(slotId, times, extra = {}) {
  const gameId = slotId.split('_')[0]
  return { gameId, gameName: gameId, date: DAY, ...times, status: 'open', bookedBy: null, bookingId: null, ...extra }
}
const lockId = (uid, slotId) => `${uid}_${slotId.split('_')[1]}_${slotId.split('_')[2]}`
const OPEN = { status: 'open', bookedBy: null, bookingId: null }

async function seed() {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users/alice'), { name: 'Alice', email: 'a@x.com', role: 'customer' })
    await setDoc(doc(db, 'users/bob'), { name: 'Bob', email: 'b@x.com', role: 'customer' })
    await setDoc(doc(db, 'users/admin'), { name: 'Admin', email: 'ad@x.com', role: 'admin' })
    await setDoc(doc(db, 'games/the-maze'), { name: 'The Maze', order: 1 })
    await setDoc(doc(db, 'slots', MAZE_15), slotDoc(MAZE_15, T15))
    await setDoc(doc(db, 'slots', ESCAPE_15), slotDoc(ESCAPE_15, T15))
    await setDoc(doc(db, 'slots', ESCAPE_16), slotDoc(ESCAPE_16, T16))
    await setDoc(doc(db, 'slots', MAZE_18), slotDoc(MAZE_18, T18))

    // Existing bookings for Alice: one inside the lock, one outside (with their locks).
    const base = { userId: 'alice', userName: 'Alice', userEmail: 'a@x.com', players: 3, status: 'confirmed', cancelledBy: null }
    const held = { start: ts(60 * HOUR), end: ts(61 * HOUR) }
    await setDoc(doc(db, 'slots', MAZE_SOON), slotDoc(MAZE_SOON, SOON, { status: 'booked', bookedBy: 'alice', bookingId: 'b-soon' }))
    await setDoc(doc(db, 'slots', HELD), slotDoc(HELD, held, { status: 'booked', bookedBy: 'alice', bookingId: 'b-held' }))
    await setDoc(doc(db, 'bookings/b-soon'), { ...base, slotId: MAZE_SOON, gameId: 'the-maze', gameName: 'the-maze', ...SOON })
    await setDoc(doc(db, 'bookings/b-held'), { ...base, slotId: HELD, gameId: 'mystery-lab', gameName: 'mystery-lab', ...held })
    await setDoc(doc(db, 'userSlots', lockId('alice', MAZE_SOON)), { uid: 'alice', bookingId: 'b-soon' })
    await setDoc(doc(db, 'userSlots', lockId('alice', HELD)), { uid: 'alice', bookingId: 'b-held' })
    // A booking 2 hours away: would have been locked under the old 6-hour rule, editable now.
    await setDoc(doc(db, 'slots', MAZE_2H), slotDoc(MAZE_2H, TWO_HOURS, { status: 'booked', bookedBy: 'alice', bookingId: 'b-2h' }))
    await setDoc(doc(db, 'bookings/b-2h'), { ...base, slotId: MAZE_2H, gameId: 'the-maze', gameName: 'the-maze', ...TWO_HOURS })
    await setDoc(doc(db, 'userSlots', lockId('alice', MAZE_2H)), { uid: 'alice', bookingId: 'b-2h' })
  })
}

let nextId = 0
// Same writes as bookSlot(): slot -> booked, new booking, new time lock.
async function book(db, uid, slotId, { overrides = {}, withLock = true } = {}) {
  const bookingId = `b${++nextId}`
  const s = (await getDoc(doc(db, 'slots', slotId))).data()
  const b = writeBatch(db)
  b.update(doc(db, 'slots', slotId), { status: 'booked', bookedBy: uid, bookingId })
  b.set(doc(db, 'bookings', bookingId), {
    slotId, gameId: s.gameId, gameName: s.gameName, userId: uid, userName: 'U', userEmail: 'u@x.com',
    start: s.start, end: s.end, players: 3, status: 'confirmed', cancelledBy: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides,
  })
  if (withLock) {
    b.set(doc(db, 'userSlots', lockId(uid, slotId)), { uid, bookingId, createdAt: serverTimestamp() })
  }
  await b.commit()
  return bookingId
}

// Same writes as cancelBooking() / adminCancelBooking().
function cancel(db, bookingId, slotId, uid, by = 'customer', { deleteLock = true } = {}) {
  const b = writeBatch(db)
  b.update(doc(db, 'bookings', bookingId), { status: 'cancelled', cancelledBy: by, updatedAt: serverTimestamp() })
  b.update(doc(db, 'slots', slotId), OPEN)
  if (deleteLock) b.delete(doc(db, 'userSlots', lockId(uid, slotId)))
  return b.commit()
}

const as = (uid) => env.authenticatedContext(uid).firestore()
const results = []
async function check(name, expect, fn) {
  await seed()
  try {
    await (expect === 'allow' ? assertSucceeds(fn()) : assertFails(fn()))
    results.push(`PASS  ${name}`)
  } catch (err) {
    results.push(`FAIL  ${name}  -> ${err.message.split('\n')[0]}`)
  }
}

// ---- users ----
await check('sign-up creates own profile as customer', 'allow', () =>
  setDoc(doc(as('carol'), 'users/carol'), { name: 'Carol', email: 'c@x.com', role: 'customer', createdAt: serverTimestamp() }))
await check('sign-up as admin is rejected', 'deny', () =>
  setDoc(doc(as('carol'), 'users/carol'), { name: 'Carol', email: 'c@x.com', role: 'admin', createdAt: serverTimestamp() }))
await check('customer cannot change own role', 'deny', () => updateDoc(doc(as('alice'), 'users/alice'), { role: 'admin' }))
await check("customer cannot read another user's profile", 'deny', () => getDoc(doc(as('alice'), 'users/bob')))
await check('signed-out visitor cannot read slots', 'deny', () =>
  getDoc(doc(env.unauthenticatedContext().firestore(), 'slots', MAZE_15)))

// ---- games ----
await check('customer cannot write games', 'deny', () => setDoc(doc(as('alice'), 'games/x'), { name: 'X' }))
await check('admin can write games', 'allow', () => setDoc(doc(as('admin'), 'games/x'), { name: 'X' }))

// ---- booking a slot ----
await check('customer books an open future slot', 'allow', () => book(as('bob'), 'bob', MAZE_15))
await check('second customer cannot book an already booked slot', 'deny', async () => {
  await book(as('alice'), 'alice', MAZE_15)
  return book(as('bob'), 'bob', MAZE_15)
})
await check('booking with 8 players is rejected', 'deny', () =>
  book(as('bob'), 'bob', MAZE_15, { overrides: { players: 8 } }))
await check('booking with a fake start time is rejected', 'deny', () =>
  book(as('bob'), 'bob', MAZE_15, { overrides: { start: ts(99 * HOUR) } }))
await check('booking for another user is rejected', 'deny', () =>
  book(as('bob'), 'bob', MAZE_15, { overrides: { userId: 'alice' } }))
await check('customer cannot mark a slot booked without a booking', 'deny', () =>
  updateDoc(doc(as('bob'), 'slots', MAZE_15), { status: 'booked', bookedBy: 'bob', bookingId: 'nothing' }))

// ---- NEW: one booking per customer per hour (userSlots lock) ----
await check('overlap: Maze 15:00 then Escape Room 15:00 same day is rejected', 'deny', async () => {
  await book(as('bob'), 'bob', MAZE_15)
  return book(as('bob'), 'bob', ESCAPE_15)
})
await check('overlap: Maze 15:00 then Escape Room 16:00 same day is allowed', 'allow', async () => {
  await book(as('bob'), 'bob', MAZE_15)
  return book(as('bob'), 'bob', ESCAPE_16)
})
await check('overlap: two different customers at 15:00 in different games is allowed', 'allow', async () => {
  await book(as('alice'), 'alice', MAZE_15)
  return book(as('bob'), 'bob', ESCAPE_15)
})
await check('overlap: booking without creating the time lock is rejected', 'deny', () =>
  book(as('bob'), 'bob', MAZE_15, { withLock: false }))
await check("overlap: customer cannot create a lock for someone else's ID", 'deny', () =>
  setDoc(doc(as('bob'), 'userSlots', lockId('alice', ESCAPE_16)), { uid: 'alice', bookingId: 'b-held', createdAt: serverTimestamp() }))
await check('overlap: customer cannot delete own lock while booking stays confirmed', 'deny', () => {
  const db = as('alice')
  return writeBatch(db).delete(doc(db, 'userSlots', lockId('alice', HELD))).commit()
})
await check('overlap: after cancelling 15:00, booking another game at 15:00 is allowed', 'allow', async () => {
  const id = await book(as('bob'), 'bob', MAZE_15)
  await cancel(as('bob'), id, MAZE_15, 'bob')
  return book(as('bob'), 'bob', ESCAPE_15)
})
await check("customer cannot read another customer's lock", 'deny', () =>
  getDoc(doc(as('bob'), 'userSlots', lockId('alice', HELD))))

// ---- reading bookings ----
await check('customer reads own booking', 'allow', () => getDoc(doc(as('alice'), 'bookings/b-held')))
await check("customer cannot read another customer's booking", 'deny', () => getDoc(doc(as('bob'), 'bookings/b-held')))
await check('admin reads any booking', 'allow', () => getDoc(doc(as('admin'), 'bookings/b-held')))

// ---- cancel ----
await check('customer cancels own booking > 1h before (frees slot and lock)', 'allow', () =>
  cancel(as('alice'), 'b-held', HELD, 'alice'))
await check('1-hour lock: customer cancels a booking 2 hours away', 'allow', () =>
  cancel(as('alice'), 'b-2h', MAZE_2H, 'alice'))
await check('1-hour lock: customer changes players on a booking 2 hours away', 'allow', () =>
  updateDoc(doc(as('alice'), 'bookings/b-2h'), { players: 6, updatedAt: serverTimestamp() }))
await check('customer cannot cancel but keep the time lock', 'deny', () =>
  cancel(as('alice'), 'b-held', HELD, 'alice', 'customer', { deleteLock: false }))
await check('customer cannot reopen slot while booking stays confirmed', 'deny', () =>
  updateDoc(doc(as('alice'), 'slots', HELD), OPEN))
await check('1-hour lock: customer cannot cancel 30 minutes before', 'deny', () =>
  cancel(as('alice'), 'b-soon', MAZE_SOON, 'alice'))
await check("customer cannot cancel another customer's booking", 'deny', () =>
  cancel(as('bob'), 'b-held', HELD, 'alice'))
await check('customer cannot pretend to be admin when cancelling', 'deny', () =>
  cancel(as('alice'), 'b-soon', MAZE_SOON, 'alice', 'admin'))
await check('admin cancels any booking, even inside the lock (frees lock)', 'allow', () =>
  cancel(as('admin'), 'b-soon', MAZE_SOON, 'alice', 'admin'))

// ---- edit ----
await check('customer changes players only (> 1h, lock kept)', 'allow', () =>
  updateDoc(doc(as('alice'), 'bookings/b-held'), { players: 5, updatedAt: serverTimestamp() }))
await check('1-hour lock: customer cannot change players 30 minutes before', 'deny', () =>
  updateDoc(doc(as('alice'), 'bookings/b-soon'), { players: 5, updatedAt: serverTimestamp() }))
await check('customer moves booking to another hour (moves slot and lock)', 'allow', async () => {
  const db = as('alice')
  const s = (await getDoc(doc(db, 'slots', MAZE_18))).data()
  const b = writeBatch(db)
  b.update(doc(db, 'slots', HELD), OPEN)
  b.update(doc(db, 'slots', MAZE_18), { status: 'booked', bookedBy: 'alice', bookingId: 'b-held' })
  b.delete(doc(db, 'userSlots', lockId('alice', HELD)))
  b.set(doc(db, 'userSlots', lockId('alice', MAZE_18)), { uid: 'alice', bookingId: 'b-held', createdAt: serverTimestamp() })
  b.update(doc(db, 'bookings/b-held'), {
    slotId: MAZE_18, gameId: s.gameId, gameName: s.gameName, start: s.start, end: s.end, updatedAt: serverTimestamp(),
  })
  return b.commit()
})
await check('customer cannot move booking to another hour without moving the lock', 'deny', async () => {
  const db = as('alice')
  const s = (await getDoc(doc(db, 'slots', MAZE_18))).data()
  const b = writeBatch(db)
  b.update(doc(db, 'slots', HELD), OPEN)
  b.update(doc(db, 'slots', MAZE_18), { status: 'booked', bookedBy: 'alice', bookingId: 'b-held' })
  b.update(doc(db, 'bookings/b-held'), {
    slotId: MAZE_18, gameId: s.gameId, gameName: s.gameName, start: s.start, end: s.end, updatedAt: serverTimestamp(),
  })
  return b.commit()
})
await check('customer cannot move booking onto an hour where they already have one', 'deny', async () => {
  await book(as('alice'), 'alice', MAZE_15) // Alice now holds 15:00
  const db = as('alice')
  const s = (await getDoc(doc(db, 'slots', ESCAPE_15))).data()
  const b = writeBatch(db)
  b.update(doc(db, 'slots', HELD), OPEN)
  b.update(doc(db, 'slots', ESCAPE_15), { status: 'booked', bookedBy: 'alice', bookingId: 'b-held' })
  b.delete(doc(db, 'userSlots', lockId('alice', HELD)))
  b.set(doc(db, 'userSlots', lockId('alice', ESCAPE_15)), { uid: 'alice', bookingId: 'b-held', createdAt: serverTimestamp() })
  b.update(doc(db, 'bookings/b-held'), {
    slotId: ESCAPE_15, gameId: s.gameId, gameName: s.gameName, start: s.start, end: s.end, updatedAt: serverTimestamp(),
  })
  return b.commit()
})

await env.cleanup()
console.log(results.join('\n'))
const failed = results.filter((r) => r.startsWith('FAIL')).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
