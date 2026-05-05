import { createHmac, timingSafeEqual } from 'crypto'

// Disable Vercel's body parser so we can read raw bytes for signature verification
export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function verifySignature(secret, svixId, svixTimestamp, rawBody, svixSig) {
  if (!secret || !svixId || !svixTimestamp || !svixSig) return false

  const ts = parseInt(svixTimestamp, 10)
  if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = Buffer.from(
    createHmac('sha256', key).update(`${svixId}.${svixTimestamp}.${rawBody}`).digest('base64')
  )

  // svix-signature is one or more space-separated "v1,<base64>" tokens
  for (const token of svixSig.split(' ')) {
    const [version, sig] = token.split(',')
    if (version !== 'v1' || !sig) continue
    try {
      const actual = Buffer.from(sig)
      if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true
    } catch { /* length mismatch — not a match */ }
  }
  return false
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawBody = await getRawBody(req)

  if (!verifySignature(
    process.env.RESEND_WEBHOOK_SECRET,
    req.headers['svix-id'],
    req.headers['svix-timestamp'],
    rawBody.toString('utf8'),
    req.headers['svix-signature'],
  )) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const event = JSON.parse(rawBody)
  const eventType = event?.type
  const data = event?.data

  if (!eventType || !data?.email_id) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const messageId = data.email_id
  const recipient = Array.isArray(data.to) ? data.to[0] : data.to

  let noteId = null
  if (Array.isArray(data.tags)) {
    const tag = data.tags.find(t => t.name === 'note_id')
    noteId = tag?.value || null
  } else if (data.tags?.note_id) {
    noteId = data.tags.note_id
  }

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
