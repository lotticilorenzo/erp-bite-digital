import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User

router = APIRouter()

UPLOAD_DIR = os.path.join("static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Validazione estensione (opzionale, ma consigliata)
    # Per ora permettiamo tutto tranne eseguibili pericolosi
    forbidden_exts = {".exe", ".bat", ".sh", ".py", ".js"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext in forbidden_exts:
        raise HTTPException(status_code=400, detail="Tipo di file non consentito")

    # Nome file univoco per evitare sovrascritture
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    try:
        import aiofiles
        # CHUNK_SIZE di 1MB per bilanciare velocità e memoria
        CHUNK_SIZE = 1024 * 1024 
        
        async with aiofiles.open(filepath, "wb") as out_file:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                await out_file.write(chunk)
                
    except Exception as e:
        # Pulisci il file parziale in caso di errore
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=500, detail=f"Errore durante il salvataggio del file: {str(e)}")
    
    file_url = f"/static/uploads/{filename}"
    
    return {
        "url": file_url,
        "filename": file.filename,
        "size": os.path.getsize(filepath),
        "content_type": file.content_type
    }
