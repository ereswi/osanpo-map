import { LoginForm } from './LoginForm'

export function AuthGate({ auth, children }) {
  if (auth.configError || !auth.isReady || !auth.isAuthenticated || !auth.isAllowed) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Osanpo Map</p>
          <h1>散歩記録を始めるにはログインが必要です</h1>
          <p className="lede">
            アプリ本体はログイン完了後にだけ表示します。初めての方も登録済みの方も、Google アカウントで続行できます。
          </p>

          {auth.configError ? (
            <p className="error-banner">{auth.configError}</p>
          ) : null}

          {!auth.configError && !auth.isReady ? (
            <p className="meta">認証状態を確認しています...</p>
          ) : null}

          {!auth.configError && auth.isReady && !auth.isAuthenticated ? (
            <LoginForm auth={auth} />
          ) : null}

          {auth.error ? <p className="error-banner">{auth.error}</p> : null}
        </section>
      </main>
    )
  }

  return children
}
