(() => {
'use strict';

/* ======================= Utilidades ======================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const fmt = s => { if (!s) return ''; const [d, t] = s.split(' '); const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y} ${t.slice(0, 5)}`; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const ICONS = {
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'folder': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  'folder-plus': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6M9 13h6"/>',
  'tag': '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42Z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  'calendar': '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  'square-pen': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  'settings': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  'panel-left': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  'panel-right': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
  'list': '<path d="M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13"/>',
  'chevron': '<path d="m9 18 6-6-6-6"/>',
  'x': '<path d="M18 6 6 18M6 6l12 12"/>',
  'file': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'pencil': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  'pen': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'box': '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  'plus': '<path d="M5 12h14M12 5v14"/>',
  'more': '<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
};
const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;
const icons = (root = document) => $$('[data-ic]', root).forEach(e => { e.innerHTML = svg(e.dataset.ic); });

/* ======================= Estado ======================= */
const S = {
  folders: [], notes: [], tags: [],
  tabs: [{ id: null }], active: 0, shown: undefined,
  cache: {},                                     // id -> anotação completa
  expanded: new Set(ls('nc_expanded', [])),
  view: 'files', mode: ls('nc_mode', 'edit'),
  dirty: false, saveTimer: null, drag: null,
  settings: { vault: 'Cofre 1', fontSize: 15, mono: false, startPreview: false, ...ls('nc_settings', {}) },
};
const curId = () => S.tabs[S.active]?.id ?? null;
const curNote = () => S.cache[curId()] || null;

async function api(url, method = 'GET', data) {
  const r = await fetch(url, { method, headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    toast(e.error || `Erro ${r.status}`);
    throw new Error(e.error || r.status);
  }
  return r.json();
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); }

/* ======================= Diálogo e menu de contexto ======================= */
function ask({ title, label, value = '', ok = 'Confirmar', danger = false, message }) {
  return new Promise(resolve => {
    const d = $('#dlg'), hasInput = label !== undefined;
    d.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ''}
      ${hasInput ? `<input value="${esc(value)}" placeholder="${esc(label)}" autocomplete="off">` : ''}
      <div class="dlg-actions"><button class="btn ${danger ? 'danger' : 'primary'}" value="ok">${esc(ok)}</button><button class="btn" value="cancel">Cancelar</button></div></form>`;
    d.returnValue = '';
    d.onclose = () => resolve(d.returnValue === 'ok' ? (hasInput ? d.querySelector('input').value.trim() : true) : null);
    d.showModal();
    const i = d.querySelector('input'); if (i) { i.focus(); i.select(); }
  });
}
function showMenu(x, y, items) {
  const m = $('#ctx');
  m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${esc(it.label)}</button>`).join('');
  m.hidden = false;
  m.style.left = Math.max(4, Math.min(x, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = Math.max(4, Math.min(y, innerHeight - m.offsetHeight - 8)) + 'px';
  m.onclick = e => { const b = e.target.closest('button'); if (!b) return; hideMenu(); items[b.dataset.i].fn(); };
}
const hideMenu = () => { $('#ctx').hidden = true; };
document.addEventListener('mousedown', e => { if (!e.target.closest('#ctx')) hideMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideMenu(); });

/* ======================= Dados: árvore e tags ======================= */
async function loadTree() {
  const t = await api('/api/tree');
  S.folders = t.folders; S.notes = t.notes;
  renderTree();
}
async function refreshTags() {
  S.tags = await api('/api/tags');
  $('#taglist').innerHTML = S.tags.map(t => `<option value="${esc(t.name)}">`).join('');
  const sel = $('#s-tag'), v = sel.value;
  sel.innerHTML = '<option value="">Todas as tags</option>' + S.tags.map(t => `<option value="${esc(t.name)}">#${esc(t.name)} (${t.count})</option>`).join('');
  sel.value = S.tags.some(t => t.name === v) ? v : '';
  if (S.view === 'tags') renderTagList();
}
const folderPath = id => { const p = []; let f; while (id && (f = S.folders.find(x => x.id === id))) { p.unshift(f.name); id = f.parent_id; } return p.join(' / '); };

/* ======================= Árvore de arquivos ======================= */
function renderTree() {
  const folders = {}, notes = {}, cur = curId();
  S.folders.forEach(f => (folders[f.parent_id || 0] ||= []).push(f));
  S.notes.forEach(n => (notes[n.folder_id || 0] ||= []).push(n));
  const byName = (a, b) => (a.name ?? a.title).localeCompare(b.name ?? b.title, 'pt-BR', { sensitivity: 'base' });
  const rec = (pid, d) => {
    let out = '';
    (folders[pid] || []).sort(byName).forEach(f => {
      const open = S.expanded.has(f.id);
      out += `<div class="row folder${open ? ' open' : ''}" draggable="true" data-type="folder" data-id="${f.id}" style="--d:${d}"><i class="chev" data-ic="chevron"></i><i data-ic="folder"></i><span>${esc(f.name)}</span></div>`;
      if (open) out += rec(f.id, d + 1);
    });
    (notes[pid] || []).sort(byName).forEach(n => {
      out += `<div class="row note${n.id === cur ? ' active' : ''}" draggable="true" data-type="note" data-id="${n.id}" style="--d:${d}"><i data-ic="file"></i><span>${esc(n.title || 'Sem título')}</span></div>`;
    });
    return out;
  };
  const t = $('#tree');
  t.innerHTML = rec(0, 0) || '<div class="empty-hint">Sem arquivos por enquanto...</div>';
  icons(t);
}
function toggleFolder(id, force) {
  const open = force ?? !S.expanded.has(id);
  open ? S.expanded.add(id) : S.expanded.delete(id);
  lsSet('nc_expanded', [...S.expanded]);
  renderTree();
}
function expandParents(folderId) {
  let f; while (folderId && (f = S.folders.find(x => x.id === folderId))) { S.expanded.add(f.id); folderId = f.parent_id; }
  lsSet('nc_expanded', [...S.expanded]);
}

const treeEl = $('#tree');
treeEl.addEventListener('click', e => {
  const r = e.target.closest('.row'); if (!r) return;
  const id = +r.dataset.id;
  r.dataset.type === 'folder' ? toggleFolder(id) : openNote(id);
});
treeEl.addEventListener('contextmenu', e => {
  e.preventDefault();
  const r = e.target.closest('.row'), id = r ? +r.dataset.id : null;
  if (r?.dataset.type === 'folder') showMenu(e.clientX, e.clientY, [
    { label: 'Nova anotação aqui', fn: () => newNote(id) },
    { label: 'Nova subpasta', fn: () => newFolder(id) },
    '-', { label: 'Renomear', fn: () => renameFolder(id) },
    { label: 'Excluir pasta', danger: true, fn: () => deleteFolder(id) }]);
  else if (r) showMenu(e.clientX, e.clientY, [
    { label: 'Abrir', fn: () => openNote(id) },
    { label: 'Exportar como PDF', fn: () => exportNote(id, 'pdf') },
    { label: 'Exportar como Markdown', fn: () => exportNote(id, 'md') },
    '-', { label: 'Excluir anotação', danger: true, fn: () => deleteNote(id) }]);
  else showMenu(e.clientX, e.clientY, [
    { label: 'Nova anotação', fn: () => newNote(null) },
    { label: 'Nova pasta', fn: () => newFolder(null) }]);
});

/* Arrastar e soltar (mover notas/pastas) */
treeEl.addEventListener('dragstart', e => {
  const r = e.target.closest('.row'); if (!r) return;
  S.drag = { type: r.dataset.type, id: +r.dataset.id };
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `${S.drag.type}:${S.drag.id}`);
});
const clearDrop = () => { $$('.row.drop').forEach(r => r.classList.remove('drop')); treeEl.classList.remove('drop-root'); };
treeEl.addEventListener('dragover', e => {
  if (!S.drag) return;
  e.preventDefault(); clearDrop();
  const r = e.target.closest('.row');
  if (r?.dataset.type === 'folder') r.classList.add('drop'); else if (!r) treeEl.classList.add('drop-root');
});
treeEl.addEventListener('dragleave', e => { if (!treeEl.contains(e.relatedTarget)) clearDrop(); });
treeEl.addEventListener('dragend', () => { S.drag = null; clearDrop(); });
treeEl.addEventListener('drop', async e => {
  e.preventDefault(); clearDrop();
  const drag = S.drag; S.drag = null; if (!drag) return;
  const r = e.target.closest('.row'); let target = null;
  if (r?.dataset.type === 'folder') target = +r.dataset.id;
  else if (r) target = S.notes.find(n => n.id === +r.dataset.id)?.folder_id ?? null;
  try {
    if (drag.type === 'note') {
      await api(`/api/notes/${drag.id}`, 'PATCH', { folder_id: target });
      if (S.cache[drag.id]) S.cache[drag.id].folder_id = target;
    } else await api(`/api/folders/${drag.id}`, 'PATCH', { parent_id: target });
    if (target) expandParents(target);
    await loadTree(); renderCrumb();
  } catch { /* erro já exibido pelo toast */ }
});

/* Ações de pasta / nota */
async function newFolder(parentId = null) {
  const name = await ask({ title: 'Nova pasta', label: 'Nome da pasta (ex.: Cálculo II)', ok: 'Criar' });
  if (!name) return;
  const f = await api('/api/folders', 'POST', { name, parent_id: parentId });
  S.folders.push(f); if (parentId) expandParents(parentId);
  setView('files'); renderTree();
}
async function renameFolder(id) {
  const f = S.folders.find(x => x.id === id);
  const name = await ask({ title: 'Renomear pasta', label: 'Novo nome', value: f.name, ok: 'Renomear' });
  if (!name) return;
  await api(`/api/folders/${id}`, 'PATCH', { name });
  await loadTree(); renderCrumb();
}
async function deleteFolder(id) {
  const f = S.folders.find(x => x.id === id);
  if (!await ask({ title: 'Excluir pasta', message: `Excluir "${f.name}" com todas as subpastas e anotações dentro dela? Não dá para desfazer.`, ok: 'Excluir', danger: true })) return;
  const before = S.notes.map(n => n.id);
  await api(`/api/folders/${id}`, 'DELETE');
  await loadTree();
  await dropNotes(before.filter(i => !S.notes.some(n => n.id === i)));
  refreshTags();
}
async function newNote(folderId = null) {
  await flush();
  const n = await api('/api/notes', 'POST', { title: 'Sem título', folder_id: folderId });
  S.cache[n.id] = n; S.notes.push({ id: n.id, title: n.title, folder_id: n.folder_id, created_at: n.created_at, updated_at: n.updated_at });
  if (folderId) expandParents(folderId);
  setView('files');
  await openNote(n.id, true);
  const t = $('#title'); t.focus(); t.select();
}
async function deleteNote(id) {
  const n = S.notes.find(x => x.id === id);
  if (!await ask({ title: 'Excluir anotação', message: `Excluir "${n?.title}"? Não dá para desfazer.`, ok: 'Excluir', danger: true })) return;
  if (id === curId()) { clearTimeout(S.saveTimer); S.dirty = false; }
  await api(`/api/notes/${id}`, 'DELETE');
  S.notes = S.notes.filter(x => x.id !== id);
  await dropNotes([id]); refreshTags();
}
async function dropNotes(ids) {
  if (!ids.length) return;
  const keep = curId();
  ids.forEach(i => delete S.cache[i]);
  S.notes = S.notes.filter(n => !ids.includes(n.id));
  S.tabs = S.tabs.filter(t => !ids.includes(t.id));
  if (!S.tabs.length) S.tabs.push({ id: null });
  const i = keep === null ? -1 : S.tabs.findIndex(t => t.id === keep);
  S.active = i >= 0 ? i : Math.min(S.active, S.tabs.length - 1);
  await ensureLoaded(curId()); persistTabs(); refresh(true);
}
const exportNote = (id, format) => { location.href = `/api/notes/${id}/export?format=${format}`; };

/* ======================= Abas ======================= */
function persistTabs() { lsSet('nc_tabs', { ids: S.tabs.map(t => t.id), active: S.active }); }
function renderTabs() {
  $('#tabs').innerHTML = S.tabs.map((t, i) => {
    const n = t.id ? S.notes.find(x => x.id === t.id) : null;
    const title = t.id ? (n?.title || 'Sem título') : 'Nova aba';
    return `<div class="tab${i === S.active ? ' active' : ''}" data-i="${i}" title="${esc(title)}"><span>${esc(title)}</span><button class="x" data-close="${i}" title="Fechar aba"><i data-ic="x"></i></button></div>`;
  }).join('');
  icons($('#tabs'));
}
async function ensureLoaded(id) {
  if (!id || S.cache[id]) return;
  try { S.cache[id] = await api(`/api/notes/${id}`); }
  catch { S.tabs = S.tabs.filter(t => t.id !== id); if (!S.tabs.length) S.tabs.push({ id: null }); S.active = Math.min(S.active, S.tabs.length - 1); }
}
async function openNote(id, fresh = false) {
  await flush();
  let i = S.tabs.findIndex(t => t.id === id);
  if (i < 0) {
    if (S.tabs[S.active]?.id === null) { i = S.active; S.tabs[i].id = id; }
    else { S.tabs.push({ id }); i = S.tabs.length - 1; }
  }
  S.active = i;
  await ensureLoaded(id);
  if (fresh) S.mode = 'edit'; else if (S.shown !== id && S.settings.startPreview) S.mode = 'preview';
  persistTabs(); refresh();
}
async function switchTab(i) {
  if (i === S.active) return;
  await flush(); S.active = i;
  await ensureLoaded(curId()); persistTabs(); refresh();
}
async function closeTab(i) {
  if (i === S.active) await flush();
  S.tabs.splice(i, 1);
  if (!S.tabs.length) S.tabs.push({ id: null });
  if (i < S.active) S.active--; else if (i === S.active) S.active = Math.min(i, S.tabs.length - 1);
  await ensureLoaded(curId()); persistTabs(); refresh();
}
$('#tabs').addEventListener('click', e => {
  const c = e.target.closest('[data-close]');
  if (c) return closeTab(+c.dataset.close);
  const t = e.target.closest('.tab'); if (t) switchTab(+t.dataset.i);
});
$('#tabs').addEventListener('auxclick', e => { const t = e.target.closest('.tab'); if (e.button === 1 && t) closeTab(+t.dataset.i); });
$('#new-tab').addEventListener('click', async () => { await flush(); S.tabs.push({ id: null }); S.active = S.tabs.length - 1; persistTabs(); refresh(); });

/* ======================= Renderização geral ======================= */
function refresh(force = false) {
  renderTabs(); renderTree();
  if (force || curId() !== S.shown) showNote();
  renderOutline(); renderStats(); renderCrumb();
}
function renderCrumb() {
  const n = curNote();
  $('#crumb').textContent = n ? (folderPath(n.folder_id) || 'Raiz do cofre') : '';
}
function showNote() {
  const n = curNote(); S.shown = curId();
  $('#empty').hidden = !!n; $('#note').hidden = !n; $('#btn-mode').hidden = !n;
  if (!n) { $('#save-state').textContent = ''; return; }
  $('#title').value = n.title; $('#editor').value = n.content;
  renderTags(); renderMeta(); applyMode();
}
function renderMeta() {
  const n = curNote(); if (!n) return;
  $('#meta').textContent = `Criada em ${fmt(n.created_at)}  ·  Editada em ${fmt(n.updated_at)}`;
}
function applyMode() {
  const n = curNote(); if (!n) return;
  const prev = S.mode === 'preview';
  $('#editor').hidden = prev; $('#preview').hidden = !prev;
  $('#btn-mode').innerHTML = svg(prev ? 'pencil' : 'eye');
  $('#btn-mode').title = prev ? 'Voltar a editar (Alt+E)' : 'Visualizar (Alt+E)';
  if (prev) $('#preview').innerHTML = md(n.content);
  lsSet('nc_mode', S.mode);
}
function toggleMode() { if (!curNote()) return; S.mode = S.mode === 'edit' ? 'preview' : 'edit'; applyMode(); if (S.mode === 'edit') $('#editor').focus(); }
$('#btn-mode').addEventListener('click', toggleMode);

/* ======================= Editor, salvamento automático ======================= */
function setStatus(s) {
  const el = $('#st-sync');
  el.className = s === 'saving' ? 'saving' : s === 'error' ? 'error' : '';
  el.title = { saving: 'Salvando…', saved: 'Salvo', error: 'Erro ao salvar' }[s];
  $('#save-state').textContent = { saving: 'Salvando…', saved: 'Salvo', error: 'Não salvo' }[s];
}
function markDirty() { S.dirty = true; setStatus('saving'); clearTimeout(S.saveTimer); S.saveTimer = setTimeout(save, 700); }
async function save() {
  clearTimeout(S.saveTimer); S.saveTimer = null;
  const n = curNote(); if (!n || !S.dirty) return;
  S.dirty = false;
  try {
    const r = await api(`/api/notes/${n.id}`, 'PATCH', { title: n.title, content: n.content, tags: n.tags });
    n.updated_at = r.updated_at;
    const m = S.notes.find(x => x.id === n.id); if (m) { m.title = n.title; m.updated_at = r.updated_at; }
    if (!S.dirty) setStatus('saved');
    renderMeta(); refreshTags();
  } catch { S.dirty = true; setStatus('error'); }
}
const flush = async () => { if (S.saveTimer || S.dirty) await save(); };
window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

const editor = $('#editor');
editor.addEventListener('input', () => {
  const n = curNote(); if (!n) return;
  n.content = editor.value; markDirty(); renderStats(); renderOutlineSoon();
});
editor.addEventListener('keydown', e => {
  if (e.key === 'Tab') { e.preventDefault(); editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end'); editor.dispatchEvent(new Event('input')); }
});
$('#title').addEventListener('input', e => {
  const n = curNote(); if (!n) return;
  n.title = e.target.value;
  const m = S.notes.find(x => x.id === n.id); if (m) m.title = n.title;
  markDirty(); renderTabs(); renderTree();
});
$('#title').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); editor.focus(); } });

