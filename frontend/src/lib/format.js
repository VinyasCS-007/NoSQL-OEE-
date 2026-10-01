// deterministic gradient avatar per alias, so the same person always looks the same
const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
export const avatarBg = (alias = '') => {
  const h = hue(alias)
  return `linear-gradient(135deg, hsl(${h} 80% 62%), hsl(${(h + 50) % 360} 75% 48%))`
}
export const initials = (alias = '') => alias.slice(0, 2).toUpperCase()
export const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
export const fmt = (n) => (n ?? 0).toLocaleString('en-US')
