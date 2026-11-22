"""NoteClass - anotações acadêmicas organizadas (backend Flask + SQLite)."""
import io
import os
import re
import sqlite3
import textwrap
import unicodedata
import zipfile
from datetime import datetime
from xml.sax.saxutils import escape as xesc

from flask import Flask, g, jsonify, render_template, request, send_file

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "noteclass.db")
app = Flask(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS folders (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL DEFAULT 'Sem título',
  content    TEXT NOT NULL DEFAULT '',
  folder_id  INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_notes_folder  ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
"""


# ----------------------------------------------------------------- utilidades
def norm(s):
    """Minúsculas e sem acentos: 'Álgebra' -> 'algebra' (mesmo tamanho do original)."""
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def db():
    if "db" not in g:
        con = sqlite3.connect(DB_PATH)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys = ON")      # ativa o ON DELETE CASCADE
        con.create_function("norm", 1, norm)          # usada nas buscas (SQL)
        g.db = con
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    con = g.pop("db", None)
    if con is not None:
        con.close()


def init_db():
    with sqlite3.connect(DB_PATH) as con:
        con.executescript(SCHEMA)


def now():
    return datetime.now().isoformat(sep=" ", timespec="seconds")


def body():
    return request.get_json(silent=True) or {}


def err(msg, code=400):
    return jsonify(error=msg), code


def clean_tag(t):
    return re.sub(r"\s+", "-", (t or "").strip().lstrip("#").lower())[:40]


def safe_name(s):
    return re.sub(r'[\\/:*?"<>|]+', "-", (s or "").strip()).strip(". ") or "anotacao"


def folder_map(con):
    return {r["id"]: (r["name"], r["parent_id"]) for r in con.execute("SELECT * FROM folders")}


def folder_path(fid, fm):
    parts, seen = [], set()
    while fid and fid in fm and fid not in seen:
        seen.add(fid)
        name, fid = fm[fid]
        parts.append(name)
    return "/".join(reversed(parts))


def is_inside(fm, ancestor, fid):
    """True se `fid` está dentro de `ancestor` (para impedir ciclos ao mover pastas)."""
    seen = set()
    while fid and fid in fm and fid not in seen:
        if fid == ancestor:
            return True
        seen.add(fid)
        fid = fm[fid][1]
    return False


def note_tags(con, nid):
    rows = con.execute(
        "SELECT t.name FROM tags t JOIN note_tags nt ON nt.tag_id = t.id "
        "WHERE nt.note_id = ? ORDER BY t.name", (nid,))
    return [r["name"] for r in rows]


def set_tags(con, nid, tags):
    names = sorted({clean_tag(t) for t in tags if clean_tag(t)})
    con.execute("DELETE FROM note_tags WHERE note_id = ?", (nid,))
    for n in names:
        con.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (n,))
        tid = con.execute("SELECT id FROM tags WHERE name = ?", (n,)).fetchone()["id"]
        con.execute("INSERT INTO note_tags(note_id, tag_id) VALUES (?, ?)", (nid, tid))
    con.execute("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM note_tags)")


def full_note(con, nid):
    r = con.execute("SELECT * FROM notes WHERE id = ?", (nid,)).fetchone()
    if not r:
        return None
    n = dict(r)
    n["tags"] = note_tags(con, nid)
    n["path"] = folder_path(n["folder_id"], folder_map(con))
    return n


# ---------------------------------------------------------------------- páginas
@app.get("/")
def index():
    return render_template("index.html")


# ------------------------------------------------------------------------ pastas
@app.get("/api/tree")
def tree():
    con = db()
    folders = [dict(r) for r in con.execute(
        "SELECT id, name, parent_id FROM folders ORDER BY name COLLATE NOCASE")]
    notes = [dict(r) for r in con.execute(
        "SELECT id, title, folder_id, created_at, updated_at FROM notes ORDER BY title COLLATE NOCASE")]
    return jsonify(folders=folders, notes=notes)


@app.post("/api/folders")
def folder_create():
    d, con = body(), db()
    name = (d.get("name") or "").strip().replace("/", "-")
    pid = d.get("parent_id") or None
    if not name:
        return err("Informe um nome para a pasta.")
    if pid and not con.execute("SELECT 1 FROM folders WHERE id = ?", (pid,)).fetchone():
        return err("Pasta pai não encontrada.", 404)
    cur = con.execute("INSERT INTO folders(name, parent_id) VALUES (?, ?)", (name, pid))
    con.commit()
    return jsonify(id=cur.lastrowid, name=name, parent_id=pid), 201


@app.patch("/api/folders/<int:fid>")
def folder_update(fid):
    d, con = body(), db()
    if not con.execute("SELECT 1 FROM folders WHERE id = ?", (fid,)).fetchone():
        return err("Pasta não encontrada.", 404)
    if "name" in d:
        name = (d["name"] or "").strip().replace("/", "-")
        if not name:
            return err("Nome inválido.")
        con.execute("UPDATE folders SET name = ? WHERE id = ?", (name, fid))
    if "parent_id" in d:
        pid = d["parent_id"] or None
        if pid is not None and is_inside(folder_map(con), fid, pid):
            return err("Não é possível mover uma pasta para dentro dela mesma.")
        con.execute("UPDATE folders SET parent_id = ? WHERE id = ?", (pid, fid))
    con.commit()
    return jsonify(ok=True)


@app.delete("/api/folders/<int:fid>")
def folder_delete(fid):
    con = db()
    con.execute("DELETE FROM folders WHERE id = ?", (fid,))   # cascata: subpastas e notas
    con.execute("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM note_tags)")
    con.commit()
    return jsonify(ok=True)


# ------------------------------------------------------------------------ notas
@app.post("/api/notes")
def note_create():
    d, con = body(), db()
    fid = d.get("folder_id") or None
    if fid and not con.execute("SELECT 1 FROM folders WHERE id = ?", (fid,)).fetchone():
        return err("Pasta não encontrada.", 404)
    ts = now()
    cur = con.execute(
        "INSERT INTO notes(title, content, folder_id, created_at, updated_at) VALUES (?,?,?,?,?)",
        ((d.get("title") or "Sem título").strip(), d.get("content") or "", fid, ts, ts))
    con.commit()
    return jsonify(full_note(con, cur.lastrowid)), 201


@app.get("/api/notes/<int:nid>")
def note_get(nid):
    n = full_note(db(), nid)
    return jsonify(n) if n else err("Anotação não encontrada.", 404)


@app.patch("/api/notes/<int:nid>")
def note_update(nid):
    d, con = body(), db()
    if not con.execute("SELECT 1 FROM notes WHERE id = ?", (nid,)).fetchone():
        return err("Anotação não encontrada.", 404)
    sets, params = [], []
    if "title" in d:
        sets.append("title = ?")
        params.append((d["title"] or "").strip() or "Sem título")
    if "content" in d:
        sets.append("content = ?")
        params.append(d["content"] or "")
    if "folder_id" in d:
        sets.append("folder_id = ?")
        params.append(d["folder_id"] or None)
    sets.append("updated_at = ?")
    params += [now(), nid]
    con.execute(f"UPDATE notes SET {', '.join(sets)} WHERE id = ?", params)
    if "tags" in d:
        set_tags(con, nid, d["tags"] or [])
    con.commit()
    n = full_note(con, nid)
    return jsonify(id=nid, title=n["title"], folder_id=n["folder_id"],
                   updated_at=n["updated_at"], tags=n["tags"])


@app.delete("/api/notes/<int:nid>")
def note_delete(nid):
    con = db()
    con.execute("DELETE FROM notes WHERE id = ?", (nid,))
    con.execute("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM note_tags)")
    con.commit()
    return jsonify(ok=True)


# ------------------------------------------------------------------ tags e busca
@app.get("/api/tags")
def tags_list():
    rows = db().execute(
        "SELECT t.name, COUNT(nt.note_id) AS count FROM tags t "
        "JOIN note_tags nt ON nt.tag_id = t.id GROUP BY t.id ORDER BY t.name")
    return jsonify([dict(r) for r in rows])


def like_escape(s):
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def make_snippet(content, terms, width=70):
    """Trecho do texto ao redor do 1º termo encontrado; termos vão entre \\x01 e \\x02."""
    flat = content.replace("\n", " ")
    if not terms:
        return flat[:width * 2]
    nf = norm(flat)
    if len(nf) != len(flat):
        return flat[:width * 2]
    pos = next((nf.find(t) for t in terms if t and nf.find(t) >= 0), -1)
    start = max(0, pos - width // 2) if pos >= 0 else 0
    seg, nseg = flat[start:start + width * 2], nf[start:start + width * 2]
    spans = sorted((m.start(), m.end()) for t in terms if t
                   for m in re.finditer(re.escape(t), nseg))
    out, last = [], 0
    for s, e in spans:
        if s < last:
            continue
        out += [seg[last:s], "\x01", seg[s:e], "\x02"]
        last = e
    out.append(seg[last:])
    return ("…" if start > 0 else "") + "".join(out) + ("…" if start + len(seg) < len(flat) else "")


@app.get("/api/search")
def search():
    """Filtros: q (texto, aceita #tag e tag:x), tag, from/to (YYYY-MM-DD), by=created|updated."""
    con = db()
    q = request.args.get("q", "").strip()
    tags = list(request.args.getlist("tag"))
    d_from, d_to = request.args.get("from"), request.args.get("to")
    col = "updated_at" if request.args.get("by") == "updated" else "created_at"

    terms = []
    for tok in q.split():
        if tok.startswith("#") and len(tok) > 1:
            tags.append(tok[1:])
        elif tok.lower().startswith("tag:") and len(tok) > 4:
            tags.append(tok[4:])
        else:
            terms.append(norm(tok))

    sql = "SELECT n.id, n.title, n.content, n.folder_id, n.created_at, n.updated_at FROM notes n WHERE 1=1"
    params = []
    for t in terms:
        sql += " AND (norm(n.title) LIKE ? ESCAPE '\\' OR norm(n.content) LIKE ? ESCAPE '\\')"
        params += [f"%{like_escape(t)}%"] * 2
    for tag in tags:
        sql += (" AND EXISTS (SELECT 1 FROM note_tags nt JOIN tags t ON t.id = nt.tag_id "
                "WHERE nt.note_id = n.id AND t.name = ?)")
        params.append(clean_tag(tag))
    if d_from:
        sql += f" AND date(n.{col}) >= date(?)"
        params.append(d_from)
    if d_to:
        sql += f" AND date(n.{col}) <= date(?)"
        params.append(d_to)
    sql += f" ORDER BY n.{col} DESC LIMIT 200"

    fm = folder_map(con)
    out = []
    for r in con.execute(sql, params):
        out.append({
            "id": r["id"], "title": r["title"], "folder_id": r["folder_id"],
            "path": folder_path(r["folder_id"], fm), "tags": note_tags(con, r["id"]),
            "created_at": r["created_at"], "updated_at": r["updated_at"],
            "snippet": make_snippet(r["content"], terms),
        })
    return jsonify(out)


# --------------------------------------------------------------------- exportação
def note_to_md(n):
    tags = ", ".join(n["tags"])
    head = (f"---\ntitle: {n['title']}\ntags: [{tags}]\nfolder: {n['path'] or '-'}\n"
            f"created: {n['created_at']}\nupdated: {n['updated_at']}\n---\n\n")
    return head + n["content"]


def _inline(t):
    """Markdown inline -> marcação do ReportLab."""
    t = xesc(t)
    t = re.sub(r"`([^`]+)`", r'<font face="Courier">\1</font>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])", r"<i>\1</i>", t)
    t = re.sub(r"\[\[([^\]]+)\]\]", r"<i>\1</i>", t)
    t = re.sub(r'\[([^\]]+)\]\((https?:[^)\s"]+)\)', r'<link href="\2" color="#1a56c4">\1</link>', t)
    return t


def build_pdf(n):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import HRFlowable, Paragraph, Preformatted, SimpleDocTemplate, Spacer

    ss = getSampleStyleSheet()
    body_st = ParagraphStyle("b", parent=ss["BodyText"], fontSize=10.5, leading=15, spaceAfter=6)
    sizes = (20, 16, 14, 12, 11, 10)
    heads = {i + 1: ParagraphStyle(f"h{i}", parent=ss["Heading1"], fontSize=s, leading=s + 4,
                                   spaceBefore=10, spaceAfter=5) for i, s in enumerate(sizes)}
    quote = ParagraphStyle("q", parent=body_st, leftIndent=14, textColor=colors.HexColor("#555555"))
    code_st = ParagraphStyle("c", parent=ss["Code"], fontSize=8.5, leading=11,
                             backColor=colors.HexColor("#f1f1f1"), borderPadding=6, spaceAfter=10)
    meta = ParagraphStyle("m", parent=body_st, fontSize=8.5, textColor=colors.grey)
    li_cache = {}

    def li_style(level):
        if level not in li_cache:
            li_cache[level] = ParagraphStyle(f"li{level}", parent=body_st, spaceAfter=2,
                                             leftIndent=16 + level * 14, bulletIndent=level * 14)
        return li_cache[level]

    def code_block(lines):
        wrapped = []
        for ln in lines:
            wrapped += textwrap.wrap(ln, 95, drop_whitespace=False, replace_whitespace=False) or [""]
        return Preformatted("\n".join(wrapped), code_st)

    story = [Paragraph(xesc(n["title"]), heads[1])]
    info = f"Criada em {n['created_at'][:16]}  |  Editada em {n['updated_at'][:16]}"
    if n["path"]:
        info = f"Pasta: {n['path']}  |  " + info
    if n["tags"]:
        info += "  |  Tags: " + ", ".join("#" + t for t in n["tags"])
    story += [Paragraph(xesc(info), meta),
              HRFlowable(width="100%", color=colors.lightgrey, spaceBefore=4, spaceAfter=8)]

    para, table = [], []

    def flush():
        if para:
            story.append(Paragraph(_inline(" ".join(para)), body_st))
            para.clear()
        if table:
            story.append(code_block(table))
            table.clear()

    in_code, code = False, []
    for line in n["content"].replace("\r", "").split("\n"):
        if line.strip().startswith("```"):
            if in_code:
                story.append(code_block(code))
                code, in_code = [], False
            else:
                flush()
                in_code = True
            continue
        if in_code:
            code.append(line)
            continue
        s = line.strip()
        if s.startswith("|"):
            if para:
                flush()
            table.append(s)
            continue
        if table:
            flush()
        if not s:
            flush()
            continue
        m = re.match(r"^(#{1,6})\s+(.*?)\s*#*$", s)
        if m:
            flush()
            story.append(Paragraph(_inline(m.group(2)), heads[len(m.group(1))]))
        elif re.match(r"^([-*_])(\s*\1){2,}$", s):
            flush()
            story.append(HRFlowable(width="100%", color=colors.lightgrey, spaceBefore=4, spaceAfter=8))
        elif s.startswith(">"):
            flush()
            story.append(Paragraph(_inline(s.lstrip("> ")), quote))
        elif (m := re.match(r"^(\s*)([-*+]|\d+\.)\s+(.*)$", line)):
            flush()
            level = len(m.group(1).replace("\t", "    ")) // 2
            bullet = m.group(2) if m.group(2)[0].isdigit() else "•"
            story.append(Paragraph(_inline(m.group(3)), li_style(level), bulletText=bullet))
        else:
            para.append(s)
    if in_code:
        story.append(code_block(code))
    flush()
    story.append(Spacer(1, 6))

    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                      topMargin=2 * cm, bottomMargin=2 * cm, title=n["title"]).build(story)
    buf.seek(0)
    return buf


@app.get("/api/notes/<int:nid>/export")
def export_note(nid):
    n = full_note(db(), nid)
    if not n:
        return err("Anotação não encontrada.", 404)
    base = safe_name(n["title"])
    if request.args.get("format") == "pdf":
        return send_file(build_pdf(n), mimetype="application/pdf",
                         as_attachment=True, download_name=base + ".pdf")
    return send_file(io.BytesIO(note_to_md(n).encode("utf-8")), mimetype="text/markdown",
                     as_attachment=True, download_name=base + ".md")


@app.get("/api/export/vault")
def export_vault():
    """Todas as anotações em .md dentro de um .zip, respeitando a estrutura de pastas."""
    con = db()
    buf, used = io.BytesIO(), set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for r in con.execute("SELECT id FROM notes"):
            n = full_note(con, r["id"])
            parts = [safe_name(p) for p in n["path"].split("/") if p]
            name = safe_name(n["title"])
            arc = "/".join(parts + [name + ".md"])
            if arc in used:
                arc = "/".join(parts + [f"{name} ({n['id']}).md"])
            used.add(arc)
            z.writestr(arc, note_to_md(n))
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True,
                     download_name="noteclass-cofre.zip")


init_db()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