/* Tags da anotação */
function renderTags() {
  const n = curNote(); if (!n) return;
  $('#tagbar').innerHTML = n.tags.map(t => `<span class="chip">#${esc(t)}<button data-rm="${esc(t)}" title="Remover tag">×</button></span>`).join('')
    + '<input id="tag-in" list="taglist" placeholder="+ tag" autocomplete="off">';
}
function addTag(raw) {
  const n = curNote(); if (!n) return;
  const t = raw.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
  if (t && !n.tags.includes(t)) { n.tags.push(t); n.tags.sort(); markDirty(); }
  renderTags(); $('#tag-in').focus();
}
$('#tagbar').addEventListener('keydown', e => {
  if (e.target.id !== 'tag-in') return;
  if (['Enter', ',', ' '].includes(e.key) && e.target.value.trim()) { e.preventDefault(); addTag(e.target.value); }
  else if (e.key === 'Backspace' && !e.target.value) { const n = curNote(); if (n.tags.length) { n.tags.pop(); markDirty(); renderTags(); $('#tag-in').focus(); } }
});
$('#tagbar').addEventListener('change', e => { if (e.target.id === 'tag-in' && e.target.value.trim()) addTag(e.target.value); });
$('#tagbar').addEventListener('click', e => {
  const b = e.target.closest('[data-rm]'); if (!b) return;
  const n = curNote(); n.tags = n.tags.filter(t => t !== b.dataset.rm); markDirty(); renderTags();
});

