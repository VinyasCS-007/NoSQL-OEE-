import { X } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'

function Seg({ options, value, onPick }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-surface-2 p-1">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onPick(v)}
          className={`h-[38px] cursor-pointer rounded-[10px] border-0 text-sm font-semibold transition-colors ${value === v ? 'bg-surface-solid text-text' : 'bg-transparent text-muted'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Switch({ label, hint, on, onToggle, last }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-t border-border ${last ? 'pb-0 pt-3.5' : 'py-3.5'}`}>
      <div>
        <div className="text-[15px] font-semibold">{label}</div>
        <div className="mt-0.5 text-[13px] text-muted">{hint}</div>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle}
        className={`relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-0 transition-colors ${on ? 'bg-accent' : 'bg-surface-2'}`}>
        <span className="absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/.25)] transition-transform duration-[400ms] ease-[cubic-bezier(.34,1.56,.64,1)]"
          style={{ transform: `translateX(${on ? 20 : 0}px)` }} />
      </button>
    </div>
  )
}

export default function SettingsPanel() {
  const s = useSettings()
  if (!s.panelOpen) return null
  const st = s.settings
  return (
    <>
      <div className="fixed inset-0 z-[80]" onClick={s.closePanel} />
      <div className="fixed right-3 top-[76px] z-[81] max-h-[calc(100dvh-96px)] w-[min(350px,calc(100vw-24px))] origin-top-right overflow-auto rounded-3xl border border-border-strong bg-surface-solid p-5 shadow-e3 animate-[popIn_.3s_cubic-bezier(.22,1,.36,1)_both]">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[17px] font-bold tracking-[-0.02em]">Settings</div>
          <button type="button" onClick={s.closePanel} aria-label="Close settings" className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-surface-2 text-text"><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-3 pb-3">
          <div className="mono-label">Mood</div>
          <Seg options={[['cinematic', 'Cinematic'], ['airy', 'Airy']]} value={s.mood} onPick={s.setMood} />
          <div className="mono-label mt-1">Theme</div>
          <Seg options={[['light', 'Light'], ['dark', 'Dark']]} value={s.theme} onPick={s.setTheme} />
        </div>
        <Switch label="Haptics" hint="Vibrate on taps, sends and drags (Android)" on={st.haptics} onToggle={() => s.setSetting('haptics', !st.haptics)} />
        <Switch label="Motion effects" hint="3D tilt, parallax and floating" on={st.motion} onToggle={() => s.setSetting('motion', !st.motion)} />
        <Switch label="Smooth scrolling" hint="Inertia on mouse wheels" on={st.smooth} onToggle={() => s.setSetting('smooth', !st.smooth)} last={s.coarse} />
        {!s.coarse && <Switch label="Custom cursor" hint="Trailing ring that reacts to targets" on={st.cursor} onToggle={() => s.setSetting('cursor', !st.cursor)} last />}
      </div>
    </>
  )
}
