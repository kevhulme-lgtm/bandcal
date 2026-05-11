const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

webpush.setVapidDetails(
  'mailto:kevhulme@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  try {
    const { groupId, title, startDate, createdByMemberId } = JSON.parse(event.body)

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Fetch all members in the group except the creator
    let membersQuery = supabase.from('members').select('id').eq('group_id', groupId)
    if (createdByMemberId) membersQuery = membersQuery.neq('id', createdByMemberId)
    const { data: members } = await membersQuery

    if (!members?.length) return { statusCode: 200, body: JSON.stringify({ sent: 0 }) }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('member_id, subscription_json')
      .in('member_id', members.map(m => m.id))

    if (!subs?.length) return { statusCode: 200, body: JSON.stringify({ sent: 0 }) }

    const payload = JSON.stringify({
      title: `New event: ${title}`,
      body: startDate || '',
      url: '/',
      icon: '/icon-192.png',
      badge: '/icon-192.png'
    })

    const staleIds = []
    const results = await Promise.allSettled(
      subs.map(async s => {
        try {
          await webpush.sendNotification(s.subscription_json, payload)
        } catch (err) {
          if (err.statusCode === 410) staleIds.push(s.member_id)
          throw err
        }
      })
    )

    if (staleIds.length) {
      await supabase.from('push_subscriptions').delete().in('member_id', staleIds)
    }

    const sent = results.filter(r => r.status === 'fulfilled').length
    return { statusCode: 200, body: JSON.stringify({ sent, total: subs.length }) }
  } catch (err) {
    console.error('Push handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