/* ======================= Sumário e estatísticas ======================= */
function headings(text) {
  const out = []; let fence = false;
  text.split('\n').forEach((l, i) => {
    if (/^\s*```/.test(l)) { fence = !fence; return; }
    if (fence) return;
    const m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(l);
    if (m) out.push({ level: m[1].length, text: m[2], line: i });
  });
  return out;
}
function renderOutline() {
  const n = curNote(), q = $('#o-filter').value.trim().toLowerCase();
  const hs = n ? headings(n.content).filter(h => h.text.toLowerCase().includes(q)) : [];
  const min = hs.length ? Math.min(...hs.map(h => h.level)) : 1;
  $('#outline').innerHTML = hs.length
    ? hs.map(h => `<button class="o-item" data-line="${h.line}" style="--l:${h.level - min}" title="${esc(h.text)}">${esc(h.text)}</button>`).join('')
    : `<div class="empty-hint">${n ? 'Nenhum título encontrado.<br>Use # para criar títulos.' : ''}</div>`;
}
const renderOutlineSoon = debounce(renderOutline, 250);
$('#o-filter').addEventListener('input', renderOutline);
$('#outline').addEventListener('click', e => {
  const b = e.target.closest('.o-item'); if (!b) return;
  const line = +b.dataset.line;
  if (S.mode === 'preview') { $(`#preview [data-line="${line}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const lines = editor.value.split('\n'), pos = lines.slice(0, line).join('\n').length + (line ? 1 : 0);
  const full = editor.value; editor.value = full.slice(0, pos);           // truque: mede a altura até a linha
  const y = editor.scrollHeight; editor.value = full;
  editor.focus(); editor.setSelectionRange(pos, pos + lines[line].length);
  editor.scrollTop = Math.max(0, y - editor.clientHeight / 3);
});
function renderStats() {
  const t = curNote()?.content || '';
  const md1 = (t.match(/\[[^\]]*\]\([^)]+\)/g) || []).length, wiki = (t.match(/\[\[[^\]]+\]\]/g) || []).length;
  const bare = (t.replace(/\[[^\]]*\]\([^)]+\)/g, '').match(/https?:\/\/\S+/g) || []).length;
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  $('#st-links').innerHTML = `<i data-ic="link"></i>${md1 + wiki + bare} Links`;
  $('#st-words').innerHTML = `<i data-ic="pen"></i>${words} Palavras`;
  $('#st-chars').textContent = `${t.length} caracteres`;
  icons($('#right-foot'));
}

