import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.security import get_current_user
from app.models.models import User

router = APIRouter()

UPLOAD_DIR = os.path.join("static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",  # immagini
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",  # documenti
    ".txt", ".md", ".csv", ".json",  # testo
    ".zip", ".rar",  # archivi
    ".mp4", ".mov", ".avi",  # video
}

# Magic bytes per validazione tipo reale (non solo estensione)
MAGIC_BYTES: dict[bytes, str] = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"GIF8": "image/gif",
    b"RIFF": "image/webp",
    b"%PDF": "application/pdf",
    b"PK\x03\x04": "application/zip",  # docx, xlsx, pptx sono zip
}


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    _auth: User = Depends(get_current_user),  # richiede autenticazione
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
    # SVG e text non hanno magic bytes affidabili — accettiamo solo per ext consentite
    # Per immagini, verifichiamo che il magic corrisponda all'estensione dichiarata
    if ext in {".jpg", ".jpeg"} and detected != "image/jpeg":
        raise HTTPException(status_code=400, detail="Contenuto del file non corrisponde all'estensione")
    if ext == ".png" and detected != "image/png":
        raise HTTPException(status_code=400, detail="Contenuto del file non corrisponde all'estensione")
    if ext == ".pdf" and detected != "application/pdf":
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
        "url": f"/static/uploads/{filename}",
        "filename": original_name,
        "size": total_size,
        "content_type": file.content_type,
    }
