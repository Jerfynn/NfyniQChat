// NfyniQ Chat 2.2 — phone app.
// LINKED mode: the phone signs in as the PC's user (QR code or 6-digit PIN) and shows the same chats.
// GUEST mode: someone without a PC joins as their own person; their chats are kept on the PC they connect through.
(() => {
const $ = (s, r = document) => r.querySelector(s);
const EVERYONE = 'everyone';
const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const STATUS_LABEL = { available: 'Available', busy: 'Busy', lab: 'In the lab', sea: 'At sea trial', away: 'Away' };
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) || (location.hostname === 'localhost' && !location.port);

const store = {
  get(k, d) { try { const v = localStorage.getItem('nq.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('nq.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('nq.' + k); } catch {} },
};
function uuid() {
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const deviceId = store.get('deviceId', null) || uuid(); store.set('deviceId', deviceId);
const UA = navigator.userAgent;
const deviceName = /iPhone/.test(UA) ? 'iPhone' : /iPad/.test(UA) ? 'iPad' : /Android/.test(UA) ? 'Android phone' : 'Browser';

let account = store.get('account', null); // { mode:'linked', link } | { mode:'guest', id, name }
if (account && account.mode === undefined) account = null; // 2.1 leftovers
const hashLink = (location.hash.match(/link=([\w-]+)/) || [])[1];
if (hashLink) { account = { mode: 'linked', link: hashLink }; store.set('account', account); store.del('cache'); history.replaceState(null, '', location.pathname); }
let pinTry = null;

const S = {
  me: null, host: null, mode: null, session: null, peers: new Map(), history: {}, groups: {}, pins: {}, muted: {}, reads: {},
  active: null, typing: {}, replyTo: null, editing: null, newIds: new Set(), progress: {}, drafts: {}, pending: {},
  connected: false, filter: '', newBelow: 0, theme: store.get('theme', null), hostAddr: store.get('host', ''),
};
const cached = store.get('cache', null);
if (cached && account) Object.assign(S, { me: cached.me, history: cached.history || {}, groups: cached.groups || {}, pins: cached.pins || {}, muted: cached.muted || {}, reads: cached.reads || {}, host: cached.host, mode: cached.mode });
const saveCache = (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => {
  const h = {}; for (const [k, l] of Object.entries(S.history)) h[k] = l.slice(-150);
  store.set('cache', { me: S.me, history: h, groups: S.groups, pins: S.pins, muted: S.muted, reads: S.reads, host: S.host, mode: S.mode });
}, 800); }; })();
const BASE = () => (NATIVE ? (S.hostAddr ? `http://${S.hostAddr}` : '') : location.origin);

// ---------- icons
const ICONS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', back: '<path d="m15 18-6-6 6-6"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  send: '<path d="M14.54 21.69a.5.5 0 0 0 .94-.02l6.5-19a.5.5 0 0 0-.63-.63l-19 6.5a.5.5 0 0 0-.02.94l7.93 3.18a2 2 0 0 1 1.11 1.11Z"/><path d="m21.85 2.15-10.94 10.94"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  reply: '<path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>', forward: '<path d="m15 17 5-5-5-5"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>', pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>', down: '<path d="M12 5v14M19 12l-7 7-7-7"/>', more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  usersPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  wifi: '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>', monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  siren: '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1M18.5 4.5 18 5M2 12h1M12 2v1M4.93 4.93l.71.71M12 12v6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', bellOff: '<path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  play: '<path d="M7 4v16l13-8z"/>', pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
document.querySelectorAll('i[data-ic]').forEach((el) => { el.outerHTML = ic(el.dataset.ic, el.className); });
const TICK2 = '<path d="M11.07.65 4.9 8.27 2.28 5.82 1.2 6.98l3.85 3.6L12.3 1.6zM15.03.65 8.86 8.27l-.94-.88-1.04 1.27 2.13 1.99L16.27 1.6z"/>';
const STATUS = {
  sending: '<span class="spin"></span>',
  partial: '<svg class="tick" viewBox="0 0 16 11"><path d="M11.07.65 4.9 8.27 2.28 5.82 1.2 6.98l3.85 3.6L12.3 1.6z"/></svg>',
  delivered: `<svg class="tick" viewBox="0 0 16 11">${TICK2}</svg>`, read: `<svg class="tick read" viewBox="0 0 16 11">${TICK2}</svg>`,
  failed: '<svg class="tick failed" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7.5" fill="currentColor"/><path d="M7.2 3.8h1.6v5.2H7.2zM7.2 10.6h1.6v1.6H7.2z" fill="#fff"/></svg>',
};