/* ======================= Markdown -> HTML (visualização) ======================= */
function md(src) {
  const L = src.replace(/\r/g, '').split('\n');
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\[\[([^\]]+)\]\]/g, '<span class="wikilink">$1</span>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s"&]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const isFence = l => /^\s*```/.test(l), isList = l => /^\s*([-*+]|\d+\.)\s+/.test(l);
  const isHr = l => /^\s*([-*_])(\s*\1){2,}\s*$/.test(l), isHead = l => /^#{1,6}\s+/.test(l);
  const isSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l || '');
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  let out = '', i = 0;
  while (i < L.length) {
    const l = L[i]; let m;
    if (!l.trim()) { i++; continue; }
    if (isFence(l)) { const code = []; i++; while (i < L.length && !isFence(L[i])) code.push(L[i++]); i++; out += `<pre><code>${esc(code.join('\n'))}</code></pre>`; continue; }
    if ((m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(l))) { out += `<h${m[1].length} data-line="${i}">${inline(m[2])}</h${m[1].length}>`; i++; continue; }
    if (isHr(l)) { out += '<hr>'; i++; continue; }
    if (/^\s*>/.test(l)) { const q = []; while (i < L.length && /^\s*>/.test(L[i])) q.push(L[i++].replace(/^\s*>\s?/, '')); out += `<blockquote>${md(q.join('\n'))}</blockquote>`; continue; }
    if (l.includes('|') && isSep(L[i + 1])) {
      const head = cells(l); i += 2; const rows = [];
      while (i < L.length && L[i].includes('|') && L[i].trim()) rows.push(cells(L[i++]));
      out += `<table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      continue;
    }
    if (isList(l)) {
      const ordered = /^\s*\d+\./.test(l); let items = '';
      while (i < L.length && isList(L[i])) {
        const mm = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(L[i]); let t = mm[3], cls = '';
        const task = /^\[( |x|X)\]\s+(.*)$/.exec(t);
        if (task) { t = `<input type="checkbox" disabled ${task[1] !== ' ' ? 'checked' : ''}> ${inline(task[2])}`; cls = ' class="task"'; } else t = inline(t);
        items += `<li${cls} style="margin-left:${mm[1].replace(/\t/g, '    ').length * 8}px">${t}</li>`; i++;
      }
      out += ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`; continue;
    }
    const p = [];
    while (i < L.length && L[i].trim() && !isFence(L[i]) && !isHead(L[i]) && !isHr(L[i]) && !isList(L[i]) && !/^\s*>/.test(L[i])) p.push(inline(L[i++]));
    out += `<p>${p.join('<br>')}</p>`;
  }
  return out;
}

