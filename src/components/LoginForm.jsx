import { useState } from 'react'

export function LoginForm({ auth }) {
  const [mode, setMode] = useState('returning')

  return (
    <div className="auth-form-shell">
      <div className="auth-mode-switch" role="tablist" aria-label="利用状況">
        <button
          type="button"
          className={mode === 'returning' ? 'auth-mode-button is-active' : 'auth-mode-button'}
          onClick={() => setMode('returning')}
        >
          登録済み
        </button>
        <button
          type="button"
          className={mode === 'new' ? 'auth-mode-button is-active' : 'auth-mode-button'}
          onClick={() => setMode('new')}
        >
          はじめて
        </button>
      </div>

      <div className="auth-provider-card">
        <h2>{mode === 'new' ? '新しく始める' : 'ログインして続ける'}</h2>
        <p className="meta">
          {mode === 'new'
            ? 'Google アカウントを使って、このアプリ用の記録スペースを作成します。'
            : '前回と同じ Google アカウントでログインすると、保存済みの記録にアクセスできます。'}
        </p>
        <button
          type="button"
          className="primary-button auth-button"
          disabled={auth.isSubmitting}
          onClick={() => {
            void auth.signIn()
          }}
        >
          {auth.isSubmitting
            ? 'Google ログインへ移動中...'
            : mode === 'new'
              ? 'Google で始める'
              : 'Google でログイン'}
        </button>
      </div>
    </div>
  )
}
