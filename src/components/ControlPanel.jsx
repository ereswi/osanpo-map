import { useState } from 'react'
import { DEFAULT_CENTER_LABEL } from '../lib/constants'

export function ControlPanel({
  user,
  authRequired,
  isAuthenticated,
  status,
  error,
  syncError,
  syncStatus,
  position,
  visitedCount,
  totalDistanceMeters,
  isTracking,
  isFogEnabled,
  isLocationIconEnabled,
  wakeLockActive,
  onStartStop,
  onBlackout,
  onToggleFog,
  onToggleLocationIcon,
  onOpenHistory,
  onClear,
  onSignOut,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)

  const handleClear = () => {
    onClear()
    setIsResetConfirmOpen(false)
    setIsMenuOpen(false)
  }

  const handleOpenHistory = () => {
    onOpenHistory()
    setIsMenuOpen(false)
  }

  return (
    <section className="hero-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Osanpo Map Prototype</p>
          <h1>歩いた場所をグリッドで埋めていく散歩地図</h1>
        </div>
        <button
          type="button"
          className="menu-trigger"
          aria-expanded={isMenuOpen}
          aria-label="設定メニューを開く"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {isMenuOpen ? (
        <div className="settings-menu">
          <div className="account-card settings-account-card">
            <div>
              <span className="account-label">
                {authRequired ? 'ログイン中' : '認証状態'}
              </span>
              <strong>
                {isAuthenticated
                  ? user?.displayName ?? user?.email ?? 'ログイン済み'
                  : '未ログイン'}
              </strong>
            </div>
            {authRequired && user ? (
              <button type="button" className="ghost-button" onClick={onSignOut}>
                ログアウト
              </button>
            ) : null}
          </div>

          <button type="button" className="settings-item" onClick={handleOpenHistory}>
            <span>履歴</span>
            <strong>一覧を見る</strong>
          </button>
          <button type="button" className="settings-item" onClick={onToggleFog}>
            <span>雲の表示</span>
            <strong>{isFogEnabled ? '表示中' : '非表示'}</strong>
          </button>
          <button
            type="button"
            className="settings-item"
            onClick={onToggleLocationIcon}
          >
            <span>現在地アイコン</span>
            <strong>{isLocationIconEnabled ? '表示中' : '非表示'}</strong>
          </button>
          <button
            type="button"
            className="settings-item settings-item--danger"
            onClick={() => setIsResetConfirmOpen(true)}
          >
            <span>記録をリセット</span>
            <strong>確認して実行</strong>
          </button>
        </div>
      ) : null}

      {isResetConfirmOpen ? (
        <div className="confirm-card" role="alertdialog" aria-modal="false">
          <strong>探索記録をリセットしますか？</strong>
          <p>
            探索済みグリッド、歩行ログ、履歴をこの端末から削除します。この操作は元に戻せません。
          </p>
          <div className="confirm-actions">
            <button type="button" className="danger-button" onClick={handleClear}>
              リセットする
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setIsResetConfirmOpen(false)}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : null}

      <p className="lede">
        現在地を追跡しながら通過した50mグリッドを蓄積します。未探索エリアは雲で隠し、探索済みの場所だけ地図が見えるようにします。
      </p>

      <div className="control-row">
        <button type="button" className="primary-button" onClick={onStartStop}>
          {isTracking ? '記録を停止' : '記録を開始'}
        </button>
        <button type="button" className="secondary-button" onClick={onBlackout}>
          黒画面モード
        </button>
      </div>

      <div className="status-grid">
        <article>
          <span>状態</span>
          <strong>{status}</strong>
        </article>
        <article>
          <span>探索済み</span>
          <strong>{visitedCount} グリッド</strong>
        </article>
        <article>
          <span>歩行距離</span>
          <strong>{(totalDistanceMeters / 1000).toFixed(2)} km</strong>
        </article>
        <article>
          <span>画面スリープ防止</span>
          <strong>{wakeLockActive ? '有効' : '未使用'}</strong>
        </article>
        <article>
          <span>Firestore</span>
          <strong>{syncStatus}</strong>
        </article>
      </div>

      {position ? (
        <p className="meta">
          現在地: {position.lat.toFixed(5)}, {position.lng.toFixed(5)} 精度 約
          {Math.round(position.accuracy)}m
        </p>
      ) : (
        <p className="meta">
          初期表示は{DEFAULT_CENTER_LABEL}です。記録開始または地図の現在地ボタンで現在地へ移動します。
        </p>
      )}

      {error ? <p className="error-banner">{error}</p> : null}
      {syncError ? <p className="error-banner">{syncError}</p> : null}
    </section>
  )
}