/* ======================= Painéis da esquerda: busca, tags, datas ======================= */
const VIEW_TITLES = { search: 'Buscar', tags: 'Tags', dates: 'Por data' };
function setView(v, expand = true) {
  S.view = v;
  if (expand && $('#body').classList.contains('left-collapsed')) toggleSide('left', false);
  $$('#ribbon [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  ['files', 'search', 'tags', 'dates'].forEach(x => { $('#view-' + x).hidden = x !== v; });
  $('#head-files').hidden = v !== 'files'; $('#head-title').hidden = v === 'files'; $('#head-title').textContent = VIEW_TITLES[v] || '';
  if (v === 'search') { $('#s-q').focus(); runSearch(); }
  if (v === 'tags') renderTagList();
  if (v === 'dates') runDates();
}
$('#ribbon').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });

const resultHTML = r => `<div class="res" data-id="${r.id}"><div class="res-title">${esc(r.title)}</div>
  <div class="res-path">${esc(r.path || 'Raiz do cofre')}  ·  ${fmt(r.created_at)}</div>
  ${r.snippet ? `<div class="res-snip">${esc(r.snippet).replace(/\x01/g, '<mark>').replace(/\x02/g, '</mark>')}</div>` : ''}
  ${r.tags.length ? `<div class="chips">${r.tags.map(t => `<span class="chip">#${esc(t)}</span>`).join('')}</div>` : ''}</div>`;

