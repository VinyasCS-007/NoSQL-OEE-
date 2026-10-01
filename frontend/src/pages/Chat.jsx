import { Menu, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Composer from '../components/chat/Composer'
import MessageList from '../components/chat/MessageList'
import RoomSidebar from '../components/chat/RoomSidebar'
import Lightbox from '../components/Lightbox'
import { LivePing, Page, SettingsBtn, ThemeToggle } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useChatSocket } from '../hooks/useChatSocket'
import { useIsMobile, useSettings } from '../hooks/useSettings'
import { api } from '../lib/api'

export default function Chat() {
  const { session, signOut } = useAuth()
  const { roomId } = useParams()
  const navigate = useNavigate()
  const mobile = useIsMobile()
  const { buzz, toast } = useSettings()
  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [drawer, setDrawer] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  // load rooms; open the busiest one if none is selected
  useEffect(() => {
    api.rooms()
      .then((list) => {
        setRooms(list)
        if (!roomId && list.length) {
          const top = [...list].sort((a, b) => b.online - a.online)[0]
          navigate(`/chat/${top.id}`, { replace: true })
        }
      })
      .catch((e) => toast(e.message))
      .finally(() => setRoomsLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openRoom = (id) => { navigate(`/chat/${id}`); setDrawer(false); buzz(6) }
  const createRoom = async (name) => {
    try {
      const room = await api.createRoom(name)
      setRooms((r) => [...r, room].sort((a, b) => a.name.localeCompare(b.name)))
      openRoom(room.id)
      buzz([10, 30, 16])
      return true
    } catch (e) {
      toast(e.message); buzz([30, 60, 30])
      return false
    }
  }
  const logout = () => { signOut(); navigate('/') }
  const setOnline = useCallback((id, n) => setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, online: n } : r))), [])
  const room = rooms.find((r) => r.id === roomId)

  return (
    <Page className="h-full">
      <div className="flex h-full gap-3 p-[clamp(0px,1vw,12px)]">
        {mobile && drawer && <div onClick={() => setDrawer(false)} className="fixed inset-0 z-[39] bg-[rgb(5_6_15/.45)] backdrop-blur-[4px] animate-[fadeIn_.25s_both]" />}
        <RoomSidebar rooms={rooms} loading={roomsLoading} activeId={roomId} session={session} mobile={mobile} open={drawer}
          onClose={() => setDrawer(false)} onSelect={openRoom} onCreate={createRoom}
          onHome={() => navigate('/')} onStats={() => navigate('/dashboard')} onLogout={logout} />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[clamp(0px,2vw,24px)] border border-border bg-surface shadow-e2 backdrop-blur-[24px] backdrop-saturate-[1.4]">
          {roomId ? (
            <RoomView key={roomId} roomId={roomId} room={room} session={session} mobile={mobile}
              onMenu={() => { setDrawer(true); buzz(8) }} onImage={setLightbox} onUnauthorized={logout} onOnline={setOnline} />
          ) : (
            <>
              <Header mobile={mobile} onMenu={() => setDrawer(true)}><div className="flex-1 text-lg font-bold">Rooms</div></Header>
              <div className="grid flex-1 place-items-center p-6 text-center text-muted">{roomsLoading ? 'Loading rooms…' : 'Create a room to start chatting.'}</div>
            </>
          )}
        </main>
      </div>
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </Page>
  )
}

function Header({ mobile, onMenu, children }) {
  return (
    <div className="flex min-h-16 items-center gap-2 border-b border-border py-2.5 pl-4 pr-3">
      {mobile && (
        <button type="button" onClick={onMenu} aria-label="Open rooms" className="springy grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[14px] border-0 bg-surface-2 text-text active:scale-[.88]"><Menu size={18} /></button>
      )}
      {children}
      {!mobile && <ThemeToggle />}
      <SettingsBtn />
    </div>
  )
}

