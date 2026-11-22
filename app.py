import datetime as dt
import html
import io
import json
import re
import zipfile

import markdown as md_lib
from flask import Flask, jsonify, render_template, request, send_file
from pymysql import MySQLError
from xhtml2pdf import pisa

from db import cursor

app = Flask(__name__)
app.json.ensure_ascii = False  # acentos legíveis no JSON


# ---------------------------------------------------------------- utilitários
def today():
    return dt.date.today().isoformat()


def parse_date(value):
    """Aceita 'AAAA-MM-DD'; se vier vazio/inválido, usa hoje."""
    try:
        return dt.date.fromisoformat(str(value)[:10]).isoformat()
    except (ValueError, TypeError):
        return today()


def clean_row(row):
    """date/datetime -> texto ISO (o jsonify do Flask usaria outro formato)."""
    return {k: (v.isoformat() if isinstance(v, (dt.date, dt.datetime)) else v)
            for k, v in row.items()}


def bad(msg, code=400):
    return jsonify(error=msg), code


def clean_tags(raw):
    """Normaliza: minúsculas, sem '#', sem duplicadas, no máximo 20."""
    out = []
    for t in raw or []:
        t = re.sub(r"\s+", " ", str(t)).strip().lstrip("#").strip().lower()[:50]
        if t and t not in out:
            out.append(t)
    return out[:20]


def safe_name(text):
    """Nome de arquivo seguro (Windows/Linux)."""
    return re.sub(r'[\\/:*?"<>|\r\n]+', " ", text or "").strip()[:80] or "anotacao"


@app.errorhandler(MySQLError)
def db_error(err):
    app.logger.exception(err)
    return jsonify(error="Erro no banco de dados. Confira se o MySQL está ligado "
                         "e se o arquivo .env está correto."), 500


