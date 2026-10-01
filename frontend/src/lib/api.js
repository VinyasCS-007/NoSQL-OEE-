export const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8000'
export const WS_URL = API_URL.replace(/^http/, 'ws')

async function request(path, { token, body, method = 'GET', form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  guest: () => request('/guest', { method: 'POST' }),
  register: (body) => request('/register', { method: 'POST', body }),
  login: (body) => request('/login', { method: 'POST', body }),
  rooms: () => request('/rooms'),
  createRoom: (name) => request('/rooms', { method: 'POST', body: { name } }),
  messages: (roomId, { before, q, limit = 50 } = {}) => {
    const p = new URLSearchParams({ limit: String(limit) })
    if (before) p.set('before', before)
    if (q) p.set('q', q)
    return request(`/rooms/${roomId}/messages?${p}`)
  },
  upload: (file, token) => {
    const form = new FormData()
    form.append('file', file)
    return request('/upload', { method: 'POST', form, token })
  },
  stats: () => request('/stats'),
  presence: () => request('/presence'),
}

export const imageUrl = (id) => `${API_URL}/image/${id}`