// ---------- helpers
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (n) => String(n || '?').trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const HUES = [252, 282, 318, 342, 205, 178, 22, 228];
const hue = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; };
const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function fmtDay(ts) { const d = new Date(ts), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1); if (d.toDateString() === t.toDateString()) return 'Today'; if (d.toDateString() === y.toDateString()) return 'Yesterday'; return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }); }
const fmtListTime = (ts) => (new Date(ts).toDateString() === new Date().toDateString() ? fmtTime(ts) : new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' }));
function fmtSize(b) { const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return `${b.toFixed(i ? 1 : 0)} ${u[i]}`; }
const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const lastSeen = (ts) => (ts ? `last seen ${fmtDay(ts) === 'Today' ? 'today' : fmtDay(ts)} at ${fmtTime(ts)}` : 'offline');
const linkify = (e) => e.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/gi, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
function formatText(raw) {
  const parts = String(raw ?? '').split('```');
  return parts.map((seg, i) => {
    if (i % 2 === 1 && i < parts.length - 1) { const code = seg.replace(/^[a-zA-Z0-9+#-]*\n/, '').replace(/\n$/, ''); return `<div class="code"><pre>${esc(code)}</pre><button class="code-copy" data-copy="${esc(code)}">Copy</button></div>`; }
    let h = esc(i % 2 === 1 ? '```' + seg : seg);
    h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, '$1<b>$2</b>').replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, '$1<i>$2</i>');
    return linkify(h);
  }).join('');
}
const extOf = (n) => (String(n).includes('.') ? String(n).split('.').pop().toLowerCase() : '');
const isImage = (n) => /^(png|jpe?g|gif|webp|bmp)$/.test(extOf(n));
const isVideo = (n) => /^(mp4|webm|mov|m4v)$/.test(extOf(n));
const FILE_COLORS = [[/^(pdf)$/, '#E5484D'], [/^(docx?|rtf|odt|txt|md)$/, '#3E7BFA'], [/^(xlsx?|csv|ods)$/, '#1FA463'], [/^(pptx?|key)$/, '#F0802B'], [/^(png|jpe?g|gif|webp|svg|bmp|heic)$/, '#C24DE0'], [/^(mp4|mov|avi|mkv|webm|mp3|wav|m4a)$/, '#E0457B'], [/^(zip|rar|7z|tar|gz)$/, '#8C6A3F']];
const fileColor = (e) => (FILE_COLORS.find(([re]) => re.test(e)) || [0, '#6F6B8A'])[1];
const isGroup = (k) => typeof k === 'string' && k.startsWith('g-');
const buzz = (p = 10) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

const peerPhoto = (k) => (k === S.me?.id ? S.me.avatar : S.peers.get(k)?.avatar || null);
function avatarHTML(k, name, size = '', photo) {
  if (k === EVERYONE) return `<div class="avatar ${size} group">${ic('users')}</div>`;
  if (isGroup(k)) return `<div class="avatar ${size}" style="--h:${hue(k)}">${ic('users')}</div>`;
  if (photo) return `<div class="avatar ${size} photo" style="background-image:url('${photo}')"></div>`;
  return `<div class="avatar ${size}" style="--h:${hue(k)}">${esc(initials(name))}</div>`;
}
const stDot = (p) => (p && p.online ? `<span class="st-dot ${p.status?.p || 'available'}"></span>` : '');
function chatName(k) {
  if (k === EVERYONE) return 'Everyone';
  if (isGroup(k)) return S.groups[k]?.name || 'Group';
  const p = S.peers.get(k); if (p) return p.name;
  const m = (S.history[k] || []).find((x) => x.dir === 'in');
  return m?.fromName || 'Unknown';
}
const lastMsg = (k) => { const l = S.history[k] || []; return l[l.length - 1] || null; };
const isOnline = (k) => (k === EVERYONE || isGroup(k) ? S.connected : !!S.peers.get(k)?.online);
const onlinePeers = () => [...S.peers.values()].filter((p) => p.online);
const unreadOf = (k) => (S.history[k] || []).filter((m) => m.dir === 'in' && !m.deleted && m.ts > (S.reads[k] || 0)).length;
function allChatKeys() {
  return [...new Set([EVERYONE, ...Object.keys(S.groups), ...S.peers.keys(), ...Object.keys(S.history)])].filter((k) => !isGroup(k) || S.groups[k]).sort((a, b) => {
    if (a === EVERYONE) return -1; if (b === EVERYONE) return 1;
    return ((lastMsg(b)?.ts || 0) - (lastMsg(a)?.ts || 0)) || (isOnline(b) - isOnline(a)) || chatName(a).localeCompare(chatName(b));
  });
}
function typingNames(k) { const t = S.typing[k]; if (!t) return []; const now = Date.now(); return Object.values(t).filter((x) => x.until > now).map((x) => x.name); }
const typingHTML = (l) => `<span class="typing-text">${esc(l)}<span class="dots"><i></i><i></i><i></i></span></span>`;
function previewOf(m) {
  if (!m) return '';
  if (m.dir === 'sys') return m.text;
  if (m.deleted) return 'Message deleted';
  if (m.kind === 'alert') return `🚨 ${m.text}`;
  if (m.file) return m.file.voice ? `🎤 Voice message (${fmtDur(m.file.duration)})` : m.file.folder ? `📁 ${m.file.name.replace(/\.zip$/i, '')}` : isImage(m.file.name) ? '📷 Photo' : `📎 ${m.file.name}`;
  return String(m.text || '').replace(/```[a-zA-Z0-9+#-]*\n?/g, '').replace(/\s+/g, ' ').trim();
}

let toastTimer;
function toast(text, icon = 'check', onTap) {
  const t = $('#toast');
  t.innerHTML = `${ic(icon)}<span>${esc(text)}</span>`;
  t.classList.toggle('tappable', !!onTap);
  t.onclick = onTap ? () => { t.classList.remove('show'); onTap(); } : null;
  t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function applyTheme() { if (S.theme) document.documentElement.dataset.theme = S.theme; else delete document.documentElement.dataset.theme; }
applyTheme();
const darkNow = () => (S.theme ? S.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);

// ---------- connection
let ws = null, retry = 0, retryTimer = null, rid = 0;
const waiting = new Map();
function connect() {
  if (!BASE() || (!account && !pinTry)) return;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  clearTimeout(retryTimer);
  try { ws = new WebSocket(BASE().replace(/^http/, 'ws') + '/ws'); } catch { return scheduleRetry(); }
  const sock = ws;
  sock.onopen = () => {
    retry = 0;
    const hello = { t: 'hello', deviceId, deviceName };
    if (pinTry) hello.pin = pinTry;
    else if (account.mode === 'linked') hello.link = account.link;
    else hello.guest = { id: account.id, name: account.name };
    sock.send(JSON.stringify(hello));
  };
  sock.onmessage = (e) => { let d; try { d = JSON.parse(e.data); } catch { return; } handle(d); };
  sock.onclose = () => { if (ws !== sock) return; const was = S.connected; S.connected = false; S.session = null; renderConn(); if (was) renderChatList(); if (account) scheduleRetry(); };
  sock.onerror = () => {};
}
function scheduleRetry() { clearTimeout(retryTimer); retryTimer = setTimeout(connect, Math.min(8000, 1200 * 2 ** retry++)); }
function act(name, ...args) {
  return new Promise((res) => {
    if (!ws || ws.readyState !== 1 || !S.connected) { toast('Not connected to your PC', 'wifi'); return res(null); }
    const id = ++rid; waiting.set(id, res);
    ws.send(JSON.stringify({ t: 'act', name, args, rid: id }));
    setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); res(null); } }, 15000);
  });
}
const actNoWait = (name, ...args) => { if (ws && ws.readyState === 1 && S.connected) ws.send(JSON.stringify({ t: 'act', name, args })); else toast('Not connected to your PC', 'wifi'); };
document.addEventListener('visibilitychange', () => { if (!document.hidden) { retry = 0; connect(); if (S.active) markRead(); } });
window.addEventListener('online', () => { retry = 0; connect(); });

function handle(d) {
  switch (d.t) {
    case 'welcome': {
      if (pinTry || (d.mode === 'linked' && d.link && account?.link !== d.link)) { account = { mode: 'linked', link: d.link }; store.set('account', account); }
      const wasPin = !!pinTry; pinTry = null;
      Object.assign(S, { connected: true, session: d.session, host: d.host, mode: d.mode, me: d.me, history: d.history || {}, groups: d.groups || {}, pins: d.pins || {}, muted: d.muted || {}, reads: d.reads || {} });
      S.peers = new Map(d.peers.map((p) => [p.id, p]));
      saveCache(); renderAll();
      if (wasPin || !$('#onboard').hidden) onboardDone();
      if (S.active) { renderHeader(); renderMessages(true); markRead(); }
      break;
    }
    case 'denied':
      if (pinTry) { pinTry = null; showOnboarding(d.reason); return; }
      store.del('account'); store.del('cache'); account = null;
      Object.assign(S, { me: null, history: {}, groups: {}, pins: {}, peers: new Map() }); renderAll();
      showOnboarding(d.reason);
      break;
    case 'res': { const f = waiting.get(d.rid); if (f) { waiting.delete(d.rid); f(d.result); } break; }
    case 'peers': S.peers = new Map(d.peers.map((p) => [p.id, p])); renderConn(); renderChatList(); if (S.active) renderHeader(); break;
    case 'message': {
      const list = (S.history[d.chatKey] ||= []);
      const wasPending = !!S.pending[d.msg.msgId];
      delete S.pending[d.msg.msgId];
      const i = list.findIndex((m) => m.msgId === d.msg.msgId);
      if (i >= 0) { list[i] = d.msg; if (d.chatKey === S.active) renderMessages(); break; }
      list.push(d.msg);
      if (d.msg.dir === 'in' && S.typing[d.chatKey]) delete S.typing[d.chatKey][d.msg.from];
      if (!wasPending) S.newIds.add(d.msg.msgId);
      const viewing = d.chatKey === S.active && !document.hidden;
      if (d.msg.dir === 'in' && !viewing && !S.muted[d.chatKey] && d.msg.kind !== 'alert') {
        buzz([12, 60, 12]);
        if (d.chatKey !== S.active) toast(`${d.msg.fromName}: ${previewOf(d.msg)}`.slice(0, 80), 'reply', () => openChat(d.chatKey));
      }
      if (d.chatKey === S.active) { if (d.msg.dir === 'in' && !nearBottom()) S.newBelow++; renderMessages(d.msg.dir === 'out'); renderHeader(); if (d.msg.dir === 'in') markRead(); }
      renderChatList(); saveCache();
      break;
    }
    case 'update': { const l = S.history[d.chatKey] || []; const i = l.findIndex((m) => m.msgId === d.msg.msgId); if (i >= 0) l[i] = d.msg; if (d.chatKey === S.active) { renderMessages(); renderPinBar(); } renderChatList(); saveCache(); break; }
    case 'status': { const m = (S.history[d.chatKey] || []).find((x) => x.msgId === d.msgId); if (m) { m.status = d.status; delete S.progress[d.msgId]; if (d.chatKey === S.active) renderMessages(); saveCache(); } break; }
    case 'progress': {
      S.progress[d.msgId] = d;
      const row = box.querySelector(`.row[data-id="${CSS.escape(d.msgId)}"]`);
      if (row) { const b = row.querySelector('.bar span'), l = row.querySelector('.pct'); if (b) b.style.width = d.pct + '%'; if (l) l.textContent = d.pct + '%'; }
      break;
    }
    case 'typing': (S.typing[d.chatKey] ||= {})[d.from] = { name: d.name, until: Date.now() + 4000 }; renderChatList(); if (d.chatKey === S.active) renderHeader(); setTimeout(() => { renderChatList(); if (S.active === d.chatKey) renderHeader(); }, 4100); break;
    case 'removed': S.history[d.chatKey] = (S.history[d.chatKey] || []).filter((m) => m.msgId !== d.msgId); if (d.chatKey === S.active) renderMessages(); renderChatList(); saveCache(); break;
    case 'cleared': if (d.removed) delete S.history[d.chatKey]; else S.history[d.chatKey] = []; if (d.chatKey === S.active) { if (d.removed) history.back(); else renderMessages(); } renderChatList(); saveCache(); break;
    case 'pins': S.pins = d.pins; renderPinBar(); renderChatList(); saveCache(); break;
    case 'muted': S.muted = d.muted; renderChatList(); saveCache(); break;
    case 'reads': S.reads[d.chatKey] = d.ts; renderChatList(); saveCache(); break;
    case 'groups': S.groups = d.groups; renderChatList(); if (S.active && isGroup(S.active)) renderHeader(); saveCache(); break;
    case 'me': S.me = d.me; renderMe(); saveCache(); break;
    case 'alert': showAlert(d.chatKey, d.msg); break;
    default:
  }
}

function renderConn() {
  $('#connPill').classList.toggle('on', S.connected);
  const n = onlinePeers().length;
  $('#connText').textContent = S.connected ? `${S.mode === 'linked' ? `Linked to ${S.host?.name || 'PC'}` : `via ${S.host?.name || 'PC'}`} · ${n} online` : (BASE() ? 'Connecting to your PC…' : 'Not connected');
  $('#offlineBanner').hidden = S.connected;
}
function updateTitle() { const n = allChatKeys().filter((k) => !S.muted[k]).reduce((a, k) => a + unreadOf(k), 0); document.title = n ? `(${n}) NfyniQ` : 'NfyniQ Chat'; }
function renderAll() { renderMe(); renderConn(); renderChatList(); }

// ---------- list
function renderMe() { if (!S.me) { $('#meBtn').innerHTML = ''; return; } $('#meBtn').innerHTML = avatarHTML(S.me.id, S.me.name, 'xs', S.me.avatar) + `<span class="st-dot ${S.me.status?.p || 'available'}"></span>`; }
function renderChatList() {
  const f = S.filter.trim().toLowerCase();
  let html = '';
  for (const k of allChatKeys()) {
    const name = chatName(k);
    if (f && !name.toLowerCase().includes(f)) continue;
    const m = lastMsg(k), tn = typingNames(k), unread = unreadOf(k), p = S.peers.get(k);
    let preview;
    if (tn.length) preview = typingHTML(k === EVERYONE || isGroup(k) ? `${tn[0]} is typing` : 'typing');
    else if (m) preview = esc((m.dir === 'out' ? 'You: ' : (k === EVERYONE || isGroup(k)) && m.dir === 'in' ? `${m.fromName}: ` : '') + previewOf(m));
    else if (isGroup(k)) preview = esc(`${S.groups[k].members.length} members`);
    else preview = esc(k === EVERYONE ? `${onlinePeers().length} online on this Wi-Fi` : p?.online ? (p.status?.t || STATUS_LABEL[p.status?.p] || 'Online') : lastSeen(p?.lastSeen));
    const icons = (p ? ic(p.kind === 'mobile' ? 'phone' : 'monitor') : '') + (S.muted[k] ? ic('bellOff') : '') + ((S.pins[k] || []).length ? ic('pin') : '');
    html += `<div class="chat-item${unread && !S.muted[k] ? ' unread' : ''}" data-key="${esc(k)}">
      <div class="avatar-wrap">${avatarHTML(k, name, '', peerPhoto(k))}${stDot(p)}</div>
      <div class="ci-body"><div class="ci-top"><span class="ci-name">${esc(name)} <span class="ci-icons">${icons}</span></span><span class="ci-time">${m ? fmtListTime(m.ts) : ''}</span></div>
      <div class="ci-bottom"><span class="ci-preview">${preview}</span>${unread ? `<span class="badge"${S.muted[k] ? ' style="opacity:.45"' : ''}>${unread > 99 ? '99+' : unread}</span>` : ''}</div></div></div>`;
  }
  if (f.length >= 2) html += searchResults(f);
  if (!S.connected && !S.peers.size && !f) html += `<div class="list-hint"><div class="radar"><span></span><span></span><span></span>${ic('wifi')}</div><b>Connecting to your PC…</b>Make sure this phone is on the same Wi-Fi and NfyniQ Chat is running on the computer.</div>`;
  $('#chatList').innerHTML = html;
  updateTitle();
}
function searchResults(f) {
  const hits = [];
  for (const [k, list] of Object.entries(S.history)) for (let i = list.length - 1; i >= 0 && hits.length < 30; i--) {
    const m = list[i], t = m.deleted ? '' : m.text || m.file?.name || '';
    if (m.dir !== 'sys' && t.toLowerCase().includes(f)) hits.push({ k, m, t });
  }
  if (!hits.length) return '';
  hits.sort((a, b) => b.m.ts - a.m.ts);
  return '<div class="list-sec">Messages</div>' + hits.map(({ k, m, t }) => {
    const i = t.toLowerCase().indexOf(f), s = Math.max(0, i - 20);
    return `<div class="hit" data-key="${esc(k)}" data-id="${esc(m.msgId)}"><div class="hit-top"><b>${esc(chatName(k))}</b>${fmtListTime(m.ts)}</div><div class="hit-text">${s ? '…' : ''}${esc(t.slice(s, i))}<mark>${esc(t.slice(i, i + f.length))}</mark>${esc(t.slice(i + f.length, i + f.length + 50))}</div></div>`;
  }).join('');
}
$('#chatList').addEventListener('click', (e) => {
  const hit = e.target.closest('.hit');
  if (hit) { openChat(hit.dataset.key); setTimeout(() => jumpTo(hit.dataset.id), 420); return; }
  const it = e.target.closest('.chat-item'); if (it) openChat(it.dataset.key);
});
$('#search').addEventListener('input', (e) => { S.filter = e.target.value; renderChatList(); });

// ---------- conversation
const box = $('#messages');
const input = $('#input');
const nearBottom = () => box.scrollHeight - box.scrollTop - box.clientHeight < 160;
function openChat(k) {
  if (S.active && S.active !== k) S.drafts[S.active] = input.value;
  const changed = S.active !== k;
  S.active = k; S.newBelow = 0;
  if (changed) { cancelReply(); cancelEdit(); input.value = S.drafts[k] || ''; autoGrow(); updateSend(); }
  if (!document.body.classList.contains('in-chat')) { document.body.classList.add('in-chat'); history.pushState({ chat: k }, ''); }
  renderHeader(); renderMessages(true); renderChatList(); markRead();
}
function closeChat() {
  if (S.active) S.drafts[S.active] = input.value;
  document.body.classList.remove('in-chat'); input.blur();
  stopRecording(false);
  setTimeout(() => { if (!document.body.classList.contains('in-chat')) S.active = null; }, 380);
  renderChatList();
}
$('#backBtn').addEventListener('click', () => history.back());
window.addEventListener('popstate', () => { if (closeSheet()) return; if (!$('#viewer').hidden) { $('#viewer').hidden = true; return; } if (document.body.classList.contains('in-chat')) closeChat(); });
let readTimer;
function markRead() { if (!S.active || document.hidden || !S.connected) return; clearTimeout(readTimer); readTimer = setTimeout(() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'act', name: 'markRead', args: [S.active] })); }, 400); }

function renderHeader() {
  const k = S.active, p = S.peers.get(k), st = $('#headStatus'), tn = typingNames(k);
  $('#headAvatar').innerHTML = avatarHTML(k, chatName(k), 'sm', peerPhoto(k)) + stDot(p);
  $('#headName').textContent = k === EVERYONE ? 'Everyone on this Wi-Fi' : chatName(k);
  st.classList.remove('online');
  if (tn.length) st.innerHTML = typingHTML(k === EVERYONE || isGroup(k) ? `${tn.join(', ')} ${tn.length > 1 ? 'are' : 'is'} typing` : 'typing');
  else if (k === EVERYONE) st.textContent = onlinePeers().map((x) => x.name).join(', ') || 'Nobody else online';
  else if (isGroup(k)) st.textContent = (S.groups[k]?.members || []).map((m) => (m.id === S.me?.id ? 'You' : m.name)).join(', ');
  else if (p) {
    const bits = [p.online ? (p.kind === 'mobile' ? 'online · phone' : 'online') : lastSeen(p.lastSeen)];
    if (p.online && p.status?.p && p.status.p !== 'available') bits.push(STATUS_LABEL[p.status.p]);
    if (p.online && p.status?.t) bits.push(esc(p.status.t));
    st.innerHTML = bits.join(' · ') + (p.encrypted ? ' · 🔒' : '');
    st.classList.toggle('online', !!p.online);
  } else st.textContent = 'offline';
  renderPinBar();
}
let pinIdx = 0;
function renderPinBar() {
  const bar = $('#pinBar');
  const ids = (S.pins[S.active] || []).filter((id) => findMsg(id));
  if (!S.active || !ids.length) { bar.hidden = true; return; }
  pinIdx = Math.min(pinIdx, ids.length - 1);
  const m = findMsg(ids[ids.length - 1 - pinIdx]);
  bar.hidden = false; bar.dataset.id = m.msgId;
  bar.innerHTML = `${ic('pin')}<div class="pb-body"><div class="pb-title">Pinned${ids.length > 1 ? ` · ${pinIdx + 1}/${ids.length}` : ''}</div><div class="pb-text">${esc(previewOf(m))}</div></div>`;
}
$('#pinBar').addEventListener('click', () => { jumpTo($('#pinBar').dataset.id); pinIdx = (pinIdx + 1) % Math.max(1, (S.pins[S.active] || []).length); renderPinBar(); });

const fileUrl = (f) => (f?.url ? BASE() + f.url : '');
function quoteHTML(r) { return `<div class="quote" data-jump="${esc(r.msgId)}"><div class="q-name">${esc(r.fromId === S.me?.id ? 'You' : r.fromName)}</div><div class="q-text">${r.isFile ? ic('file', 'xs') : ''}<span>${esc(r.preview)}</span></div></div>`; }
function waveHTML(id) { let h = 2166136261, out = ''; for (let i = 0; i < 28; i++) { h = Math.imul(h ^ (id.charCodeAt(i % id.length) + i), 16777619) >>> 0; out += `<i style="height:${25 + (h % 70)}%"></i>`; } return out; }
function fileHTML(m) {
  const f = m.file, busy = m.status === 'sending' || m.status === 'receiving' || m.pending;
  const pr = S.progress[m.msgId] || {}, pct = m.pending ? m.pct || 0 : pr.pct || 0, url = fileUrl(f);
  const failedIn = m.dir === 'in' && m.status === 'failed';
  if (f.voice && url && !failedIn && m.status !== 'receiving') return `<div class="voice" data-src="${esc(url)}" data-dur="${f.duration || 0}"><button class="vplay" data-act="vplay">${ic('play')}</button><div class="wave" data-act="vseek">${waveHTML(m.msgId)}</div><span class="vtime">${fmtDur(f.duration)}</span></div>`;
  if (url && !failedIn && m.status !== 'receiving' && isImage(f.name)) return `<img class="thumb" src="${esc(url)}" alt="${esc(f.name)}" data-view="${esc(url)}" data-name="${esc(f.name)}" loading="lazy">`;
  if (url && !failedIn && m.status !== 'receiving' && isVideo(f.name)) return `<video class="thumb" src="${esc(url)}" controls playsinline preload="metadata"></video><div class="file-pad"></div>`;
  const e = extOf(f.name);
  return `<div class="file" data-open="${esc(url)}"><div class="file-icon${f.folder ? ' folder' : ''}" style="--fc:${fileColor(e)}">${f.folder ? ic('folder') : esc((e || 'file').slice(0, 4).toUpperCase())}</div>
    <div class="file-info"><div class="file-name">${esc(f.folder ? f.name.replace(/\.zip$/i, '') : f.name)}</div>
    <div class="file-sub">${fmtSize(f.size)}${busy ? ` · <span class="pct">${pct}%</span>` : failedIn ? ' · failed' : url ? (f.folder ? ' · tap to download .zip' : ' · tap to open') : ''}</div>
    ${busy ? `<div class="bar"><span style="width:${pct}%"></span></div>` : ''}</div></div><div class="file-pad"></div>`;
}
function reactsHTML(m) {
  const by = {}; for (const [uid, v] of Object.entries(m.reactions || {})) (by[v.e] ||= []).push(uid === S.me?.id ? 'You' : v.n);
  const ks = Object.keys(by); if (!ks.length) return '';
  return `<div class="reacts">${ks.map((e) => `<span class="react-chip${m.reactions[S.me?.id]?.e === e ? ' mine' : ''}" data-react="${esc(e)}">${e}${by[e].length > 1 ? `<b>${by[e].length}</b>` : ''}</span>`).join('')}</div>`;
}
function bubbleHTML(m, first, last) {
  if (m.dir === 'sys') return `<div class="row sys" data-id="${esc(m.msgId)}"><span class="sys-chip">${esc(m.text)}</span></div>`;
  const out = m.dir === 'out', group = S.active === EVERYONE || isGroup(S.active);
  const cls = `row ${out ? 'out' : 'in'}${first ? ' first' : ''}${last ? ' last' : ''}${S.newIds.has(m.msgId) ? ' pop' : ''}${m.pending ? ' pending' : ''}`;
  const sender = !out && group && first ? `<div class="sender" style="--h:${hue(m.from)}">${esc(m.fromName)}</div>` : '';
  let body, bcls = 'bubble';
  if (m.deleted) { body = '<span class="text">This message was deleted</span><span class="spacer"></span>'; bcls += ' deleted'; }
  else if (m.kind === 'alert') {
    bcls += ' alert-bubble';
    const acks = Object.values(m.acks || {});
    body = `<div class="alert-tag">${ic('siren')}Urgent alert</div><span class="text">${esc(m.text)}</span>` + (out ? `<div class="alert-acks">${acks.length ? `Acknowledged by ${esc(acks.join(', '))}` : 'Waiting for acknowledgements…'}</div>` : m.acked ? '<div class="alert-acks">You acknowledged this</div>' : '<button class="ack-btn" data-act="ack">Got it</button>');
  } else body = m.file ? fileHTML(m) : `<span class="text">${formatText(m.text)}</span><span class="spacer"></span>`;
  const fwd = m.forwarded && !m.deleted ? `<div class="fwd">${ic('forward', 'xs')}Forwarded</div>` : '';
  const quote = m.replyTo && !m.deleted ? quoteHTML(m.replyTo) : '';
  return `<div class="${cls}" data-id="${esc(m.msgId)}"><div class="swipe-reply">${ic('reply')}</div><div class="${bcls}">${sender}${fwd}${quote}${body}${reactsHTML(m)}<span class="meta">${m.edited && !m.deleted ? '<span class="edited">edited</span>' : ''}${fmtTime(m.ts)}${out ? STATUS[m.pending ? 'sending' : m.status] || '' : ''}</span></div></div>`;
}
function renderMessages(force = false) {
  if (!S.active) return;
  const nb = nearBottom();
  const list = [...(S.history[S.active] || []), ...Object.values(S.pending).filter((p) => p.chatKey === S.active)];
  const same = (a, b) => a && b && a.dir !== 'sys' && b.dir !== 'sys' && a.dir === b.dir && a.from === b.from && fmtDay(a.ts) === fmtDay(b.ts) && b.ts - a.ts < 300000 && !a.kind && !b.kind;
  let html = '', lastDay = '';
  list.forEach((m, i) => { const day = fmtDay(m.ts); if (day !== lastDay) { html += `<div class="day"><span>${day}</span></div>`; lastDay = day; } html += bubbleHTML(m, !same(list[i - 1], m), !same(m, list[i + 1])); });
  if (!list.length) html = `<div class="day intro"><span>${S.active === EVERYONE ? 'Messages here go to everyone online on this Wi-Fi.' : isGroup(S.active) ? 'Messages here go to everyone in this group.' : 'Say hi! Messages go over your Wi-Fi.'}</span></div>`;
  const playing = voice.audio && !voice.audio.paused ? voice.id : null;
  box.innerHTML = html;
  S.newIds.clear();
  if (force || nb) { box.scrollTop = box.scrollHeight; S.newBelow = 0; }
  if (playing) markVoice(playing, true);
  updateFab();
}
function updateFab() { const away = box.scrollHeight - box.scrollTop - box.clientHeight > 300; if (!away) S.newBelow = 0; $('#scrollDown').classList.toggle('show', away); $('#fabBadge').hidden = !S.newBelow; $('#fabBadge').textContent = S.newBelow; }
box.addEventListener('scroll', updateFab, { passive: true });
$('#scrollDown').addEventListener('click', () => box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }));
const findMsg = (id, k = S.active) => (S.history[k] || []).find((m) => m.msgId === id);
function jumpTo(id) {
  const row = box.querySelector(`.row[data-id="${CSS.escape(id)}"]`);
  if (!row) return toast('That message is no longer here', 'info');
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
}
function openUrl(url) { if (!url) return toast('This file isn’t available yet', 'info'); if (NATIVE) location.href = url; else window.open(url, '_blank'); }
function openViewer(url, name) { $('#vImg').src = url; $('#vName').textContent = name; $('#vSave').href = url + '?dl'; $('#viewer').hidden = false; history.pushState({ v: 1 }, ''); }
$('#vClose').addEventListener('click', () => history.back());
document.addEventListener('click', (e) => { const a = e.target.closest('a[href]'); if (a && NATIVE && !a.id) { e.preventDefault(); location.href = a.href; } });

// voice playback
const voice = { audio: null, id: null, raf: 0 };
function markVoice(id, on) { const r = box.querySelector(`.row[data-id="${CSS.escape(id)}"] .vplay`); if (r) r.innerHTML = ic(on ? 'pause' : 'play'); }
function playVoice(row, frac) {
  const v = row.querySelector('.voice'), id = row.dataset.id;
  if (voice.id === id && voice.audio && frac == null) { voice.audio.paused ? voice.audio.play() : voice.audio.pause(); return; }
  if (voice.audio && voice.id !== id) { voice.audio.pause(); markVoice(voice.id, false); }
  if (voice.id !== id) {
    voice.audio = new Audio(v.dataset.src); voice.id = id;
    voice.audio.onplay = () => { markVoice(id, true); tick(); };
    voice.audio.onpause = () => { markVoice(id, false); cancelAnimationFrame(voice.raf); };
    voice.audio.onended = () => { markVoice(id, false); paint(0); };
  }
  const dur = () => (isFinite(voice.audio.duration) ? voice.audio.duration : Number(v.dataset.dur) || 1);
  function paint(f) { const r = box.querySelector(`.row[data-id="${CSS.escape(id)}"]`); if (!r) return; const bars = r.querySelectorAll('.wave i'), n = Math.round(f * bars.length); bars.forEach((b, i) => b.classList.toggle('on', i < n)); const t = r.querySelector('.vtime'); if (t) t.textContent = fmtDur(f ? voice.audio.currentTime : dur()); }
  function tick() { paint(voice.audio.currentTime / dur()); voice.raf = requestAnimationFrame(tick); }
  if (frac != null) { const go = () => { voice.audio.currentTime = frac * dur(); voice.audio.play(); }; voice.audio.readyState >= 1 ? go() : (voice.audio.onloadedmetadata = go); }
  else voice.audio.play().catch(() => toast('This phone can’t play that voice message', 'info'));
}

// taps, swipe-to-reply, long-press
const gesture = { row: null, x0: 0, y0: 0, dx: 0, timer: null, handled: false, lastEnd: 0, mode: null, buzzed: false };
box.addEventListener('click', (e) => {
  if (Date.now() - gesture.lastEnd < 350 && gesture.handled) return;
  const cp = e.target.closest('[data-copy]'); if (cp) { copyText(cp.dataset.copy); return; }
  const j = e.target.closest('[data-jump]'); if (j) return jumpTo(j.dataset.jump);
  const row = e.target.closest('.row'); const m = row && findMsg(row.dataset.id);
  const chip = e.target.closest('[data-react]'); if (chip && m) return actNoWait('react', S.active, m.msgId, chip.dataset.react);
  const a = e.target.closest('[data-act]');
  if (a && m) {
    if (a.dataset.act === 'ack') return actNoWait('ackAlert', S.active, m.msgId);
    if (a.dataset.act === 'vplay') return playVoice(row);
    if (a.dataset.act === 'vseek') { const r = a.getBoundingClientRect(); return playVoice(row, (e.clientX - r.left) / r.width); }
  }
  const v = e.target.closest('[data-view]'); if (v) return openViewer(v.dataset.view, v.dataset.name);
  const o = e.target.closest('[data-open]'); if (o) return openUrl(o.dataset.open);
});
box.addEventListener('touchstart', (e) => {
  const row = e.target.closest('.row:not(.sys)'); if (!row) return;
  const t = e.touches[0];
  Object.assign(gesture, { row, x0: t.clientX, y0: t.clientY, dx: 0, handled: false, mode: null });
  gesture.timer = setTimeout(() => {
    if (gesture.mode) return;
    gesture.mode = 'hold'; gesture.handled = true; row.classList.add('held'); buzz(15);
    const m = findMsg(row.dataset.id); if (m && !m.deleted) openActions(m);
    setTimeout(() => row.classList.remove('held'), 200);
  }, 430);
}, { passive: true });
box.addEventListener('touchmove', (e) => {
  if (!gesture.row) return;
  const t = e.touches[0], dx = t.clientX - gesture.x0, dy = t.clientY - gesture.y0;
  if (!gesture.mode && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) { clearTimeout(gesture.timer); gesture.mode = Math.abs(dx) > Math.abs(dy) && dx > 0 ? 'swipe' : 'scroll'; }
  if (gesture.mode !== 'swipe') return;
  gesture.dx = Math.max(0, Math.min(90, dx));
  const b = gesture.row.querySelector('.bubble'), icon = gesture.row.querySelector('.swipe-reply');
  b.style.transition = 'none'; b.style.transform = `translateX(${gesture.dx}px)`;
  const p = Math.min(1, gesture.dx / 64); icon.style.opacity = p; icon.style.transform = `scale(${0.5 + p * 0.5})`;
  if (gesture.dx >= 64 && !gesture.buzzed) { gesture.buzzed = true; buzz(10); }
}, { passive: true });
function endGesture() {
  clearTimeout(gesture.timer);
  const row = gesture.row; if (!row) return;
  if (gesture.mode === 'swipe') {
    const b = row.querySelector('.bubble'), icon = row.querySelector('.swipe-reply');
    b.style.transition = ''; b.style.transform = ''; icon.style.opacity = 0; icon.style.transform = '';
    if (gesture.dx >= 64) { const m = findMsg(row.dataset.id); if (m && !m.deleted) startReply(m); gesture.handled = true; }
  }
  gesture.row = null; gesture.buzzed = false; gesture.lastEnd = Date.now();
}
box.addEventListener('touchend', endGesture); box.addEventListener('touchcancel', endGesture);
box.addEventListener('contextmenu', (e) => { const row = e.target.closest('.row:not(.sys)'); if (!row) return; e.preventDefault(); if (gesture.mode === 'hold') return; const m = findMsg(row.dataset.id); if (m && !m.deleted) openActions(m); });

// ---------- composer
function startReply(m) {
  cancelEdit();
  S.replyTo = { msgId: m.msgId, fromId: m.from, fromName: m.dir === 'out' ? S.me.name : m.fromName, preview: previewOf(m).slice(0, 140), isFile: !!m.file };
  showBar(m.dir === 'out' ? 'Replying to yourself' : `Replying to ${m.fromName}`, S.replyTo.preview, false, !!m.file);
}
function startEdit(m) { cancelReply(); S.editing = m.msgId; showBar('Editing message', m.text, true); input.value = m.text; autoGrow(); updateSend(); }
function showBar(title, text, editing, isFile) {
  $('#replyQuote').innerHTML = `<div class="q-name">${esc(title)}</div><div class="q-text">${isFile ? ic('file', 'xs') : ''}<span>${esc(text)}</span></div>`;
  const bar = $('#replyBar'); bar.classList.toggle('editing', !!editing); bar.hidden = true; void bar.offsetWidth; bar.hidden = false; input.focus();
}
function cancelReply() { S.replyTo = null; if (!S.editing) $('#replyBar').hidden = true; }
function cancelEdit() { if (!S.editing) return; S.editing = null; $('#replyBar').hidden = true; input.value = ''; autoGrow(); updateSend(); }
$('#replyCancel').addEventListener('click', () => (S.editing ? cancelEdit() : cancelReply()));
const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 130) + 'px'; }
function updateSend() {
  const has = !!input.value.trim() || !!S.editing, b = $('#sendBtn');
  b.classList.toggle('ready', has); b.classList.toggle('mic', !has && canRecord);
  b.innerHTML = ic(has ? (S.editing ? 'check' : 'send') : canRecord ? 'mic' : 'send');
}
let lastTyping = 0;
input.addEventListener('input', () => { autoGrow(); updateSend(); if (S.active && S.connected && input.value.trim() && !S.editing && Date.now() - lastTyping > 2500) { lastTyping = Date.now(); ws.send(JSON.stringify({ t: 'act', name: 'typingTo', args: [S.active] })); } });
async function send() {
  const text = input.value.trim();
  if (!S.active) return;
  if (!text && !S.editing) { if (canRecord) startRecording(); return; }
  if (S.editing) { const r = await act('edit', S.active, S.editing, text); if (r && r.error) toast(r.error, 'info'); S.editing = null; $('#replyBar').hidden = true; input.value = ''; autoGrow(); updateSend(); return; }
  if (!S.connected) return toast('Not connected to your PC', 'wifi');
  actNoWait('sendText', S.active, text, { replyTo: S.replyTo });
  input.value = ''; S.drafts[S.active] = ''; cancelReply(); autoGrow(); updateSend();
  const b = $('#sendBtn'); b.classList.remove('fly'); void b.offsetWidth; b.classList.add('fly'); buzz(8);
}
$('#sendBtn').addEventListener('pointerdown', (e) => e.preventDefault());
$('#sendBtn').addEventListener('click', send);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send(); } });

// files
$('#attachBtn').addEventListener('click', () => { if (!S.connected) return toast('Not connected to your PC', 'wifi'); $('#fileInput').click(); });
$('#fileInput').addEventListener('change', (e) => { const files = [...e.target.files]; e.target.value = ''; let reply = S.replyTo; cancelReply(); for (const f of files) { upload(S.active, f, { replyTo: reply }); reply = null; } });
function upload(chatKey, file, extra = {}) {
  const msgId = uuid();
  const p = { msgId, chatKey, pending: true, dir: 'out', from: S.me.id, fromName: S.me.name, ts: Date.now(), pct: 0, replyTo: extra.replyTo || null, file: { name: extra.name || file.name, size: file.size, voice: !!extra.voice, duration: extra.duration || 0 } };
  S.pending[msgId] = p; S.newIds.add(msgId);
  if (chatKey === S.active) renderMessages(true);
  const xhr = new XMLHttpRequest();
  xhr.open('POST', BASE() + '/upload');
  xhr.setRequestHeader('X-Session', S.session || '');
  xhr.setRequestHeader('X-Opts', encodeURIComponent(JSON.stringify({ chatKey, msgId, name: p.file.name, replyTo: extra.replyTo || null, voice: !!extra.voice, duration: extra.duration || 0 })));
  let last = 0;
  xhr.upload.onprogress = (ev) => {
    if (!ev.lengthComputable || Date.now() - last < 100) return; last = Date.now();
    p.pct = Math.min(99, Math.floor((ev.loaded / ev.total) * 100));
    const row = box.querySelector(`.row[data-id="${CSS.escape(msgId)}"]`);
    if (row) { const b = row.querySelector('.bar span'), l = row.querySelector('.pct'); if (b) b.style.width = p.pct + '%'; if (l) l.textContent = p.pct + '%'; }
  };
  const fail = (msg) => { delete S.pending[msgId]; toast(msg, 'info'); if (chatKey === S.active) renderMessages(); };
  xhr.onload = () => { if (xhr.status !== 200) fail('Upload failed'); };
  xhr.onerror = () => fail('Upload failed — check the Wi-Fi');
  xhr.send(file);
}

// voice recording (Android app / secure pages; a plain http page in Safari/Chrome can't use the mic)
const rec = { mr: null, stream: null, chunks: [], t0: 0, timer: 0, type: '', ctx: null, raf: 0 };
async function startRecording() {
  try { rec.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast('Microphone not available', 'info'); }
  rec.type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
  rec.mr = new MediaRecorder(rec.stream, rec.type ? { mimeType: rec.type } : undefined);
  rec.chunks = []; rec.mr.ondataavailable = (e) => e.data.size && rec.chunks.push(e.data); rec.mr.start(250);
  rec.t0 = Date.now(); $('#composer').hidden = true; $('#recBar').hidden = false; $('#recMeter').innerHTML = ''; buzz(20);
  rec.timer = setInterval(() => { $('#recTime').textContent = fmtDur((Date.now() - rec.t0) / 1000); }, 250);
  try {
    rec.ctx = new AudioContext(); const an = rec.ctx.createAnalyser(); an.fftSize = 256; rec.ctx.createMediaStreamSource(rec.stream).connect(an);
    const data = new Uint8Array(an.frequencyBinCount); let lb = 0;
    const loop = () => { an.getByteTimeDomainData(data); if (performance.now() - lb > 80) { lb = performance.now(); let pk = 0; for (const v of data) pk = Math.max(pk, Math.abs(v - 128)); const i = document.createElement('i'); i.style.height = `${Math.max(3, Math.min(30, pk / 2.2))}px`; const mt = $('#recMeter'); mt.appendChild(i); while (mt.children.length > 70) mt.firstChild.remove(); } rec.raf = requestAnimationFrame(loop); };
    loop();
  } catch {}
}
function stopRecording(sendIt) {
  if (!rec.mr) return;
  const dur = (Date.now() - rec.t0) / 1000, chat = S.active, reply = S.replyTo;
  clearInterval(rec.timer); cancelAnimationFrame(rec.raf);
  rec.mr.onstop = () => {
    rec.stream.getTracks().forEach((t) => t.stop()); try { rec.ctx && rec.ctx.close(); } catch {}
    if (sendIt && dur > 0.6 && rec.chunks.length) {
      const type = rec.type || 'audio/webm', ext = type.includes('mp4') ? 'm4a' : 'webm';
      upload(chat, new Blob(rec.chunks, { type }), { name: `Voice ${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.${ext}`, voice: true, duration: dur, replyTo: reply });
      cancelReply();
    }
    rec.mr = null;
  };
  rec.mr.stop();
  $('#recBar').hidden = true; $('#composer').hidden = false;
}
$('#recSend').addEventListener('click', () => stopRecording(true));
$('#recCancel').addEventListener('click', () => stopRecording(false));

// ---------- sheets
const backdrop = $('#sheetBackdrop'), sheet = $('#sheet');
let sheetOpen = false;
function showSheet(html, tall) {
  sheet.className = 'sheet' + (tall ? ' tall' : '');
  sheet.innerHTML = '<div class="grab"></div>' + html;
  backdrop.hidden = false; sheet.hidden = false;
  requestAnimationFrame(() => { backdrop.classList.add('show'); sheet.classList.add('show'); });
  if (!sheetOpen) history.pushState({ sheet: 1 }, '');
  sheetOpen = true;
}
function closeSheet() {
  if (!sheetOpen) return false;
  sheetOpen = false;
  sheet.classList.remove('show'); backdrop.classList.remove('show');
  setTimeout(() => { if (!sheetOpen) { sheet.hidden = true; backdrop.hidden = true; } }, 300);
  return true;
}
const dismiss = () => { if (sheetOpen) history.back(); };
backdrop.addEventListener('click', dismiss);
function actionList(items) { return `<div class="sheet-actions">${items.map((it, i) => (it === '-' ? '<div class="sep"></div>' : `<button data-i="${i}" class="${it[3] ? 'danger' : ''}">${ic(it[0])}<span>${esc(it[1])}</span></button>`)).join('')}</div>`; }
function bindActions(items) { sheet.querySelectorAll('.sheet-actions button[data-i]').forEach((b) => (b.onclick = () => { const fn = items[b.dataset.i][2]; dismiss(); setTimeout(fn, 120); })); }

function openActions(m) {
  const own = m.dir === 'out', pinned = (S.pins[S.active] || []).includes(m.msgId);
  const items = [['reply', 'Reply', () => startReply(m)], ['forward', 'Forward', () => openForward(m)]];
  if (m.text && !m.kind) items.push(['copy', 'Copy text', () => copyText(m.text)]);
  if (own && !m.file && !m.kind && Date.now() - m.ts < 15 * 60000) items.push(['pencil', 'Edit', () => startEdit(m)]);
  items.push(['pin', pinned ? 'Unpin' : 'Pin', () => actNoWait('pin', S.active, m.msgId, !pinned)]);
  if (m.file?.url) items.push(['download', 'Open / save file', () => openUrl(fileUrl(m.file))]);
  items.push('-');
  if (own) items.push(['undo', 'Delete for everyone', () => actNoWait('unsend', S.active, m.msgId), true]);
  items.push(['trash', 'Delete for me', () => actNoWait('deleteLocal', S.active, m.msgId), true]);
  const mine = m.reactions?.[S.me?.id]?.e;
  showSheet(`<div class="emoji-row">${QUICK.map((e) => `<button data-emoji="${e}" class="${mine === e ? 'mine' : ''}">${e}</button>`).join('')}</div><div class="sheet-preview"><b>${esc(own ? 'You' : m.fromName)}</b>${esc(previewOf(m))}</div>${actionList(items)}`);
  bindActions(items);
  sheet.querySelectorAll('[data-emoji]').forEach((b) => (b.onclick = () => { actNoWait('react', S.active, m.msgId, b.dataset.emoji); buzz(8); dismiss(); }));
}
function copyText(t) {
  const done = () => toast('Copied');
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).then(done);
  const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch {} ta.remove();
}
function pickList(keys, sel, sub) {
  return keys.map((k) => { const p = S.peers.get(k); return `<div class="fwd-item${sel.has(k) ? ' sel' : ''}" data-key="${esc(k)}">${avatarHTML(k, chatName(k), 'sm', peerPhoto(k))}<div class="ci-body"><div class="ci-name">${esc(chatName(k))}</div><div class="ci-preview">${esc(sub(k, p))}</div></div><div class="check">${ic('check')}</div></div>`; }).join('');
}
function openForward(m) {
  const sel = new Set();
  const render = () => {
    sheet.querySelector('.pick-list').innerHTML = pickList(allChatKeys(), sel, (k, p) => (k === EVERYONE ? 'Everyone online' : isGroup(k) ? `${S.groups[k].members.length} members` : p?.online ? 'Online' : 'Offline'));
    sheet.querySelector('.fwd-names').textContent = sel.size ? [...sel].map(chatName).join(', ') : 'Select chats';
    sheet.querySelector('#fwdGo').disabled = !sel.size;
  };
  showSheet(`<div class="sheet-head"><h3>Forward to…</h3></div><div class="pick-list"></div><div class="fwd-foot"><div class="fwd-names"></div><button class="send-btn ready" id="fwdGo">${ic('send')}</button></div>`, true);
  render();
  sheet.querySelector('.pick-list').onclick = (e) => { const it = e.target.closest('.fwd-item'); if (!it) return; const k = it.dataset.key; sel.has(k) ? sel.delete(k) : sel.add(k); buzz(6); render(); };
  sheet.querySelector('#fwdGo').onclick = async () => {
    const keys = [...sel], chat = S.active;
    dismiss();
    const r = await act('forward', keys, { chatKey: chat, msgId: m.msgId });
    if (r && r.ok === false) toast(r.error || 'Could not forward', 'info'); else if (r) toast(`Forwarded to ${keys.length === 1 ? chatName(keys[0]) : keys.length + ' chats'}`, 'forward');
  };
}
function ask(title, value, placeholder, okLabel, validate, area) {
  return new Promise((resolve) => {
    showSheet(`<div class="sheet-pad"><h3>${esc(title)}</h3>${area ? `<textarea class="field" id="askIn" style="height:110px;padding:12px 15px;resize:none" placeholder="${esc(placeholder)}"></textarea>` : `<input class="field" id="askIn" placeholder="${esc(placeholder)}" autocomplete="off">`}<div class="field-err" id="askErr"></div><button class="btn primary wide" id="askOk">${esc(okLabel)}</button></div>`);
    const f = sheet.querySelector('#askIn'); f.value = value || '';
    setTimeout(() => f.focus(), 320);
    sheet.querySelector('#askOk').onclick = async () => {
      const v = f.value.trim();
      const e = !v ? 'This can’t be empty' : validate ? await validate(v) : null;
      if (e) { sheet.querySelector('#askErr').textContent = e; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); return; }
      dismiss(); resolve(v);
    };
  });
}
function openGroupSheet(gid) {
  const g = gid ? S.groups[gid] : null;
  const sel = new Set(g ? g.members.map((m) => m.id).filter((id) => id !== S.me.id) : []);
  const people = () => { const ids = new Set([...S.peers.keys(), ...(g ? g.members.map((m) => m.id) : [])]); ids.delete(S.me.id); return [...ids]; };
  const render = () => {
    sheet.querySelector('.pick-list').innerHTML = pickList(people(), sel, (k, p) => (p?.online ? 'Online' : 'Offline'));
    sheet.querySelector('#gGo').disabled = !sel.size || !sheet.querySelector('#gName').value.trim();
  };
  showSheet(`<div class="sheet-pad"><h3>${g ? 'Group info' : 'New group'}</h3><input class="field" id="gName" maxlength="60" placeholder="Group name"></div><div class="list-sec">Members</div><div class="pick-list"></div><div class="fwd-foot">${g ? '<button class="btn" id="gLeave" style="color:var(--danger)">Leave</button>' : ''}<div class="fwd-names"></div><button class="btn primary" id="gGo">${g ? 'Save' : 'Create'}</button></div>`, true);
  const name = sheet.querySelector('#gName'); name.value = g?.name || '';
  render(); name.oninput = render;
  sheet.querySelector('.pick-list').onclick = (e) => { const it = e.target.closest('.fwd-item'); if (!it) return; const k = it.dataset.key; sel.has(k) ? sel.delete(k) : sel.add(k); buzz(6); render(); };
  sheet.querySelector('#gGo').onclick = async () => {
    const n = name.value.trim(); dismiss();
    if (g) { actNoWait('editGroup', gid, n, [...sel]); toast('Group updated'); return; }
    const id = await act('createGroup', n, [...sel]);
    if (id) setTimeout(() => openChat(id), 400);
  };
  if (g) sheet.querySelector('#gLeave').onclick = () => { dismiss(); actNoWait('leaveGroup', gid); };
}
$('#newGroupBtn').addEventListener('click', () => { if (!S.connected) return toast('Not connected to your PC', 'wifi'); openGroupSheet(); });
$('#headMore').addEventListener('click', () => {
  const k = S.active, items = [];
  if (isGroup(k)) items.push(['users', 'Group info & members', () => openGroupSheet(k)]);
  items.push([S.muted[k] ? 'bell' : 'bellOff', S.muted[k] ? 'Unmute' : 'Mute notifications', () => actNoWait('setMute', k, !S.muted[k])]);
  if (k === EVERYONE) items.push(['siren', 'Send an urgent alert', sendAlert]);
  items.push('-', ['eraser', 'Clear this chat', () => actNoWait('clearChat', k), true]);
  if (isGroup(k)) items.push(['logout', 'Leave group', () => actNoWait('leaveGroup', k), true]);
  showSheet(`<div class="sheet-head"><h3>${esc(chatName(k))}</h3></div>${actionList(items)}`);
  bindActions(items);
});
async function sendAlert() {
  const t = await ask('Urgent alert to everyone online', '', 'e.g. Pressure test starting — clear the bay', 'Send alert', null, true);
  if (t) { actNoWait('sendAlert', t); toast('Alert sent', 'siren'); }
}
function squareImage(file, size) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const s = Math.min(img.width, img.height); c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); res(c.toDataURL('image/jpeg', 0.85)); }; img.onerror = rej; img.src = URL.createObjectURL(file); });
}
$('#meBtn').addEventListener('click', () => {
  if (!S.me) return;
  let st = S.me.status?.p || 'available';
  const items = [
    ['pencil', 'Change name', async () => { const n = await ask('Your name', S.me.name, 'Your name', 'Save'); if (n) actNoWait('setName', n); }],
    ['siren', 'Send an urgent alert', sendAlert],
    [darkNow() ? 'sun' : 'moon', darkNow() ? 'Light theme' : 'Dark theme', () => { S.theme = darkNow() ? 'light' : 'dark'; store.set('theme', S.theme); applyTheme(); }],
  ];
  if (NATIVE) items.push(['monitor', 'Connect to a different PC', changePc]);
  items.push('-', ['logout', S.mode === 'linked' ? 'Unlink this phone' : 'Sign out', () => { store.del('account'); store.del('cache'); account = null; try { ws && ws.close(); } catch {} location.reload(); }, true]);
  showSheet(`<div class="sheet-pad"><div class="prof"><label class="prof-av">${avatarHTML(S.me.id, S.me.name, '', S.me.avatar)}<span class="cam">${ic('pencil')}</span><input type="file" id="avIn" accept="image/*" hidden></label><div><b style="font-size:18px">${esc(S.me.name)}</b><div class="mode-tag">${S.mode === 'linked' ? `Linked to ${esc(S.host?.name || 'PC')}` : `Guest via ${esc(S.host?.name || 'PC')}`}</div></div></div>
    <div class="label">Status</div><div class="st-grid">${Object.entries(STATUS_LABEL).map(([k, l]) => `<button class="st-opt${st === k ? ' on' : ''}" data-st="${k}"><i style="background:var(--st-${k})"></i>${l}</button>`).join('')}</div>
    <div class="label">Status message</div><input class="field" id="stTxt" maxlength="60" placeholder="What are you up to?"></div>${actionList(items)}`, true);
  sheet.querySelector('#stTxt').value = S.me.status?.t || '';
  const saveSt = () => actNoWait('setPresence', st, sheet.querySelector('#stTxt').value.trim());
  sheet.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => { st = b.dataset.st; sheet.querySelectorAll('[data-st]').forEach((x) => x.classList.toggle('on', x === b)); saveSt(); buzz(6); }));
  sheet.querySelector('#stTxt').onchange = saveSt;
  sheet.querySelector('#avIn').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; actNoWait('setAvatar', await squareImage(f, 160)); toast('Photo updated'); };
  bindActions(items);
});
$('#connPill').addEventListener('click', () => { retry = 0; connect(); if (!S.connected) toast('Trying to reach your PC…', 'wifi'); });

// urgent alerts
const alertQ = [];
function showAlert(k, m) { alertQ.push({ k, m }); if ($('#alertOverlay').hidden) nextAlert(); }
function nextAlert() {
  const a = alertQ.shift(); if (!a) return;
  $('#alertFrom').textContent = `${a.m.fromName} · ${fmtTime(a.m.ts)}`; $('#alertText').textContent = a.m.text;
  $('#alertOverlay').hidden = false; buzz([400, 200, 400, 200, 400]);
  $('#alertAck').onclick = () => { actNoWait('ackAlert', a.k, a.m.msgId); $('#alertOverlay').hidden = true; nextAlert(); };
}

// ---------- onboarding: link (QR / PIN) or join as a new person
const normHost = (h) => { h = h.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim(); return /:\d+$/.test(h) ? h : `${h}:50600`; };
async function checkHost(h) {
  try { const ctl = new AbortController(); setTimeout(() => ctl.abort(), 4000); const r = await fetch(`http://${normHost(h)}/api/info`, { signal: ctl.signal }); const j = await r.json(); return j.app === 'nfyniq' ? null : 'That isn’t a NfyniQ Chat PC'; }
  catch { return 'Can’t reach that PC. Same Wi-Fi? Is NfyniQ Chat running on it?'; }
}
async function changePc() {
  const h = await ask('PC address', S.hostAddr, 'e.g. 192.168.1.20', 'Connect', checkHost);
  if (h) { S.hostAddr = normHost(h); store.set('host', S.hostAddr); try { ws && ws.close(); } catch {} ws = null; retry = 0; connect(); }
}
function hideVeil(el, then) { el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('out'); then && then(); }, 520); }
let obTab = 'link';
function showOnboarding(error) {
  const ob = $('#onboard'), card = $('#obCard');
  card.innerHTML = `<div class="ob-avatar" style="--h:${hue(deviceId)}">${obTab === 'link' ? ic('link') : '?'}</div>
    <h1>${obTab === 'link' ? 'Link your account' : 'Join as a new person'}</h1>
    <p>${obTab === 'link' ? 'Use NfyniQ on this phone as yourself — the same chats as your PC. On the PC open <b>Phones</b> and scan the QR code, or type the 6-digit code here.' : 'For someone without a computer. Pick your name — your chats are kept on the PC you connect through.'}</p>
    <div class="ob-tabs"><button data-t="link" class="${obTab === 'link' ? 'on' : ''}">This is my phone</button><button data-t="guest" class="${obTab === 'guest' ? 'on' : ''}">I’m new</button></div>
    ${NATIVE ? '<input class="field on-dark" id="obHost" placeholder="PC address, e.g. 192.168.1.20" inputmode="decimal" autocomplete="off" style="margin-bottom:10px">' : ''}
    ${obTab === 'link' ? '<input class="field on-dark pin" id="obPin" placeholder="••••••" inputmode="numeric" maxlength="7" autocomplete="one-time-code">' : '<input class="field on-dark" id="obName" maxlength="40" placeholder="Your name" autocapitalize="words">'}
    <div class="field-err" id="obErr">${esc(error || '')}</div>
    <button class="btn light" id="obGo">${obTab === 'link' ? 'Link' : 'Start chatting'}</button>`;
  ob.hidden = false;
  if (NATIVE && S.hostAddr) card.querySelector('#obHost').value = S.hostAddr.replace(/:50600$/, '');
  card.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { obTab = b.dataset.t; showOnboarding(); }));
  const go = card.querySelector('#obGo'), err = card.querySelector('#obErr');
  const label = obTab === 'link' ? 'Link' : 'Start chatting';
  go.onclick = async () => {
    err.textContent = '';
    if (NATIVE) {
      const h = card.querySelector('#obHost').value.trim();
      if (!h) { err.textContent = 'Enter the PC address shown in NfyniQ Chat → Phones'; return; }
      go.disabled = true; go.textContent = 'Connecting…';
      const e = await checkHost(h);
      go.disabled = false; go.textContent = label;
      if (e) { err.textContent = e; return; }
      S.hostAddr = normHost(h); store.set('host', S.hostAddr);
    }
    try { ws && ws.close(); } catch {}
    ws = null;
    if (obTab === 'link') {
      const pin = card.querySelector('#obPin').value.replace(/\D/g, '');
      if (pin.length !== 6) { err.textContent = 'Enter the 6-digit code from the PC'; return; }
      pinTry = pin; go.textContent = 'Linking…'; retry = 0; connect();
    } else {
      const n = card.querySelector('#obName').value.trim();
      if (!n) { err.textContent = 'Pick a name'; return; }
      account = { mode: 'guest', id: uuid(), name: n }; store.set('account', account);
      retry = 0; connect();
    }
  };
}
function onboardDone() { const ob = $('#onboard'); if (!ob.hidden) hideVeil(ob, () => toast(S.mode === 'linked' ? 'Phone linked — your chats are here' : 'You’re live!', 'wifi')); }

// ---------- start
renderAll();
setInterval(() => { if (Object.keys(S.typing).length) renderChatList(); }, 5000);
const startAt = performance.now();
connect();
setTimeout(() => {
  if (!account || (NATIVE && !S.hostAddr)) showOnboarding();
  hideVeil($('#splash'));
}, Math.max(0, 1750 - (performance.now() - startAt)));
})();
