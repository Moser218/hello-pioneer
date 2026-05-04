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
        <div class="note">
          <strong>${escapeHtml(n.title)}</strong>
          <span>${escapeHtml(n.body)}</span>
        </div>
      `).join('')
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
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

loadNotes()
