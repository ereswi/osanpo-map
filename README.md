# Osanpo Map

React + Vite で作った散歩地図アプリです。公開先は `https://<user>.github.io/osanpo-map/` を想定しています。

## 開発

```powershell
npm.cmd install
npm.cmd run dev
```

同じ Wi-Fi のスマートフォンから確認する場合:

```powershell
npm.cmd run dev -- --host 0.0.0.0 --port 5173
```

ローカル IP 経由の `http://192.168.x.x:5173` では iOS Safari の位置情報が失敗することがあります。本番の GitHub Pages は HTTPS なので、位置情報確認は公開後の URL でも行ってください。

## GitHub Pages

`vite.config.js` で `base: '/osanpo-map/'` を設定済みです。リポジトリ名を変える場合はこの値も更新してください。

ビルド確認:

```powershell
npm.cmd run build
```

## Firebase 設定

`.env.example` をもとに `.env` を作成し、Firebase の Web アプリ設定を入れます。

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_REQUIRE_AUTH=true
```

Firebase Console 側で必要な設定:

- Authentication で `Google` プロバイダを有効化する
- Authentication の `Authorized domains` に、実際に開いているホスト名を追加する
- Firestore Database を有効化する
- `firestore.rules` をそのまま適用する

Firestore ルールを CLI で適用する場合:

```powershell
firebase deploy --only firestore:rules
```

## セキュリティ方針

保存先は `users/{uid}/devices/{deviceId}` です。Firestore ルールでは次を確認します。

- ログイン済みであること
- `request.auth.uid` と URL 上の `userId` が一致すること
- 書き込みデータの `userId`、`deviceId`、`email` が認証情報と一致すること
- 想定外フィールドを書き込めないこと
