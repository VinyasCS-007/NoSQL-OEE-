import { useCallback, useEffect, useRef, useState } from 'react'
import { WS_URL } from '../lib/api'

/**
 * Opens a WebSocket for one room and reconnects with backoff if it drops.
 * status: 'connecting' | 'open' | 'closed'
 * Events: message, error, typing (someone else is typing), presence (people in the room).
 */
export function useChatSocket(roomId, token, { onMessage, onError, onUnauthorized, onTyping, onPresence }) {
  const [status, setStatus] = useState('connecting')
  const wsRef = useRef(null)
  const handlers = useRef({})
  handlers.current = { onMessage, onError, onUnauthorized, onTyping, onPresence }
  const lastTyping = useRef(0)

  useEffect(() => {
    if (!roomId || !token) return
    let stopped = false
    let retry = 0
    let timer

    const open = () => {
      setStatus('connecting')
      // presence=1 asks the server to push live "people online" counts
      const ws = new WebSocket(`${WS_URL}/ws/${roomId}?token=${encodeURIComponent(token)}&presence=1`)
      wsRef.current = ws
      ws.onopen = () => { retry = 0; setStatus('open') }
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        const h = handlers.current
        if (data.type === 'message') h.onMessage?.(data.message)
        else if (data.type === 'typing') h.onTyping?.(data.alias)
        else if (data.type === 'presence') h.onPresence?.(data.online)
        else if (data.type === 'error') h.onError?.(data.detail)
      }
      ws.onclose = (e) => {
        setStatus('closed')
        if (stopped) return
        if (e.code === 4401) return handlers.current.onUnauthorized?.()
        if (e.code === 4404) return
        // exponential backoff: 0.5s, 1s, 2s ... max 8s
        timer = setTimeout(open, Math.min(8000, 500 * 2 ** retry++))
      }
    }
    open()

    return () => {
      stopped = true
      clearTimeout(timer)
      wsRef.current?.close()
    }
  }, [roomId, token])

  const send = useCallback((payload) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload))
      return true
    }
    return false
  }, [])

  // throttled: at most one typing ping every 2.5 s
  const typing = useCallback(() => {
    const now = Date.now()
    if (now - lastTyping.current < 2500) return
    lastTyping.current = now
    send({ type: 'typing' })
  }, [send])

  return { status, send, typing }
}
