const webpush = require('web-push')

webpush.setVapidDetails(
  'mailto:bandcal@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { subscriptions, title, body, url } = JSON.parse(event.body)

    if (!subscriptions || !subscriptions.length) {
      return { statusCode: 200, body: JSON.stringify({ sent: 0 }) }
    }

    const payload = JSON.stringify({
      title: title || 'BandCal',
      body: body || 'A new event has been added',
      url: url || '/',
      icon: '/icon-192.png',
      badge: '/icon-192.png'
    })

    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(sub, payload).catch(err => {
          console.error('Push failed:', err.statusCode)
          throw err
        })
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return { statusCode: 200, body: JSON.stringify({ sent, failed }) }
  } catch (err) {
    console.error('Push handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
