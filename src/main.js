import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

async function loadNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) { console.error(error); return }

  const container = document.getElementById('notes')
  container.innerHTML = data.length === 0
    ? '<p>No notes yet. Be the first!</p>'
    : data.map(n => `
        <div class="note" data-title="${escapeAttr(n.title)}" data-body="${escapeAttr(n.body)}">
          <strong>${escapeHtml(n.title)}</strong>
          <span>${escapeHtml(n.body)}</span>
          <button class="share-btn">Share via email</button>
        </div>
      `).join('')

  container.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', () => shareNote(btn.closest('.note')))
  })
}

async function shareNote(noteEl) {
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
      body: JSON.stringify({ to, title, body }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    btn.textContent = 'Sent!'
    setTimeout(() => { btn.textContent = 'Share via email'; btn.disabled = false }, 3000)
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

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function escapeAttr(str) {
  return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

loadNotes()
