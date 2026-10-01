// Small shared helpers for the team app and the viewer app: escaping, formatting, icons, mini charts, toasts.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function fmtDuration(sec) {
  const m = Math.round((sec || 0) / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

export const pct = (v, d = 0) => (v === null || v === undefined || Number.isNaN(v) ? '–' : `${(v * 100).toFixed(d)}%`);

export function ago(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Icons: 24px stroke paths (Lucide-style, drawn here so nothing extra loads).
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  plus: 'M12 5v14M5 12h14',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  play: 'M6 4l14 8-14 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8zM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6z',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  quote: 'M7 7h4v4H8v3a2 2 0 0 1-2 2M15 7h4v4h-3v3a2 2 0 0 1-2 2',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  film: 'M4 3h16v18H4zM8 3v18M16 3v18M4 8h4M4 13h4M4 18h4M16 8h4M16 13h4M16 18h4',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  trendDown: 'M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6',
  trendUp: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  type: 'M4 7V4h16v3M9 20h6M12 4v16',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  mail: 'M4 4h16v16H4zM22 6l-10 7L2 6',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
};

export function icon(name, size = 18, extra = '') {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${PATHS[name] || ''}"/></svg>`;
}

export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    prompt('Copy this:', text);
  }
}

// ---- mini charts (SVG strings) ----

/** A progress ring with the value in the middle. `value` is 0..1. */
export function ring(value, { size = 84, stroke = 9, color = 'var(--primary)', label } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null || value === undefined ? 0 : Math.max(0, Math.min(1, value));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label ?? pct(value))}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c * v} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${size / 4.6}" font-weight="800" fill="var(--text)">${esc(label ?? pct(value))}</text>
  </svg>`;
}

/** Horizontal bars for a distribution: items = [{label, value, sub?}] */
export function hbars(items, { color = 'var(--primary)', max } = {}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return `<div class="hbars">${items
    .map(
      (i) => `<div class="hbar"><span class="hbar-label">${i.label}</span><span class="hbar-track"><span class="hbar-fill" style="width:${(100 * i.value) / top}%;background:${i.color || color}"></span></span><span class="hbar-val num">${esc(i.sub ?? i.value)}</span></div>`,
    )
    .join('')}</div>`;
}

/** Vertical column chart for small distributions such as 1-5 ratings. */
export function columns(values, labels, { color = 'var(--primary)', height = 90, cls = '' } = {}) {
  const max = Math.max(1, ...values);
  return `<div class="cols ${cls}" style="height:${height + 24}px">${values
    .map((v, i) => `<div class="col" title="${esc(labels[i])}: ${v}"><span class="col-val num">${v || ''}</span><span class="col-bar" style="height:${Math.max(2, (height * v) / max)}px;background:${color}"></span><span class="col-label">${labels[i]}</span></div>`)
    .join('')}</div>`;
}

/** Sparkline of a 0..1 series, downsampled to the given width. */
export function sparkline(values, { width = 240, height = 48, color = 'var(--primary)' } = {}) {
  const pts = [];
  const n = values.length;
  if (!n) return '';
  const step = Math.max(1, Math.floor(n / width));
  for (let i = 0; i < n; i += step) {
    const chunk = values.slice(i, i + step).filter((v) => v !== null && v !== undefined);
    if (!chunk.length) continue;
    const v = chunk.reduce((a, b) => a + b, 0) / chunk.length;
    pts.push(`${((i / n) * width).toFixed(1)},${(height - 4 - v * (height - 8)).toFixed(1)}`);
  }
  return `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
  </svg>`;
}

export const FEELINGS = ['😴', '😐', '🙂', '😃', '🤩'];
export const FEELING_LABELS = ['Bored', 'Meh', 'Good', 'Great', 'Loved it'];
export const RELEVANCE_LABELS = ['Not at all', 'A little', 'Somewhat', 'Very', 'Extremely'];
export const LIKED = [
  { key: 'loved', emoji: '❤️', label: 'Loved it' },
  { key: 'liked', emoji: '👍', label: 'Liked it' },
  { key: 'okay', emoji: '😐', label: 'It was okay' },
  { key: 'not_for_me', emoji: '👎', label: 'Not for me' },
];
