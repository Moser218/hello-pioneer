export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const event = req.body
  const eventType = event?.type
  const data = event?.data

  if (!eventType || !data?.email_id) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const messageId = data.email_id
  const recipient = Array.isArray(data.to) ? data.to[0] : data.to

  // Extract note_id from Resend tags (arrives as [{name, value}] or {name: value})
  let noteId = null
  if (Array.isArray(data.tags)) {
    const tag = data.tags.find(t => t.name === 'note_id')
    noteId = tag?.value || null
  } else if (data.tags?.note_id) {
    noteId = data.tags.note_id
  }

  // If no tag, look up note_id from the existing "sent" row
  if (!noteId) {
    const lookupRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/email_events?message_id=eq.${encodeURIComponent(messageId)}&event_type=eq.sent&select=note_id&limit=1`,
      {
        headers: {
          'apikey': process.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
        },
      }
    )
    const rows = await lookupRes.json()
    noteId = rows?.[0]?.note_id || null
  }

  await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_events`, {
    method: 'POST',
    headers: {
      'apikey': process.env.VITE_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      message_id: messageId,
      note_id: noteId,
      recipient: recipient || 'unknown',
      event_type: eventType,
    }),
  })

  return res.status(200).json({ ok: true })
}
