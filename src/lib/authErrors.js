// Turns Firebase error codes into messages people can understand.
export function friendlyAuthError(err) {
  switch (err?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/missing-password':
      return 'Please enter your password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.'
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in Firebase yet.'
    case 'permission-denied':
      return 'You do not have permission to do that.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
