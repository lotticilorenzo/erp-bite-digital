import mimetypes
import os
import re
import uuid
import aiofiles
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from app.core.security import get_current_user
from app.models.models import User

router = APIRouter()

UPLOAD_DIR = os.path.join("private_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

_UPLOAD_ROOT = Path(UPLOAD_DIR).resolve()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp",  # immagini
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",  # documenti
    ".txt", ".md", ".csv", ".json",  # testo
    ".zip", ".rar",  # archivi
    ".mp4", ".mov", ".avi",  # video
    ".webm", ".ogg", ".wav", ".mp3",  # audio / vocali
}

# Extensions che vengono servite inline (sicure: processate o a basso rischio XSS)
_INLINE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".avi", ".webm", ".ogg", ".wav", ".mp3"}

# Magic bytes per validazione tipo reale (non solo estensione)
MAGIC_BYTES: dict[bytes, str] = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"GIF8": "image/gif",
    b"RIFF": "image/webp",
    b"%PDF": "application/pdf",
    b"PK\x03\x04": "application/zip",  # docx, xlsx, pptx sono zip
    b"OggS": "audio/ogg",
    b"ID3": "audio/mpeg",
    b"\x1a\x45\xdf\xa3": "video/webm",
}

# Filename sicuro: solo caratteri alfanumerici, trattino, underscore, punto
_SAFE_FILENAME_RE = re.compile(r"^[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]{1,10}$")


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    _auth: User = Depends(get_current_user),
):
    # 1. Validazione estensione
    original_name = file.filename or "unknown"
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Tipo di file non consentito: {ext}")

    # 2. Leggi file con limite dimensione
    CHUNK_SIZE = 1024 * 1024  # 1 MB chunks
    chunks: list[bytes] = []
    total_size = 0

    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File troppo grande. Limite: {MAX_FILE_SIZE // (1024*1024)} MB"
            )
        chunks.append(chunk)

    content = b"".join(chunks)

    # 3. Validazione magic bytes (tipo reale)
    detected = None
    for magic, mime in MAGIC_BYTES.items():
        if content.startswith(magic):
            detected = mime
            break
    if ext in {".jpg", ".jpeg"} and detected != "image/jpeg":
        raise HTTPException(status_code=400, detail="Contenuto del file non corrisponde all'estensione")
    if ext == ".png" and detected != "image/png":
        raise HTTPException(status_code=400, detail="Contenuto del file non corrisponde all'estensione")
    if ext == ".pdf" and detected != "application/pdf":
        raise HTTPException(status_code=400, detail="Contenuto del file non corrisponde all'estensione")
    if ext == ".ogg" and detected != "audio/ogg":
        raise HTTPException(status_code=400, detail="Contenuto del file non corrisponde all'estensione")
    if ext == ".mp3" and detected != "audio/mpeg":
        raise HTTPException(status_code=400, detail="Contenuto del file non corrisponde all'estensione")
    if ext == ".webm" and detected not in {"video/webm", None}:
        raise HTTPException(status_code=400, detail="Contenuto del file non corrisponde all'estensione")

    # 4. Salva con nome UUID (nessun path traversal possibile)
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    try:
        async with aiofiles.open(filepath, "wb") as out_file:
            await out_file.write(content)
    except Exception:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=500, detail="Errore durante il salvataggio del file")

    return {
        "url": f"/api/v1/uploads/{filename}",
        "download_url": f"/api/v1/uploads/{filename}",
        "filename": original_name,
        "size": total_size,
        "content_type": file.content_type,
    }


@router.get("/{filename}")
async def download_file(
    filename: str,
    _auth: User = Depends(get_current_user),
):
    """Authenticated file download with Content-Disposition enforcement."""
    # Validate filename to prevent path traversal
    if not _SAFE_FILENAME_RE.match(filename):
        raise HTTPException(status_code=400, detail="Nome file non valido")

    filepath = (_UPLOAD_ROOT / filename).resolve()
    if not str(filepath).startswith(str(_UPLOAD_ROOT)):
        raise HTTPException(status_code=400, detail="Percorso non consentito")

    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="File non trovato")

    ext = filepath.suffix.lower()
    mime_type, _ = mimetypes.guess_type(str(filepath))
    mime_type = mime_type or "application/octet-stream"

    disposition = "inline" if ext in _INLINE_EXTENSIONS else "attachment"

    return FileResponse(
        path=str(filepath),
        media_type=mime_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=3600",
        },
    )