# ------------------------------------------------------------------- interface
@app.get("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------- pastas
@app.get("/api/tree")
def tree():
    with cursor() as c:
        c.execute("SELECT id, parent_id, name FROM folders ORDER BY name")
        folders = c.fetchall()
        c.execute("SELECT id, folder_id, title, note_date FROM notes ORDER BY title")
        notes = [clean_row(n) for n in c.fetchall()]
    return jsonify(folders=folders, notes=notes)


def creates_cycle(c, folder_id, new_parent):
    """True se mover 'folder_id' para dentro de 'new_parent' criaria um ciclo."""
    cur = new_parent
    while cur is not None:
        if cur == folder_id:
            return True
        c.execute("SELECT parent_id FROM folders WHERE id=%s", (cur,))
        row = c.fetchone()
        cur = row["parent_id"] if row else None
    return False


@app.post("/api/folders")
def folder_create():
    d = request.get_json(force=True)
    name = (d.get("name") or "").strip()[:120]
    if not name:
        return bad("Informe um nome para a pasta.")
    with cursor() as c:
        c.execute("INSERT INTO folders (parent_id, name) VALUES (%s, %s)",
                  (d.get("parent_id"), name))
        return jsonify(id=c.lastrowid, parent_id=d.get("parent_id"), name=name), 201


@app.put("/api/folders/<int:fid>")
def folder_update(fid):
    d = request.get_json(force=True)
    with cursor() as c:
        if "name" in d:
            name = (d["name"] or "").strip()[:120]
            if not name:
                return bad("O nome da pasta não pode ficar vazio.")
            c.execute("UPDATE folders SET name=%s WHERE id=%s", (name, fid))
        if "parent_id" in d:
            pid = d["parent_id"]
            if pid is not None and creates_cycle(c, fid, pid):
                return bad("Não dá para mover uma pasta para dentro dela mesma.")
            c.execute("UPDATE folders SET parent_id=%s WHERE id=%s", (pid, fid))
    return jsonify(ok=True)


@app.delete("/api/folders/<int:fid>")
def folder_delete(fid):
    with cursor() as c:
        c.execute("DELETE FROM folders WHERE id=%s", (fid,))
    return jsonify(ok=True)


# ------------------------------------------------------------------- anotações
def set_tags(c, note_id, names):
    """Substitui as tags da anotação pela lista recebida."""
    c.execute("DELETE FROM note_tags WHERE note_id=%s", (note_id,))
    for name in clean_tags(names):
        c.execute("INSERT IGNORE INTO tags (name) VALUES (%s)", (name,))
        c.execute("INSERT IGNORE INTO note_tags (note_id, tag_id) "
                  "SELECT %s, id FROM tags WHERE name=%s", (note_id, name))


def load_note(c, nid):
    c.execute("SELECT id, folder_id, title, content, note_date, created_at, updated_at "
              "FROM notes WHERE id=%s", (nid,))
    note = c.fetchone()
    if not note:
        return None
    note = clean_row(note)
    c.execute("SELECT t.name FROM tags t JOIN note_tags nt ON nt.tag_id=t.id "
              "WHERE nt.note_id=%s ORDER BY t.name", (nid,))
    note["tags"] = [r["name"] for r in c.fetchall()]
    return note


@app.post("/api/notes")
def note_create():
    d = request.get_json(force=True)
    title = (d.get("title") or "Sem título").strip()[:200] or "Sem título"
    with cursor() as c:
        c.execute("INSERT INTO notes (folder_id, title, content, note_date) "
                  "VALUES (%s, %s, %s, %s)",
                  (d.get("folder_id"), title, d.get("content", ""),
                   parse_date(d.get("note_date"))))
        nid = c.lastrowid
        set_tags(c, nid, d.get("tags"))
        return jsonify(load_note(c, nid)), 201


@app.get("/api/notes/<int:nid>")
def note_get(nid):
    with cursor() as c:
        note = load_note(c, nid)
    return jsonify(note) if note else bad("Anotação não encontrada.", 404)


@app.put("/api/notes/<int:nid>")
def note_update(nid):
    """Atualização parcial: só altera os campos que vierem no JSON."""
    d = request.get_json(force=True)
    fields, vals = [], []
    if "title" in d:
        fields.append("title=%s")
        vals.append((d["title"] or "").strip()[:200] or "Sem título")
    if "content" in d:
        fields.append("content=%s")
        vals.append(d["content"] or "")
    if "note_date" in d:
        fields.append("note_date=%s")
        vals.append(parse_date(d["note_date"]))
    if "folder_id" in d:
        fields.append("folder_id=%s")
        vals.append(d["folder_id"])
    with cursor() as c:
        if fields:
            c.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id=%s", (*vals, nid))
        if "tags" in d:
            set_tags(c, nid, d["tags"])
    return jsonify(ok=True)


@app.delete("/api/notes/<int:nid>")
def note_delete(nid):
    with cursor() as c:
        c.execute("DELETE FROM notes WHERE id=%s", (nid,))
    return jsonify(ok=True)


# ------------------------------------------------------------------------ tags
@app.get("/api/tags")
def tags_list():
    with cursor() as c:
        c.execute("SELECT t.name, COUNT(nt.note_id) AS count FROM tags t "
                  "JOIN note_tags nt ON nt.tag_id=t.id GROUP BY t.id, t.name ORDER BY t.name")
        return jsonify(c.fetchall())


# ----------------------------------------------------------------------- busca
def folder_and_children(c, fid):
    c.execute("SELECT id, parent_id FROM folders")
    kids = {}
    for r in c.fetchall():
        kids.setdefault(r["parent_id"], []).append(r["id"])
    out, stack = [fid], [fid]
    while stack:
        for k in kids.get(stack.pop(), []):
            out.append(k)
            stack.append(k)
    return out


def make_snippet(content, terms, size=70):
    """Trecho do texto ao redor da primeira palavra encontrada."""
    flat = re.sub(r"\s+", " ", content or "").strip()
    low = flat.lower()
    pos = min((p for p in (low.find(t.lower()) for t in terms) if p >= 0), default=-1)
    if pos < 0:
        return flat[:size * 2]
    start = max(0, pos - size)
    return ("…" if start else "") + flat[start:pos + size * 2] + ("…" if len(flat) > pos + size * 2 else "")


@app.get("/api/search")
def search():
    q = request.args.get("q", "").strip()
    tags = clean_tags(request.args.get("tags", "").split(","))
    d_from, d_to = request.args.get("from"), request.args.get("to")
    folder_id = request.args.get("folder_id", type=int)
    terms = q.split()
    where, params = [], []

    for t in terms:  # cada palavra precisa aparecer no título OU no conteúdo
        like = "%" + t.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        where.append("(n.title LIKE %s OR n.content LIKE %s)")
        params += [like, like]
    for tag in tags:  # a anotação precisa ter TODAS as tags escolhidas
        where.append("n.id IN (SELECT nt.note_id FROM note_tags nt "
                     "JOIN tags t ON t.id=nt.tag_id WHERE t.name=%s)")
        params.append(tag)
    if d_from:
        where.append("n.note_date >= %s")
        params.append(parse_date(d_from))
    if d_to:
        where.append("n.note_date <= %s")
        params.append(parse_date(d_to))

    with cursor() as c:
        if folder_id:
            ids = folder_and_children(c, folder_id)
            where.append(f"n.folder_id IN ({','.join(['%s'] * len(ids))})")
            params += ids
        sql = ("SELECT n.id, n.title, n.content, n.note_date, f.name AS folder_name "
               "FROM notes n LEFT JOIN folders f ON f.id=n.folder_id "
               + ("WHERE " + " AND ".join(where) if where else "")
               + " ORDER BY n.note_date DESC, n.updated_at DESC LIMIT 100")
        c.execute(sql, params)
        rows = c.fetchall()
        tag_map = {}
        if rows:
            ids = [r["id"] for r in rows]
            c.execute("SELECT nt.note_id, t.name FROM note_tags nt JOIN tags t ON t.id=nt.tag_id "
                      f"WHERE nt.note_id IN ({','.join(['%s'] * len(ids))}) ORDER BY t.name", ids)
            for r in c.fetchall():
                tag_map.setdefault(r["note_id"], []).append(r["name"])

    results = [{
        "id": r["id"], "title": r["title"], "note_date": r["note_date"].isoformat(),
        "folder_name": r["folder_name"], "tags": tag_map.get(r["id"], []),
        "snippet": make_snippet(r["content"], terms),
    } for r in rows]
    return jsonify(results=results)


# ------------------------------------------------------------------- exportação
def note_to_md(n):
    """Markdown com front matter (compatível com Obsidian)."""
    head = ["---", f"title: {json.dumps(n['title'], ensure_ascii=False)}", f"date: {n['note_date']}"]
    if n["tags"]:
        head.append("tags: [" + ", ".join(n["tags"]) + "]")
    head.append("---")
    return "\n".join(head) + f"\n\n# {n['title']}\n\n{n['content']}\n"


PDF_CSS = """
@page { size: A4; margin: 2cm; }
body { font-family: Helvetica; font-size: 11pt; line-height: 1.45; color: #222; }
h1 { font-size: 21pt; margin-bottom: 2pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; }
.meta { color: #777; font-size: 9pt; margin-bottom: 14pt; }
code, pre { font-family: Courier; font-size: 9.5pt; background-color: #f0f0f0; }
pre { padding: 6pt; }
blockquote { border-left: 3pt solid #cccccc; padding-left: 8pt; color: #555; }
th, td { border: 1pt solid #bbbbbb; padding: 4pt; }
"""


def note_to_pdf(n):
    body = md_lib.markdown(n["content"], extensions=["fenced_code", "tables", "sane_lists", "nl2br"])
    y, m, d = n["note_date"].split("-")
    meta = f"{d}/{m}/{y}" + (" &nbsp;|&nbsp; " + ", ".join("#" + html.escape(t) for t in n["tags"]) if n["tags"] else "")
    doc = (f"<html><head><meta charset='utf-8'><style>{PDF_CSS}</style></head><body>"
           f"<h1>{html.escape(n['title'])}</h1><div class='meta'>{meta}</div>{body}</body></html>")
    buf = io.BytesIO()
    result = pisa.CreatePDF(doc, dest=buf, encoding="utf-8")
    if result.err:
        raise RuntimeError("Falha ao gerar o PDF")
    buf.seek(0)
    return buf


@app.get("/api/notes/<int:nid>/export")
def note_export(nid):
    fmt = request.args.get("format", "md")
    with cursor() as c:
        note = load_note(c, nid)
    if not note:
        return bad("Anotação não encontrada.", 404)
    name = safe_name(note["title"])
    if fmt == "pdf":
        return send_file(note_to_pdf(note), mimetype="application/pdf",
                         as_attachment=True, download_name=f"{name}.pdf")
    return send_file(io.BytesIO(note_to_md(note).encode("utf-8")), mimetype="text/markdown",
                     as_attachment=True, download_name=f"{name}.md")


@app.get("/api/export/all")
def export_all():
    with cursor() as c:
        c.execute("SELECT id, parent_id, name FROM folders")
        folders = {f["id"]: f for f in c.fetchall()}
        c.execute("SELECT id FROM notes")
        notes = [load_note(c, r["id"]) for r in c.fetchall()]

    def path_of(fid):
        parts = []
        while fid:
            parts.append(safe_name(folders[fid]["name"]))
            fid = folders[fid]["parent_id"]
        return "/".join(reversed(parts))

    buf, used = io.BytesIO(), set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for n in notes:
            base = (path_of(n["folder_id"]) + "/" if n["folder_id"] else "") + safe_name(n["title"])
            name = f"{base}.md" if base not in used else f"{base} ({n['id']}).md"
            used.add(base)
            z.writestr(name, note_to_md(n))
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True,
                     download_name="noteclass-backup.zip")


if __name__ == "__main__":
    app.run(debug=True)