function RoomView({ roomId, room, session, mobile, onMenu, onImage, onUnauthorized, onOnline }) {
  const { buzz } = useSettings()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [nextBefore, setNextBefore] = useState(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [notice, setNotice] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [reply, setReply] = useState(null)
  const [typing, setTyping] = useState(null)
  const typingT = useRef()

  // history arrives newest-first; the list shows oldest at the top
  useEffect(() => {
    api.messages(roomId)
      .then((page) => { setMessages(page.messages.reverse()); setNextBefore(page.next_before) })
      .catch((e) => setNotice(e.message))
      .finally(() => setLoading(false))
  }, [roomId])

  const loadOlder = async () => {
    setLoadingOlder(true)
    try {
      const page = await api.messages(roomId, { before: nextBefore })
      setMessages((m) => [...page.messages.reverse(), ...m])
      setNextBefore(page.next_before)
    } finally {
      setLoadingOlder(false)
    }
  }

  const onMessage = useCallback((msg) => {
    setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]))
    setTyping((t) => (t === msg.sender.alias ? null : t))
    if (msg.sender.alias !== session.alias) buzz(6)
  }, [session.alias, buzz])
  const onTyping = useCallback((alias) => {
    setTyping(alias)
    clearTimeout(typingT.current)
    typingT.current = setTimeout(() => setTyping(null), 3500)
  }, [])
  const onPresence = useCallback((n) => onOnline(roomId, n), [roomId, onOnline])
  useEffect(() => () => clearTimeout(typingT.current), [])

  const { status, send, typing: sendTyping } = useChatSocket(roomId, session.token, { onMessage, onError: setNotice, onUnauthorized, onTyping, onPresence })

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const search = async (e) => {
    e.preventDefault()
    if (!query.trim()) return setResults(null)
    const page = await api.messages(roomId, { q: query.trim() })
    setResults(page.messages.reverse())
  }
  const closeSearch = () => { setSearchOpen(false); setQuery(''); setResults(null) }
  const startReply = (m) => setReply({ id: m.id, alias: m.sender.alias === session.alias ? 'yourself' : m.sender.alias, text: m.text, key: Date.now() })

  return (
    <>
      <Header mobile={mobile} onMenu={onMenu}>
        {searchOpen ? (
          <form onSubmit={search} className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-accent bg-surface-2 pl-3.5 pr-1.5 shadow-[0_0_0_4px_var(--accent-soft)] animate-[popIn_.25s_both]">
            <Search size={16} className="shrink-0 text-muted" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              placeholder="Search this room" aria-label="Search messages" className="min-w-0 flex-1 border-0 bg-transparent text-base outline-none" />
            <button type="button" onClick={closeSearch} aria-label="Close search" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-surface-solid text-text"><X size={14} /></button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold tracking-[-0.02em]"><span className="text-accent">#</span> {room?.name ?? '…'}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                {status === 'open'
                  ? <><LivePing size={7} />{room?.online ?? 0} online · Live</>
                  : <><span className="h-[7px] w-[7px] rounded-full bg-guest" />{status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</>}
              </div>
            </div>
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search messages"
              className="springy grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-full border border-border bg-surface-2 text-text active:scale-[.85]"><Search size={18} /></button>
          </>
        )}
      </Header>
      {results && (
        <div className="flex items-center justify-between gap-3 bg-accent-soft px-4 py-2.5 text-[13px] font-medium text-accent">
          {results.length} result{results.length === 1 ? '' : 's'} for “{query}” (text index search)
          <button type="button" onClick={closeSearch} className="cursor-pointer border-0 bg-transparent text-[13px] font-semibold text-inherit">Clear</button>
        </div>
      )}

      <MessageList messages={results ?? messages} me={{ alias: session.alias, type: session.role }} loading={loading}
        hasMore={!results && !!nextBefore} loadingOlder={loadingOlder} onLoadOlder={loadOlder}
        onReply={startReply} onImage={onImage} typing={results ? null : typing} />

      {notice && <div role="alert" className="mx-3 mb-2 rounded-xl px-3 py-2 text-sm text-danger animate-[popIn_.3s_both]" style={{ background: 'color-mix(in oklab, var(--danger) 12%, transparent)' }}>{notice}</div>}
      {session.role === 'guest' && (
        <p className="m-0 px-4 pt-1 text-center text-[12px] text-muted">
          You're a guest, so your messages disappear after 24 h. <Link to="/register" className="font-semibold">Register</Link> to keep them and share pictures.
        </p>
      )}
      <Composer isMember={session.role === 'user'} disabled={status !== 'open'} reply={reply} focusKey={reply?.key}
        onClearReply={() => setReply(null)} onSend={(p) => { const ok = send(p); if (ok && results) closeSearch(); return ok }}
        onUpload={(file) => api.upload(file, session.token)} onTyping={sendTyping} />
    </>
  )
}
