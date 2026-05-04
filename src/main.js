import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

async function loadNotes() {
  const [{ data: notes, error }, { data: events }] = await Promise.all([
    supabase.from('notes').select('*').order('created_at', { ascending: false }),
    supabase.from('email_events').select('*').order('created_at', { ascending: false }),
  ])

  if (error) { console.error(error); return }

  // Group events by note_id, keeping only the latest per recipient
  const eventsByNote = {}
  for (const ev of (events || [])) {
    if (!ev.note_id) continue
    if (!eventsByNote[ev.note_id]) eventsByNote[ev.note_id] = {}
    // First seen = most recent (sorted desc)
    if (!eventsByNote[ev.note_id][ev.recipient]) {
      eventsByNote[ev.note_id][ev.recipient] = ev
    }
  }

  const container = document.getElementById('notes')
  container.innerHTML = notes.length === 0
    ? '<p>No notes yet. Be the first!</p>'
    : notes.map(n => {
        const recipientMap = eventsByNote[n.id] || {}
        const activity = Object.values(recipientMap)
        const activityHtml = activity.length === 0 ? '' : `
          <div class="activity">
            ${activity.map(ev => `
              <span class="activity-row">
                <span class="activity-recipient">${escapeHtml(ev.recipient)}</span>
                <span class="activity-badge activity-badge--${statusClass(ev.event_type)}">${escapeHtml(label(ev.event_type))}</span>
                <span class="activity-time">${timeAgo(ev.created_at)}</span>
              </span>
            `).join('')}
          </div>`

        return `
          <div class="note" data-id="${escapeAttr(n.id)}" data-title="${escapeAttr(n.title)}" data-body="${escapeAttr(n.body)}">
            <strong>${escapeHtml(n.title)}</strong>
            <span>${escapeHtml(n.body)}</span>
            ${activityHtml}
            <button class="share-btn">Share via email</button>
          </div>`
      }).join('')

  container.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', () => shareNote(btn.closest('.note')))
  })
}

async function shareNote(noteEl) {
  const noteId = noteEl.dataset.id
  const title = noteEl.dataset.title
  const body = noteEl.dataset.body
  const to = prompt('Enter recipient email address:')
  if (!to) return

  const btn = noteEl.querySelector('.share-btn')
  btn.textContent = 'Sending…'
  btn.disabled = true

  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, title, body, noteId }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    btn.textContent = 'Sent!'
    setTimeout(() => { loadNotes() }, 1500)
  } catch (err) {
    alert(`Failed to send: ${err.message}`)
    btn.textContent = 'Share via email'
    btn.disabled = false
  }
}

document.getElementById('submit').addEventListener('click', async () => {
  const title = document.getElementById('title').value.trim()
  const body = document.getElementById('body').value.trim()
  if (!title || !body) return alert('Title and note are required.')

  const { error } = await supabase.from('notes').insert({ title, body })
  if (error) { console.error(error); return }

  document.getElementById('title').value = ''
  document.getElementById('body').value = ''
  loadNotes()
})

function statusClass(type) {
  if (type === 'email.delivered' || type === 'sent') return 'sent'
  if (type === 'email.opened') return 'opened'
  if (type === 'email.clicked') return 'clicked'
  if (type === 'email.bounced') return 'bounced'
  return 'sent'
}

function label(type) {
  const map = { 'sent': 'Sent', 'email.delivered': 'Delivered', 'email.opened': 'Opened', 'email.clicked': 'Clicked', 'email.bounced': 'Bounced' }
  return map[type] || type
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function escapeAttr(str) {
  return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

loadNotes()
