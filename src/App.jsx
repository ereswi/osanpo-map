import { AuthGate } from './components/AuthGate'
import { WalkExperience } from './components/WalkExperience'
import { useAuth } from './hooks/useAuth'
import './App.css'

function App() {
  const auth = useAuth()
  const storageScope = auth.user?.uid ?? 'locked'

  return (
    <AuthGate auth={auth}>
      <WalkExperience
        key={storageScope}
        storageScope={storageScope}
        user={auth.user}
        authRequired={auth.authRequired}
        isAuthenticated={auth.isAuthenticated}
        canSync={auth.isAuthenticated && auth.isAllowed}
        onSignOut={auth.signOut}
      />
    </AuthGate>
  )
}

export default App
