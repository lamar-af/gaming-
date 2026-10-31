// Keeps track of who is signed in and their role (from users/{uid}).
import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // Firebase Auth user
  const [profile, setProfile] = useState(null) // users/{uid} document
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let stopProfile = null

    const stopAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (stopProfile) {
        stopProfile()
        stopProfile = null
      }
      setUser(firebaseUser)
      setProfile(null)
      setError(null)

      if (!firebaseUser) {
        setLoading(false)
        return
      }

      // Live listener: if an admin changes the role in the console, the app updates.
      setLoading(true)
      stopProfile = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (snap) => {
          // Right after sign-up the document may not exist yet; keep waiting for it.
          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() })
            setLoading(false)
          }
        },
        (err) => {
          setError(err)
          setLoading(false)
        },
      )
    })

    return () => {
      stopAuth()
      if (stopProfile) stopProfile()
    }
  }, [])

  async function signUp(name, email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: name })
    // Every new account is a customer. Admins are set manually in the Firebase console.
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      email,
      role: 'customer',
      createdAt: serverTimestamp(),
    })
  }

  function logIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  function logOut() {
    return signOut(auth)
  }

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    loading,
    error,
    signUp,
    logIn,
    logOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
