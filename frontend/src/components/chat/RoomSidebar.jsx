import { BarChart3, Hash, LogOut, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Logo } from '../ui'

export default function RoomSidebar({ rooms, loading, activeId, session, mobile, open, onClose, onSelect, onCreate, onHome, onStats, onLogout }) {
  const [name, setName] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    if (await onCreate(n)) setName('')
  }
  const guest = session.role === 'guest'
  const pos = mobile
    ? `fixed inset-2 z-40 w-[min(18rem,85vw)] bg-surface-solid ${open ? '[transform:perspective(1000px)_translateX(0)_rotateY(0deg)]' : '[transform:perspective(1000px)_translateX(-110%)_rotateY(25deg)]'}`
    : 'relative w-72 bg-surface'

  return (
    <aside className={`${pos} flex shrink-0 origin-left flex-col overflow-hidden rounded-3xl border border-border shadow-e2 backdrop-blur-[24px] backdrop-saturate-[1.4] transition-transform duration-[550ms] ease-[cubic-bezier(.22,1,.36,1)]`}>
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <Logo size={28} onClick={onHome} />
        {mobile && <button type="button" onClick={onClose} aria-label="Close rooms" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-surface-2 text-text"><X size={16} /></button>}
      </div>
      <div className="mx-3 flex items-center gap-3 rounded-[18px] bg-surface-2 p-3">
        <Avatar alias={session.alias} size={40} radius={14} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{session.alias}</div>
          {guest ? <div className="text-xs text-guest">Guest · messages fade after 24h</div> : <div className="text-xs text-member">Member · history saved</div>}
        </div>
      </div>
      <div className="mono-label flex items-center justify-between px-[18px] pb-2 pt-[18px]">Rooms<span>{rooms.length}</span></div>
      <div className="scroll-thin flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
        {loading && [0, 1, 2, 3, 4].map((i) => <div key={i} className="mx-1 my-1 h-9 animate-pulse rounded-xl bg-surface-2" />)}
        {rooms.map((r) => {
          const active = r.id === activeId
          return (
            <button key={r.id} type="button" data-ripple="" onClick={() => onSelect(r.id)}
              className={`springy relative flex h-[46px] w-full shrink-0 cursor-pointer items-center gap-2.5 overflow-hidden rounded-[14px] border-0 px-3 text-left text-[15px] font-medium active:scale-[.96] ${active ? 'bg-accent-soft text-accent' : 'bg-transparent text-text hover:bg-surface-2'}`}>
              <Hash size={16} className="shrink-0 opacity-70" />
              <span className="flex-1 truncate">{r.name}</span>
              <span className="text-xs tabular-nums text-muted">{r.online || ''}</span>
            </button>
          )
        })}
      </div>
      <form onSubmit={submit} className="mx-3 my-2 flex gap-1.5 rounded-2xl border border-dashed border-border-strong p-[5px]">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="New room name" aria-label="New room name"
          className="h-[38px] min-w-0 flex-1 border-0 bg-transparent px-2.5 text-[15px] outline-none" />
        <button type="submit" aria-label="Create room" className={`springy grid h-[38px] w-[38px] shrink-0 cursor-pointer place-items-center rounded-xl border-0 bg-accent text-white active:scale-[.88] ${name.trim() ? '' : 'opacity-40'}`}>
          <Plus size={16} strokeWidth={2.4} />
        </button>
      </form>
      <div className="flex gap-1.5 px-3 pb-3">
        <button type="button" onClick={onStats} className="springy flex h-[42px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-border bg-transparent text-sm font-semibold text-text active:scale-95"><BarChart3 size={16} />Live stats</button>
        <button type="button" onClick={onLogout} className="springy flex h-[42px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-border bg-transparent text-sm font-semibold text-text active:scale-95"><LogOut size={16} />{guest ? 'Leave' : 'Log out'}</button>
      </div>
    </aside>
  )
}
