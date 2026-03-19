from __future__ import annotations

import hashlib
import os
import re
import sqlite3
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


@dataclass(frozen=True)
class Settings:
    token: str
    data_dir: Path
    cors_origins: list[str]


def load_settings() -> Settings:
    token = os.environ.get("FACE_SYNC_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "FACE_SYNC_TOKEN is required (set env var). Example: export FACE_SYNC_TOKEN='...'"
        )
    data_dir = Path(os.environ.get("FACE_SYNC_DATA_DIR", "./face_sync_data")).resolve()
    raw_origins = os.environ.get("FACE_SYNC_CORS_ORIGINS", "*").strip()
    cors_origins = ["*"] if raw_origins == "*" else [o.strip() for o in raw_origins.split(",") if o.strip()]
    return Settings(token=token, data_dir=data_dir, cors_origins=cors_origins)


SETTINGS = load_settings()
DB_PATH = SETTINGS.data_dir / "captures.sqlite3"
FILES_DIR = SETTINGS.data_dir / "files"
PENDING_DIR = SETTINGS.data_dir / "pending_faces"


def db_connect() -> sqlite3.Connection:
    SETTINGS.data_dir.mkdir(parents=True, exist_ok=True)
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def db_init() -> None:
    with db_connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS captures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                name TEXT,
                source TEXT,
                filename TEXT NOT NULL,
                content_type TEXT NOT NULL,
                bytes INTEGER NOT NULL,
                sha256 TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at)"
        )
        conn.commit()


def require_auth(authorization: str | None) -> None:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization must be Bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if token != SETTINGS.token:
        raise HTTPException(status_code=403, detail="Invalid token")


app = FastAPI(title="Face Sync API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=SETTINGS.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
db_init()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "time": _now_iso()}

#
# Dropzone endpoints (FACESCAN_WEB_HANDOFF.md compatible)
# - POST /upload_face
# - GET  /list_faces
# - GET  /download_face/{name}  (deletes after successful download)
#

@app.post("/upload_face")
async def upload_face(
    authorization: Annotated[str | None, Header()] = None,
    image: Annotated[UploadFile, File()] = None,  # type: ignore[assignment]
) -> dict[str, Any]:
    """
    Minimal dropzone receiver for web-submitted face crops.
    Saves into FACE_SYNC_DATA_DIR/pending_faces/.
    """
    require_auth(authorization)
    if image is None:
        raise HTTPException(status_code=400, detail="Missing image file field")

    content_type = (image.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/jpg"}:
        raise HTTPException(status_code=415, detail="Only JPEG is supported for dropzone")

    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(data) > 3 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 3MB)")

    token = secrets.token_hex(4)
    filename = f"web_{_utc_stamp()}_{token}.jpg"
    path = PENDING_DIR / filename
    path.write_bytes(data)
    return {"ok": True, "filename": filename, "bytes": len(data), "created_at": _now_iso()}


@app.get("/list_faces")
def list_faces(
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    require_auth(authorization)
    items = []
    for p in sorted(PENDING_DIR.glob("*.jpg")):
        try:
            st = p.stat()
            items.append({"name": p.name, "bytes": st.st_size, "mtime": int(st.st_mtime)})
        except FileNotFoundError:
            continue
    return {"items": items}


_SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$")


@app.get("/download_face/{name}")
def download_face(
    name: str,
    authorization: Annotated[str | None, Header()] = None,
) -> FileResponse:
    require_auth(authorization)

    # Prevent path traversal
    if not _SAFE_NAME_RE.match(name) or "/" in name or "\\" in name:
        raise HTTPException(status_code=400, detail="Invalid name")

    path = (PENDING_DIR / name).resolve()
    if path.parent != PENDING_DIR.resolve():
        raise HTTPException(status_code=400, detail="Invalid path")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")

    # Delete after sending.
    def _delete() -> None:
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass

    return FileResponse(
        path=str(path),
        media_type="image/jpeg",
        filename=name,
        background=BackgroundTask(_delete),
    )


@app.post("/api/captures")
async def upload_capture(
    authorization: Annotated[str | None, Header()] = None,
    image: Annotated[UploadFile, File()] = None,  # type: ignore[assignment]
    name: Annotated[str | None, Form()] = None,
    source: Annotated[str | None, Form()] = None,
) -> dict[str, Any]:
    require_auth(authorization)

    if image is None:
        raise HTTPException(status_code=400, detail="Missing image file field")

    # Keep it simple: accept common image types.
    content_type = (image.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/jpg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail=f"Unsupported content-type: {content_type}")

    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    sha256 = hashlib.sha256(data).hexdigest()
    created_at = _now_iso()

    # Deterministic-ish filename: epoch + short hash
    ext = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }[content_type]
    stamp = int(time.time() * 1000)
    filename = f"{stamp}_{sha256[:12]}.{ext}"
    file_path = FILES_DIR / filename
    file_path.write_bytes(data)

    with db_connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO captures (created_at, name, source, filename, content_type, bytes, sha256)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (created_at, name, source, filename, content_type, len(data), sha256),
        )
        capture_id = int(cur.lastrowid)
        conn.commit()

    return {
        "id": capture_id,
        "created_at": created_at,
        "name": name,
        "source": source,
        "filename": filename,
        "sha256": sha256,
        "bytes": len(data),
    }


@app.get("/api/captures")
def list_captures(
    authorization: Annotated[str | None, Header()] = None,
    since: int = 0,
    limit: int = 100,
) -> dict[str, Any]:
    require_auth(authorization)
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be 1..500")

    with db_connect() as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, name, source, filename, content_type, bytes, sha256
            FROM captures
            WHERE id > ?
            ORDER BY id ASC
            LIMIT ?
            """,
            (since, limit),
        ).fetchall()

    items = [dict(r) for r in rows]
    return {"items": items, "next_since": (items[-1]["id"] if items else since)}


@app.get("/api/captures/{capture_id}/file")
def get_capture_file(
    capture_id: int,
    authorization: Annotated[str | None, Header()] = None,
) -> FileResponse:
    require_auth(authorization)

    with db_connect() as conn:
        row = conn.execute(
            "SELECT filename, content_type FROM captures WHERE id = ?",
            (capture_id,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    file_path = FILES_DIR / row["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")

    return FileResponse(
        path=str(file_path),
        media_type=row["content_type"],
        filename=row["filename"],
    )

