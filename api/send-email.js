export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, title, body } = req.body
  if (!to || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Pioneer Species <onboarding@resend.dev>',
      to,
      subject: `Note shared with you: ${title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background:#111;padding:24px 32px;">
                    <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:-0.5px;">Pioneer Species</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 8px;color:#888;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Someone shared a note with you</p>
                    <h2 style="margin:0 0 16px;color:#111;font-size:20px;">${escapeHtml(title)}</h2>
                    <p style="margin:0 0 32px;color:#444;font-size:16px;line-height:1.6;">${escapeHtml(body)}</p>
                    <a href="https://hello-pioneer-pi.vercel.app" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;">View all notes →</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 32px;border-top:1px solid #eee;">
                    <p style="margin:0;color:#aaa;font-size:12px;">Sent from Pioneer Species · hello-pioneer-pi.vercel.app</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    return res.status(500).json({ error: error.message || 'Failed to send email' })
  }

  return res.status(200).json({ ok: true })
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
