import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Hash, LogOut, Menu, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import ConnectionStatus from '../components/ConnectionStatus'
import InputBar from '../components/InputBar'
import Lightbox from '../components/Lightbox'
import { Avatar } from '../components/MessageBubble'
import MessageList from '../components/MessageList'
import RoomSidebar from '../components/RoomSidebar'
import { IconButton, Logo, RoleBadge, ThemeToggle } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useChatSocket } from '../hooks/useChatSocket'
import { api } from '../lib/api'

export default function Chat() {
  const { session, signOut } = useAuth()
  const { roomId } = useParams()
  const navigate = useNavigate()

  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [drawer, setDrawer] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  // load rooms; open the first one if none is selected
  useEffect(() => {
    api.rooms()
      .then((list) => {
        setRooms(list)
        if (!roomId && list.length) navigate(`/chat/${list[0].id}`, { replace: true })
      })
      .finally(() => setRoomsLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const createRoom = async (name) => {
    const room = await api.createRoom(name)
    setRooms((r) => [...r, room].sort((a, b) => a.name.localeCompare(b.name)))
    openRoom(room.id)
  }

  const openRoom = (id) => {
    navigate(`/chat/${id}`)
    setDrawer(false)
  }

  const logout = () => {
    signOut()
    navigate('/')
  }

  const room = rooms.find((r) => r.id === roomId)
  const sidebar = <RoomSidebar rooms={rooms} loading={roomsLoading} activeId={roomId} onSelect={openRoom} onCreate={createRoom} />

  return (
    <div className="flex h-full gap-0 p-0 md:gap-3 md:p-3">
      <AuroraBackground intensity={0.55} grid={false} />
      {/* desktop sidebar: a floating glass panel */}
      <aside className="glass hidden w-72 shrink-0 flex-col overflow-hidden rounded-[28px] shadow-e3 md:flex">
        <div className="flex h-16 items-center px-5"><Link to="/" aria-label="Home"><Logo /></Link></div>
        {sidebar}
        <UserCard session={session} onLogout={logout} />
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside
              className="fixed inset-y-2 left-2 z-40 flex w-[min(18rem,85vw)] flex-col overflow-hidden rounded-[28px] border border-border bg-surface-solid shadow-e3 md:hidden"
              initial={{ x: '-110%', rotateY: 25 }} animate={{ x: 0, rotateY: 0 }} exit={{ x: '-110%', rotateY: 25 }}
              style={{ transformPerspective: 1000, transformOrigin: 'left center' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            >
              <div className="flex h-16 items-center justify-between px-4">
                <Logo />
                <IconButton label="Close menu" onClick={() => setDrawer(false)}><X size={18} /></IconButton>
              </div>
              {sidebar}
              <UserCard session={session} onLogout={logout} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden md:rounded-[28px] md:border md:border-border md:bg-surface/40 md:shadow-e3 md:backdrop-blur-xl">
        {roomId ? (
          <AnimatePresence mode="wait">
            <motion.div key={roomId} className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.16 }}>
              <RoomView roomId={roomId} roomName={room?.name} session={session} onMenu={() => setDrawer(true)}
                onImage={setLightbox} onUnauthorized={logout} />
            </motion.div>
          </AnimatePresence>
        ) : (
          <>
            <TopBar onMenu={() => setDrawer(true)} />
            <div className="grid flex-1 place-items-center p-6 text-center text-muted">
              {roomsLoading ? 'Loading rooms…' : 'Create a room to start chatting.'}
            </div>
          </>
        )}
      </section>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  )
}

function TopBar({ onMenu, children }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/60 px-2 backdrop-blur-xl sm:px-4">
      <IconButton label="Open rooms" onClick={onMenu} className="md:hidden"><Menu size={20} /></IconButton>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      <Link to="/dashboard" aria-label="Dashboard" title="Dashboard" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-text">
        <BarChart3 size={18} />
      </Link>
      <ThemeToggle />
    </header>
  )
}

function UserCard({ session, onLogout }) {
  return (
    <div className="m-2 flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-2.5">
      <Avatar alias={session.alias} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{session.alias}</p>
        <RoleBadge type={session.role} className="mt-0.5" />
      </div>
      <IconButton label={session.role === 'guest' ? 'Leave' : 'Log out'} onClick={onLogout}><LogOut size={18} /></IconButton>
    </div>
  )
}

function RoomView({ roomId, roomName, session, onMenu, onImage, onUnauthorized }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [nextBefore, setNextBefore] = useState(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [notice, setNotice] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)

  // history arrives newest-first; the list shows oldest at the top
  useEffect(() => {
    api.messages(roomId)
      .then((page) => {
        setMessages(page.messages.reverse())
        setNextBefore(page.next_before)
      })
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
  }, [])

  const { status, send } = useChatSocket(roomId, session.token, {
    onMessage,
    onError: setNotice,
    onUnauthorized,
  })

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

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
    setResults(null)
  }

  const me = { alias: session.alias, type: session.role }

  return (
    <>
      <TopBar onMenu={onMenu}>
        {searchOpen ? (
          <form onSubmit={search} className="flex flex-1 items-center gap-1">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search words in this room…" aria-label="Search messages"
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent" />
            <IconButton label="Close search" type="button" onClick={closeSearch}><X size={18} /></IconButton>
          </form>
        ) : (
          <>
            <Hash size={18} className="shrink-0 text-muted" />
            <h1 className="truncate font-semibold">{roomName ?? '…'}</h1>
            <div className="ml-auto hidden sm:block"><ConnectionStatus status={status} /></div>
            <IconButton label="Search messages" onClick={() => setSearchOpen(true)}><Search size={18} /></IconButton>
          </>
        )}
      </TopBar>

      <div className="flex justify-center border-b border-border py-1.5 sm:hidden"><ConnectionStatus status={status} /></div>

      <AnimatePresence>
        {results && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border bg-accent-soft px-4 py-2 text-sm text-accent">
            {results.length} result{results.length === 1 ? '' : 's'} for “{query}” (text index search)
          </motion.div>
        )}
      </AnimatePresence>

      <MessageList
        messages={results ?? messages}
        loading={loading}
        me={me}
        hasMore={!results && !!nextBefore}
        loadingOlder={loadingOlder}
        onLoadOlder={loadOlder}
        onImage={onImage}
      />

      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="mx-3 mb-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {notice}
          </motion.div>
        )}
      </AnimatePresence>

      {session.role === 'guest' && (
        <p className="px-4 pb-1 text-center text-[11px] text-muted">
          You're a guest — your messages disappear after 24 h. <Link to="/register" className="font-semibold text-accent hover:underline">Register</Link> to keep them and share pictures.
        </p>
      )}
      <InputBar
        isMember={session.role === 'user'}
        disabled={status !== 'open'}
        onSend={send}
        onUpload={(file) => api.upload(file, session.token)}
      />
    </>
  )
}
