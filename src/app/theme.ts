export type Theme = 'light' | 'dark'
const KEY = 'ns.theme'

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme)
  document.documentElement.dataset.theme = theme
}
