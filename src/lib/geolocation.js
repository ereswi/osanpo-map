export function getGeolocationSupportError() {
  if (!('geolocation' in navigator)) {
    return 'このブラウザでは Geolocation API が使えません。'
  }

  if (!window.isSecureContext) {
    return '位置情報は HTTPS または localhost でのみ利用できます。PCでは http://localhost:5173/osanpo-map/ を開くか、GitHub Pages の https:// 版で確認してください。'
  }

  return ''
}

export function toMapPoint(geoPosition) {
  return {
    lat: geoPosition.coords.latitude,
    lng: geoPosition.coords.longitude,
    accuracy: geoPosition.coords.accuracy,
    recordedAt: new Date().toISOString(),
  }
}

export function getLocationErrorMessage(error) {
  const supportError = getGeolocationSupportError()
  if (supportError) return supportError

  if (error?.message?.includes('Only secure origins are allowed')) {
    return '位置情報は HTTPS または localhost でのみ利用できます。PCでは http://localhost:5173/osanpo-map/ を開くか、GitHub Pages の https:// 版で確認してください。'
  }

  if (error?.code === 1) {
    return '位置情報の利用がブロックされています。ブラウザ設定からこのサイトの位置情報を許可してください。'
  }

  if (error?.code === 2) {
    return '現在地を特定できませんでした。電波状況やOSの位置情報設定を確認してください。'
  }

  if (error?.code === 3) {
    return '現在地の取得がタイムアウトしました。もう一度お試しください。'
  }

  return error?.message || '現在地を取得できませんでした。'
}

export function requestCurrentPosition() {
  return new Promise((resolve, reject) => {
    const supportError = getGeolocationSupportError()
    if (supportError) {
      reject(new Error(supportError))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (geoPosition) => resolve(toMapPoint(geoPosition)),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    )
  })
}
