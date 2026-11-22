/* NoteClass — front-end em JavaScript puro (sem frameworks). */
'use strict';

/* ============================================================ utilitários */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const mk = (tag, cls = '', html = '') => { const el = document.createElement(tag); if (cls) el.className = cls; if (html) el.innerHTML = html; return el; };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const todayStr = () => new Date().toLocaleDateString('sv-SE');           // AAAA-MM-DD no fuso local
const fmtDate = d => d.split('-').reverse().join('/');
const longDate = d => new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const safeName = t => (t || 'anotacao').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 80) || 'anotacao';

const store = {   // preferências da interface (larguras, pastas abertas, abas) ficam no navegador
  get(k, d) { try { const v = localStorage.getItem('nc:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('nc:' + k, JSON.stringify(v)); } catch { /* ignora */ } },
};

const ICONS = {
  'panel-left': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  'panel-right': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  'folder-plus': '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  vault: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (n, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const hydrateIcons = () => $$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon, +el.dataset.size || 16); });

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}

async function api(url, method = 'GET', body) {
  let r;
  try {
    r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  } catch { toast('Sem conexão com o servidor Flask. Ele está rodando?'); throw new Error('rede'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { toast(data.error || 'Algo deu errado.'); throw new Error(data.error || r.status); }
  return data;
}

async function download(url, name) {
  try {
    const r = await fetch(url);
    if (!r.ok) { const d = await r.json().catch(() => ({})); return toast(d.error || 'Falha na exportação.'); }
    const a = mk('a'); a.href = URL.createObjectURL(await r.blob()); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch { toast('Não foi possível exportar.'); }
}

function askText(label, value = '') {   // substitui o prompt() do navegador
  return new Promise(res => {
    const d = $('#ask'), inp = $('#ask-input');
    $('#ask-label').textContent = label; inp.value = value; d.returnValue = '';
    d.onclose = () => res(d.returnValue === 'ok' ? inp.value.trim() : null);
    d.showModal(); inp.select();
  });
}

/* ================================================================== estado */
const S = {
  folders: [], notes: [], tags: [],
  tabs: store.get('tabs', []), activeId: store.get('active', null),
  note: null, dirty: false, saveTimer: null,
  expanded: new Set(store.get('expanded', [])), selFolder: null,
  view: 'files', mode: store.get('mode', 'edit'),
  filters: { q: '', from: '', to: '', tags: [] },
};
const persist = () => { store.set('tabs', S.tabs); store.set('active', S.activeId); store.set('expanded', [...S.expanded]); };

/* ============================================================ markdown (preview) */
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function md(src) {
  const L = src.replace(/\r/g, '').split('\n'), cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const LIST = /^\s*([-*+]|\d+\.)\s+/;
  let out = '', i = 0, m;
  while (i < L.length) {
    const line = L[i];
    if (/^```/.test(line)) {                                       // bloco de código
      const code = []; i++;
      while (i < L.length && !/^```/.test(L[i])) code.push(L[i++]);
      i++; out += `<pre><code>${esc(code.join('\n'))}</code></pre>`; continue;
    }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { out += `<h${m[1].length} data-line="${i}">${inline(m[2])}</h${m[1].length}>`; i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out += '<hr>'; i++; continue; }
    if (/^>\s?/.test(line)) {
      const q = []; while (i < L.length && /^>\s?/.test(L[i])) q.push(L[i++].replace(/^>\s?/, ''));
      out += `<blockquote>${inline(q.join(' '))}</blockquote>`; continue;
    }
    if (LIST.test(line)) {
      const ordered = /^\s*\d+\./.test(line); let items = '';
      while (i < L.length && LIST.test(L[i])) {
        const indent = L[i].match(/^\s*/)[0].length; let t = L[i].replace(LIST, ''), cls = '', box = '';
        if ((m = /^\[( |x|X)\]\s+(.*)$/.exec(t))) { cls = ' class="task"'; box = `<input type="checkbox" disabled${m[1] !== ' ' ? ' checked' : ''}>`; t = m[2]; }
        items += `<li${cls} style="margin-left:${indent * 8}px">${box}${inline(t)}</li>`; i++;
      }
      out += ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`; continue;
    }
    if (/^\|.*\|\s*$/.test(line) && /^\|?\s*:?-{2,}/.test(L[i + 1] || '')) {   // tabela
      const head = cells(line), rows = []; i += 2;
      while (i < L.length && /^\|/.test(L[i])) rows.push(cells(L[i++]));
      out += `<div class="tw"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; continue;
    }
    if (!line.trim()) { i++; continue; }
    const p = [L[i++]];                                            // parágrafo (sempre consome ao menos 1 linha)
    while (i < L.length && L[i].trim() && !/^(#{1,6}\s|```|>|\||(-{3,}|\*{3,})\s*$)/.test(L[i]) && !LIST.test(L[i])) p.push(L[i++]);
    out += `<p>${inline(p.join('\n')).replace(/\n/g, '<br>')}</p>`;
  }
  return out;
}

function headings(src) {
  const out = []; let fence = false;
  src.split('\n').forEach((line, i) => {
    if (/^```/.test(line)) { fence = !fence; return; }
    if (fence) return;
    const m = /^(#{1,6})\s+(.+)/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/[*_`~]/g, ''), line: i });
  });
  return out;
}

/* ==================================================================== árvore */
function expandTo(folderId) {
  const seen = new Set();
  while (folderId != null && !seen.has(folderId)) {
    seen.add(folderId); S.expanded.add(folderId);
    folderId = S.folders.find(f => f.id === folderId)?.parent_id ?? null;
  }
  persist();
}

function dropTarget(el, folderId) {   // torna um elemento "soltável" (mover notas/pastas por arrastar)
  el.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', async e => {
    e.preventDefault(); e.stopPropagation(); el.classList.remove('over');
    let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    await moveItem(d, folderId);
  });
}

async function moveItem(d, folderId) {
  if (d.t === 'folder' && d.id === folderId) return;
  try {
    if (d.t === 'note') {
      await saveNow();
      await api(`/api/notes/${d.id}`, 'PUT', { folder_id: folderId });
      const row = S.notes.find(n => n.id === d.id); if (row) row.folder_id = folderId;
      if (S.note?.id === d.id) { S.note.folder_id = folderId; folderOptions(folderId); }
    } else {
      await api(`/api/folders/${d.id}`, 'PUT', { parent_id: folderId });
      const f = S.folders.find(x => x.id === d.id); if (f) f.parent_id = folderId;
    }
    if (folderId != null) expandTo(folderId);
    renderTree(); if (S.note) folderOptions(S.note.folder_id);
  } catch { /* api já mostrou o aviso */ }
}

function renderTree() {
  const el = $('#tree'); el.innerHTML = '';
  const subs = {}, inside = {};
  S.folders.forEach(f => (subs[f.parent_id ?? 'root'] ||= []).push(f));
  S.notes.forEach(n => (inside[n.folder_id ?? 'root'] ||= []).push(n));

  const build = (key, depth) => {
    const frag = document.createDocumentFragment();
    (subs[key] || []).forEach(f => {
      const open = S.expanded.has(f.id);
      const row = mk('div', 'row folder' + (S.selFolder === f.id ? ' sel' : ''),
        `<span class="chev ${open ? 'open' : ''}">${icon('chev', 12)}</span><span class="ico">${icon('folder', 15)}</span><span class="name">${esc(f.name)}</span>`);
      row.style.setProperty('--d', depth); row.draggable = true;
      row.onclick = e => { e.stopPropagation(); S.selFolder = f.id; open ? S.expanded.delete(f.id) : S.expanded.add(f.id); persist(); renderTree(); };
      row.oncontextmenu = e => {
        e.preventDefault(); e.stopPropagation(); S.selFolder = f.id; renderTree(); showMenu(e.clientX, e.clientY, [
          { label: 'Nova anotação aqui', fn: () => createNote(f.id) },
          { label: 'Nova subpasta', fn: () => newFolder(f.id) },
          { label: 'Renomear', fn: () => renameFolder(f.id) }, '-',
          { label: 'Excluir pasta', danger: true, fn: () => deleteFolder(f.id) }]);
      };
      row.ondragstart = e => { e.stopPropagation(); e.dataTransfer.setData('text/plain', JSON.stringify({ t: 'folder', id: f.id })); };
      dropTarget(row, f.id);
      frag.append(row);
      if (open) frag.append(build(f.id, depth + 1));
    });
    (inside[key] || []).forEach(n => {
      const row = mk('div', 'row note' + (S.note?.id === n.id ? ' active' : ''),
        `<span class="chev"></span><span class="ico">${icon('file', 15)}</span><span class="name">${esc(n.title || 'Sem título')}</span>`);
      row.style.setProperty('--d', depth); row.draggable = true;
      row.onclick = e => { e.stopPropagation(); openNote(n.id); };
      row.oncontextmenu = e => {
        e.preventDefault(); e.stopPropagation(); showMenu(e.clientX, e.clientY, [
          { label: 'Abrir', fn: () => openNote(n.id) },
          { label: 'Exportar como Markdown', fn: () => exportNote(n.id, 'md') },
          { label: 'Exportar como PDF', fn: () => exportNote(n.id, 'pdf') }, '-',
          { label: 'Excluir anotação', danger: true, fn: () => deleteNote(n.id) }]);
      };
      row.ondragstart = e => { e.stopPropagation(); e.dataTransfer.setData('text/plain', JSON.stringify({ t: 'note', id: n.id })); };
      frag.append(row);
    });
    return frag;
  };
  el.append(build('root', 0));
  if (!S.folders.length && !S.notes.length) el.append(mk('p', 'hint', 'Sem arquivos por enquanto…'));
}

async function refreshTree() {
  const d = await api('/api/tree');
  S.folders = d.folders; S.notes = d.notes;
  if (S.selFolder != null && !S.folders.some(f => f.id === S.selFolder)) S.selFolder = null;
  renderTree(); if (S.view === 'dates') renderDateView();
}

async function refreshTags() {
  try { S.tags = await api('/api/tags'); } catch { return; }
  $('#tag-list').innerHTML = S.tags.map(t => `<option value="${esc(t.name)}"></option>`).join('');
  if (S.view === 'tags') renderTagView();
}

/* ====================================================== pastas e anotações (ações) */
async function newFolder(parentId = null) {
  const name = await askText(parentId ? 'Nome da subpasta' : 'Nome da pasta (ex.: disciplina)');
  if (!name) return;
  try {
    const f = await api('/api/folders', 'POST', { name, parent_id: parentId });
    if (parentId != null) expandTo(parentId);
    S.selFolder = f.id; await refreshTree(); if (S.note) folderOptions(S.note.folder_id);
  } catch { /* aviso já exibido */ }
}

async function renameFolder(id) {
  const f = S.folders.find(x => x.id === id);
  const name = await askText('Renomear pasta', f?.name || '');
  if (!name) return;
  try { await api(`/api/folders/${id}`, 'PUT', { name }); await refreshTree(); if (S.note) folderOptions(S.note.folder_id); } catch { /* */ }
}

async function deleteFolder(id) {
  const f = S.folders.find(x => x.id === id);
  if (!confirm(`Excluir a pasta "${f?.name}" com TODAS as subpastas e anotações dentro dela? Não dá para desfazer.`)) return;
  try {
    await saveNow(); await api(`/api/folders/${id}`, 'DELETE');
    await refreshTree(); await refreshTags(); await reconcileTabs();
    if (S.note) folderOptions(S.note.folder_id);
  } catch { /* */ }
}

async function createNote(folderId) {
  if (folderId === undefined) folderId = S.selFolder ?? S.note?.folder_id ?? null;
  try {
    await saveNow();
    const n = await api('/api/notes', 'POST', { title: 'Sem título', content: '', folder_id: folderId, note_date: todayStr() });
    S.notes.push({ id: n.id, folder_id: n.folder_id, title: n.title, note_date: n.note_date });
    S.note = n; S.activeId = n.id; S.tabs.push(n.id); expandTo(folderId);
    fillNote(); renderTabs(); renderTree();
    const t = $('#title'); t.focus(); t.select();
  } catch { /* */ }
}

async function openNote(id) {
  if (S.note?.id === id) return;
  await saveNow();
  try {
    const note = await api(`/api/notes/${id}`);
    S.note = note; S.activeId = id; if (!S.tabs.includes(id)) S.tabs.push(id);
    expandTo(note.folder_id); fillNote(); renderTabs(); renderTree();
  } catch { S.tabs = S.tabs.filter(t => t !== id); persist(); renderTabs(); }
}

async function closeTab(id) {
  if (S.note?.id === id) await saveNow();
  const idx = S.tabs.indexOf(id); S.tabs.splice(idx, 1);
  if (S.activeId === id) {
    const next = S.tabs[idx] ?? S.tabs[idx - 1] ?? null;
    S.note = null; S.activeId = null;
    if (next != null) await openNote(next); else showEmpty();
  }
  persist(); renderTabs(); renderTree();
}

async function deleteNote(id) {
  const n = S.notes.find(x => x.id === id);
  if (!confirm(`Excluir a anotação "${n?.title}"? Não dá para desfazer.`)) return;
  try {
    if (S.note?.id === id) { clearTimeout(S.saveTimer); S.dirty = false; }
    await api(`/api/notes/${id}`, 'DELETE');
    S.notes = S.notes.filter(x => x.id !== id);
    if (S.tabs.includes(id)) await closeTab(id); else renderTree();
    refreshTags(); if (S.view === 'dates') renderDateView();
  } catch { /* */ }
}

async function reconcileTabs() {   // tira abas de notas que não existem mais e abre uma válida
  S.tabs = S.tabs.filter(id => S.notes.some(n => n.id === id));
  if (S.note && !S.tabs.includes(S.note.id)) { S.note = null; S.activeId = null; S.dirty = false; }
  if (!S.note) {
    const next = S.tabs.includes(S.activeId) ? S.activeId : S.tabs[0];
    if (next != null) await openNote(next); else showEmpty();
  }
  persist(); renderTabs(); renderTree();
}

async function exportNote(id, fmt) {
  if (S.note?.id === id) await saveNow();
  const n = S.notes.find(x => x.id === id);
  await download(`/api/notes/${id}/export?format=${fmt}`, `${safeName(n?.title)}.${fmt}`);
}

/* ======================================================================= abas */
function renderTabs() {
  const el = $('#tabs'); el.innerHTML = '';
  if (!S.tabs.length) el.append(mk('div', 'tab active', '<span>Nova aba</span>'));
  S.tabs.forEach(id => {
    const n = S.notes.find(x => x.id === id); if (!n) return;
    const t = mk('div', 'tab' + (id === S.activeId ? ' active' : ''), `<span>${esc(n.title || 'Sem título')}</span><button class="x" title="Fechar aba">${icon('x', 12)}</button>`);
    t.setAttribute('role', 'tab');
    t.onclick = () => openNote(id);
    t.onauxclick = e => { if (e.button === 1) closeTab(id); };
    $('.x', t).onclick = e => { e.stopPropagation(); closeTab(id); };
    el.append(t);
  });
  const add = mk('button', 'icon-btn tab-add', icon('plus', 15)); add.title = 'Nova anotação';
  add.onclick = () => createNote(); el.append(add);
  persist();
}

/* ==================================================================== editor */
const editor = $('#editor');

function showEmpty() {
  $('#empty').hidden = false; $('#note').hidden = true;
  S.note = null; renderOutline(); renderStats(); renderTabs(); setStatus('—');
}

function folderOptions(sel) {
  const opts = ['<option value="">Sem pasta</option>'];
  const walk = (pid, d) => S.folders.filter(f => (f.parent_id ?? null) === pid).forEach(f => {
    opts.push(`<option value="${f.id}">${'\u00a0\u00a0'.repeat(d)}${esc(f.name)}</option>`); walk(f.id, d + 1);
  });
  walk(null, 0);
  const s = $('#note-folder'); s.innerHTML = opts.join(''); s.value = sel ?? '';
}

function fillNote() {
  const n = S.note; S.dirty = false;
  $('#empty').hidden = true; $('#note').hidden = false;
  $('#title').value = n.title; $('#note-date').value = n.note_date; editor.value = n.content;
  folderOptions(n.folder_id); renderNoteTags(); setMode(S.mode); afterEdit(); setStatus('Salvo');
  persist();
}

function renderNoteTags() {
  const box = $('#tags-box'), input = $('#tag-input');
  $$('.chip', box).forEach(c => c.remove());
  S.note.tags.forEach(t => {
    const c = mk('span', 'chip', `#${esc(t)} <button class="x" title="Remover tag">×</button>`);
    c.title = 'Clique para buscar por esta tag';
    c.onclick = () => addFilterTag(t);
    $('.x', c).onclick = e => { e.stopPropagation(); S.note.tags = S.note.tags.filter(x => x !== t); renderNoteTags(); markDirty(); };
    box.insertBefore(c, input);
  });
}

function addNoteTag(raw) {
  const t = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().replace(/^#/, '').trim().toLowerCase().slice(0, 50);
  if (t && !S.note.tags.includes(t)) { S.note.tags.push(t); renderNoteTags(); markDirty(); }
  $('#tag-input').value = '';
}

function setMode(m) {
  S.mode = m; store.set('mode', m);
  $('#panes').className = 'mode-' + m;
  $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  if (m !== 'edit' && S.note) renderPreview();
}

const renderPreview = () => { if (S.note && S.mode !== 'edit') $('#preview').innerHTML = md(S.note.content); };

function renderOutline() {
  const box = $('#outline'), q = $('#outline-q').value.trim().toLowerCase();
  box.innerHTML = '';
  if (!S.note) return void box.append(mk('p', 'hint', 'Abra uma anotação para ver os tópicos.'));
  const hs = headings(S.note.content);
  if (!hs.length) return void box.append(mk('p', 'hint', 'Use # e ## no texto para criar tópicos.'));
  const min = Math.min(...hs.map(h => h.level));
  hs.filter(h => h.text.toLowerCase().includes(q)).forEach(h => {
    const b = mk('button'); b.style.setProperty('--l', h.level - min); b.textContent = h.text; b.title = h.text;
    b.onclick = () => goToLine(h.line); box.append(b);
  });
}

function goToLine(line) {
  if (S.mode !== 'read') {
    const pos = editor.value.split('\n').slice(0, line).join('\n').length + (line ? 1 : 0);
    editor.focus(); editor.setSelectionRange(pos, pos);
    editor.scrollTop = Math.max(0, (pos / Math.max(1, editor.value.length)) * editor.scrollHeight - 80);
  }
  if (S.mode !== 'edit') $(`#preview [data-line="${line}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderStats() {
  const t = S.note?.content || '';
  $('#st-words').textContent = (t.trim().match(/\S+/g) || []).length;
  $('#st-chars').textContent = t.length;
  $('#st-links').textContent = (t.match(/\[[^\]]*\]\([^)]*\)|(?<!\()https?:\/\/[^\s)]+/g) || []).length;
}

function afterEdit() { renderPreview(); renderOutline(); renderStats(); }

/* ---------- autosave ---------- */
function setStatus(txt, err = false) { const s = $('#save-status'); s.textContent = txt; s.classList.toggle('err', err); }
const payload = n => ({ title: n.title, content: n.content, note_date: n.note_date, folder_id: n.folder_id, tags: n.tags });

function markDirty() {
  if (!S.note) return;
  S.dirty = true; setStatus('Salvando…');
  clearTimeout(S.saveTimer); S.saveTimer = setTimeout(saveNow, 700);
}

async function saveNow() {
  clearTimeout(S.saveTimer);
  if (!S.dirty || !S.note) return;
  const n = S.note; S.dirty = false;
  try {
    await api(`/api/notes/${n.id}`, 'PUT', payload(n));
    const row = S.notes.find(x => x.id === n.id);
    if (row) Object.assign(row, { title: n.title || 'Sem título', note_date: n.note_date, folder_id: n.folder_id });
    renderTree(); renderTabs(); refreshTags(); if (S.view === 'dates') renderDateView();
    if (S.note === n) setStatus('Salvo');
  } catch { S.dirty = true; setStatus('Erro ao salvar', true); }
}

/* ================================================================ painel esquerdo */
function setView(v, toggle = false) {
  if (toggle && S.view === v && !store.get('leftC', false)) return setCollapsed('left', true);
  S.view = v; setCollapsed('left', false);
  $$('#ribbon [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach(s => { s.hidden = s.id !== 'view-' + v; });
  if (v === 'tags') renderTagView();
  if (v === 'dates') renderDateView();
  if (v === 'search') { $('#f-q').focus(); runSearch(); }
}

function renderTagView() {
  const box = $('#tag-view');
  box.innerHTML = S.tags.length ? '' : '<p class="hint">Nenhuma tag ainda. Adicione tags dentro de uma anotação.</p>';
  S.tags.forEach(t => {
    const b = mk('button', 'tagrow', `<span>#${esc(t.name)}</span><span class="count">${t.count}</span>`);
    b.onclick = () => addFilterTag(t.name); box.append(b);
  });
}

function renderDateView() {
  const box = $('#date-view'); box.innerHTML = '';
  if (!S.notes.length) return void box.append(mk('p', 'hint', 'Suas anotações aparecem aqui, agrupadas pela data da aula.'));
  const groups = {};
  [...S.notes].sort((a, b) => b.note_date.localeCompare(a.note_date)).forEach(n => (groups[n.note_date] ||= []).push(n));
  Object.entries(groups).forEach(([d, list]) => {
    box.append(mk('div', 'dategroup', esc(longDate(d))));
    list.forEach(n => {
      const r = mk('div', 'row note' + (S.note?.id === n.id ? ' active' : ''), `<span class="ico">${icon('file', 15)}</span><span class="name">${esc(n.title)}</span>`);
      r.onclick = () => openNote(n.id); box.append(r);
    });
  });
}

/* ---------- busca ---------- */
let searchSeq = 0, searchTimer;
const hasFilters = () => { const f = S.filters; return !!(f.q || f.from || f.to || f.tags.length); };

function renderFilterChips() {
  const box = $('#f-chips'); box.innerHTML = '';
  S.filters.tags.forEach(t => {
    const c = mk('span', 'chip', `#${esc(t)} <button class="x" title="Remover filtro">×</button>`);
    $('.x', c).onclick = () => { S.filters.tags = S.filters.tags.filter(x => x !== t); renderFilterChips(); runSearch(); };
    box.append(c);
  });
}

function addFilterTag(t) {
  if (!S.filters.tags.includes(t)) S.filters.tags.push(t);
  setView('search'); renderFilterChips(); runSearch();
}

async function runSearch() {
  const f = S.filters, box = $('#results');
  if (!hasFilters()) return void (box.innerHTML = '<p class="hint">Digite um termo, escolha um período ou filtre por tag.</p>');
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q); if (f.from) p.set('from', f.from); if (f.to) p.set('to', f.to);
  if (f.tags.length) p.set('tags', f.tags.join(','));
  const seq = ++searchSeq;
  let data; try { data = await api('/api/search?' + p); } catch { return; }
  if (seq !== searchSeq) return;                                   // resposta antiga: descarta
  if (!data.results.length) return void (box.innerHTML = '<p class="hint">Nada encontrado com esses filtros.</p>');
  const terms = f.q.split(/\s+/).filter(Boolean).map(t => reEsc(esc(t)));
  const hl = s => terms.length ? s.replace(new RegExp('(' + terms.join('|') + ')', 'gi'), '<mark>$1</mark>') : s;
  box.innerHTML = '';
  data.results.forEach(r => {
    const el = mk('div', 'res',
      `<div class="res-t">${hl(esc(r.title))}</div>` + (r.snippet ? `<div class="res-s">${hl(esc(r.snippet))}</div>` : '') +
      `<div class="res-m"><span>${fmtDate(r.note_date)}</span>${r.folder_name ? `<span>${esc(r.folder_name)}</span>` : ''}${r.tags.map(t => `<span>#${esc(t)}</span>`).join('')}</div>`);
    el.onclick = () => openNote(r.id); box.append(el);
  });
}

/* ============================================================ menu de contexto */
function showMenu(x, y, items) {
  const m = $('#ctx'); m.innerHTML = '';
  items.forEach(it => {
    if (it === '-') return m.append(mk('hr'));
    const b = mk('button', it.danger ? 'danger' : ''); b.textContent = it.label;
    b.onclick = () => { hideMenu(); it.fn(); }; m.append(b);
  });
  m.hidden = false;
  m.style.left = Math.max(4, Math.min(x, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = Math.max(4, Math.min(y, innerHeight - m.offsetHeight - 8)) + 'px';
}
const hideMenu = () => { $('#ctx').hidden = true; };

/* ============================================================ painéis (layout) */
function setCollapsed(side, c) {
  $('#' + side).classList.toggle('collapsed', c);
  $('#rz-' + side).classList.toggle('off', c);
  store.set(side + 'C', c);
}

function dragResize(side) {
  const rz = $('#rz-' + side), min = 180, max = side === 'left' ? 520 : 480, def = side === 'left' ? 270 : 260;
  const setW = w => { document.documentElement.style.setProperty(`--${side}-w`, w + 'px'); store.set(side + 'W', w); };
  rz.addEventListener('mousedown', e => {
    e.preventDefault(); document.body.classList.add('resizing'); let raw = Infinity;
    const move = ev => {
      raw = side === 'left' ? ev.clientX - $('#ribbon').getBoundingClientRect().right : $('#workspace').getBoundingClientRect().right - ev.clientX;
      setW(Math.min(max, Math.max(min, raw)));
    };
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.body.classList.remove('resizing');
      if (raw < 110) setCollapsed(side, true);                      // arrastar até o fim recolhe o painel
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
  rz.addEventListener('dblclick', () => setW(def));
}

function applyLayout() {
  const r = document.documentElement.style;
  r.setProperty('--left-w', store.get('leftW', 270) + 'px');
  r.setProperty('--right-w', store.get('rightW', 260) + 'px');
  ['left', 'right'].forEach(s => { if (store.get(s + 'C', false)) setCollapsed(s, true); });
}

function bind() {
  // painéis
  $('#toggle-left').onclick = () => setCollapsed('left', !store.get('leftC', false));
  $('#toggle-right').onclick = () => setCollapsed('right', !store.get('rightC', false));
  dragResize('left'); dragResize('right');
  $$('#ribbon [data-view]').forEach(b => { b.onclick = () => setView(b.dataset.view, true); });

  $('#btn-new-note').onclick = () => createNote();
  $('#btn-new-folder').onclick = () => newFolder(S.selFolder);
  $('#empty-note').onclick = () => createNote(null);
  $('#empty-folder').onclick = () => newFolder(null);
  const tree = $('#tree');
  tree.onclick = e => { if (e.target === tree) { S.selFolder = null; renderTree(); } };
  tree.oncontextmenu = e => {
    e.preventDefault(); showMenu(e.clientX, e.clientY, [
      { label: 'Nova anotação', fn: () => createNote(null) }, { label: 'Nova pasta', fn: () => newFolder(null) }]);
  };
  dropTarget(tree, null);

  $('#title').oninput = e => {
    if (!S.note) return; S.note.title = e.target.value;
    const row = S.notes.find(n => n.id === S.note.id); if (row) row.title = e.target.value || 'Sem título';
    renderTabs(); markDirty();
  };
  $('#note-date').onchange = e => { S.note.note_date = e.target.value || todayStr(); markDirty(); };
  $('#note-folder').onchange = e => { S.note.folder_id = e.target.value ? +e.target.value : null; if (S.note.folder_id) expandTo(S.note.folder_id); markDirty(); };
  const ti = $('#tag-input');
  ti.onkeydown = e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addNoteTag(ti.value); }
    else if (e.key === 'Backspace' && !ti.value && S.note.tags.length) { S.note.tags.pop(); renderNoteTags(); markDirty(); }
  };
  ti.onblur = () => { if (ti.value.trim()) addNoteTag(ti.value); };

  editor.oninput = () => { S.note.content = editor.value; markDirty(); afterEdit(); };
  editor.onkeydown = e => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 'b' || k === 'i')) {
      e.preventDefault(); const mark = k === 'b' ? '**' : '*';
      const s = editor.selectionStart, t = editor.selectionEnd, sel = editor.value.slice(s, t);
      document.execCommand('insertText', false, mark + sel + mark);
      editor.setSelectionRange(s + mark.length, s + mark.length + sel.length);
    }
  };
  $$('#modes button').forEach(b => { b.onclick = () => setMode(b.dataset.mode); });
  $('#note-menu').onclick = e => {
    e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(), id = S.note.id;
    showMenu(r.right - 200, r.bottom + 4, [
      { label: 'Exportar como Markdown (.md)', fn: () => exportNote(id, 'md') },
      { label: 'Exportar como PDF', fn: () => exportNote(id, 'pdf') }, '-',
      { label: 'Excluir anotação', danger: true, fn: () => deleteNote(id) }]);
  };
  $('#outline-q').oninput = renderOutline;

  const trigger = () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 250); };
  $('#f-q').oninput = e => { S.filters.q = e.target.value.trim(); trigger(); };
  $('#f-from').onchange = e => { S.filters.from = e.target.value; runSearch(); };
  $('#f-to').onchange = e => { S.filters.to = e.target.value; runSearch(); };
  $('#f-tag').onkeydown = e => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const t = e.target.value.trim().replace(/^#/, '').toLowerCase();
    if (t && !S.filters.tags.includes(t)) S.filters.tags.push(t);
    e.target.value = ''; renderFilterChips(); runSearch();
  };
  $('#f-clear').onclick = () => {
    S.filters = { q: '', from: '', to: '', tags: [] };
    ['#f-q', '#f-from', '#f-to', '#f-tag'].forEach(s => { $(s).value = ''; }); renderFilterChips(); runSearch();
  };

  $('#btn-settings').onclick = () => $('#settings').showModal();
  $('#export-all').onclick = () => download('/api/export/all', 'noteclass-backup.zip');
  $$('dialog [data-close]').forEach(b => { b.onclick = () => b.closest('dialog').close(); });


  document.addEventListener('click', hideMenu);
  document.addEventListener('contextmenu', hideMenu);
  addEventListener('resize', hideMenu);
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'escape') hideMenu();
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); saveNow(); }
    if (e.altKey && k === 'n') { e.preventDefault(); createNote(); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && k === 'f') { e.preventDefault(); setView('search'); }
  });
  addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('pagehide', () => {                         
    if (S.dirty && S.note) fetch(`/api/notes/${S.note.id}`, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(S.note)) });
  });
}

async function init() {
  hydrateIcons(); applyLayout(); bind();
  $('#view-files').hidden = false;
  try { await Promise.all([refreshTree(), refreshTags()]); }
  catch { showEmpty(); return; }                                
  await reconcileTabs();
  renderOutline();
}
init();