async function runSearch() {
  const p = new URLSearchParams({ q: $('#s-q').value, from: $('#s-from').value, to: $('#s-to').value, by: $('#s-by').value });
  if ($('#s-tag').value) p.append('tag', $('#s-tag').value);
  const res = await api('/api/search?' + p);
  $('#s-count').textContent = `${res.length} resultado${res.length === 1 ? '' : 's'}`;
  $('#s-results').innerHTML = res.length ? res.map(resultHTML).join('') : '<div class="empty-hint">Nada encontrado com esses filtros.</div>';
}
const runSearchSoon = debounce(runSearch, 180);
['#s-q'].forEach(s => $(s).addEventListener('input', runSearchSoon));
['#s-tag', '#s-by', '#s-from', '#s-to'].forEach(s => $(s).addEventListener('change', runSearch));
$('#s-clear').addEventListener('click', () => { ['#s-q', '#s-tag', '#s-from', '#s-to'].forEach(s => $(s).value = ''); runSearch(); });
$('#s-results').addEventListener('click', e => { const r = e.target.closest('.res'); if (r) openNote(+r.dataset.id); });

function renderTagList() {
  $('#tag-list').innerHTML = S.tags.length
    ? S.tags.map(t => `<div class="tag-row" data-tag="${esc(t.name)}"><span>#${esc(t.name)}</span><b>${t.count}</b></div>`).join('')
    : '<div class="empty-hint">Nenhuma tag ainda.<br>Adicione tags dentro de uma anotação.</div>';
}
$('#tag-list').addEventListener('click', e => {
  const r = e.target.closest('.tag-row'); if (!r) return;
  setView('search'); $('#s-q').value = ''; $('#s-tag').value = r.dataset.tag; runSearch();
});

async function runDates() {
  const by = $('#d-by').value, res = await api('/api/search?by=' + by), groups = {};
  res.forEach(r => (groups[(by === 'updated' ? r.updated_at : r.created_at).slice(0, 10)] ||= []).push(r));
  $('#d-results').innerHTML = Object.keys(groups).sort().reverse().map(day => {
    const label = new Date(day + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `<div class="day-head">${esc(label)}</div>` + groups[day].map(r => `<div class="day-item" data-id="${r.id}"><span>${esc(r.title)}</span><span class="muted">${esc((by === 'updated' ? r.updated_at : r.created_at).slice(11, 16))}</span></div>`).join('');
  }).join('') || '<div class="empty-hint">Sem anotações ainda.</div>';
}
$('#d-by').addEventListener('change', runDates);
$('#d-results').addEventListener('click', e => { const r = e.target.closest('.day-item'); if (r) openNote(+r.dataset.id); });

/* ======================= Laterais: recolher e redimensionar ======================= */
const SIDE = { left: { cls: 'left-collapsed', key: 'nc_lw', v: '--lw', def: 260, min: 170, max: 520 },
               right: { cls: 'right-collapsed', key: 'nc_rw', v: '--rw', def: 250, min: 180, max: 520 } };
function toggleSide(side, collapse) {
  const b = $('#body'), c = SIDE[side].cls;
  b.classList.toggle(c, collapse ?? !b.classList.contains(c));
  lsSet('nc_' + side + '_collapsed', b.classList.contains(c));
}
function applyLayout() {
  for (const [side, o] of Object.entries(SIDE)) {
    $('#body').style.setProperty(o.v, ls(o.key, o.def) + 'px');
    $('#body').classList.toggle(o.cls, ls('nc_' + side + '_collapsed', false));
  }
}
function initResizer(handle, side) {
  const o = SIDE[side];
  $(handle).addEventListener('mousedown', e => {
    e.preventDefault(); document.body.classList.add('resizing'); let w = 0;
    const move = ev => {
      w = side === 'left' ? ev.clientX - 35 : innerWidth - ev.clientX - 2;
      w = Math.max(o.min, Math.min(o.max, w));
      $('#body').style.setProperty(o.v, w + 'px');
    };
    const up = () => { document.body.classList.remove('resizing'); removeEventListener('mousemove', move); removeEventListener('mouseup', up); if (w) lsSet(o.key, w); };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
  });
  $(handle).addEventListener('dblclick', () => { $('#body').style.setProperty(o.v, o.def + 'px'); lsSet(o.key, o.def); });
}
initResizer('#rs-left', 'left'); initResizer('#rs-right', 'right');
$('#tg-left').addEventListener('click', () => toggleSide('left'));
$('#tg-right').addEventListener('click', () => toggleSide('right'));

/* ======================= Menus, configurações e atalhos ======================= */
$('#act-note').addEventListener('click', () => newNote(null));
$('#act-folder').addEventListener('click', () => newFolder(null));
$('#empty-new').addEventListener('click', () => newNote(null));
$('#btn-more').addEventListener('click', e => {
  const r = e.currentTarget.getBoundingClientRect(), id = curId(), items = [];
  if (id) items.push(
    { label: S.mode === 'edit' ? 'Visualizar' : 'Editar', fn: toggleMode },
    { label: 'Exportar como PDF', fn: () => flush().then(() => exportNote(id, 'pdf')) },
    { label: 'Exportar como Markdown', fn: () => flush().then(() => exportNote(id, 'md')) },
    '-');
  items.push({ label: 'Nova anotação', fn: () => newNote(null) }, { label: 'Exportar cofre (.zip)', fn: () => { location.href = '/api/export/vault'; } });
  if (id) items.push('-', { label: 'Excluir anotação', danger: true, fn: () => deleteNote(id) });
  showMenu(r.right - 200, r.bottom + 4, items);
});

function applySettings() {
  const s = S.settings;
  $('#vault-name').textContent = s.vault; document.title = `${s.vault} · NoteClass`;
  document.documentElement.style.setProperty('--editor-fs', s.fontSize + 'px');
  document.body.classList.toggle('mono', s.mono);
}
$('#open-settings').addEventListener('click', () => {
  const s = S.settings;
  $('#set-vault').value = s.vault; $('#set-fs').value = s.fontSize; $('#set-mono').checked = s.mono; $('#set-preview').checked = s.startPreview;
  $('#settings').showModal();
});
$('#settings').addEventListener('close', () => {
  S.settings = { vault: $('#set-vault').value.trim() || 'Cofre 1', fontSize: +$('#set-fs').value, mono: $('#set-mono').checked, startPreview: $('#set-preview').checked };
  lsSet('nc_settings', S.settings); applySettings();
});

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k === 's') { e.preventDefault(); save(); }
  else if (e.altKey && k === 'n') { e.preventDefault(); newNote(null); }
  else if (e.altKey && k === 'e') { e.preventDefault(); toggleMode(); }
  else if (e.ctrlKey && k === 'k') { e.preventDefault(); setView('search'); }
  else if (e.ctrlKey && !e.altKey && k === 'b') { e.preventDefault(); toggleSide('left'); }
  else if (e.altKey && k === 'b') { e.preventDefault(); toggleSide('right'); }
});

/* ======================= Inicialização ======================= */
(async function init() {
  icons(); applySettings(); applyLayout(); setView('files', false);
  await loadTree(); await refreshTags();
  const saved = ls('nc_tabs', null);
  if (saved?.ids?.length) {
    const tabs = saved.ids.filter(id => id === null || S.notes.some(n => n.id === id)).map(id => ({ id }));
    if (tabs.length) { S.tabs = tabs; S.active = Math.min(saved.active ?? 0, tabs.length - 1); }
  }
  await ensureLoaded(curId());
  refresh(true);
})();
})();
