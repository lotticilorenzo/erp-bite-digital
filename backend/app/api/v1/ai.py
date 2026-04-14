import logging

from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user
from app.models.models import User
from app.schemas.schemas import AIChatRequest, AIChatResponse
import httpx
import os
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-3-5-sonnet-20240620"

@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    request: AIChatRequest,
    current_user: User = Depends(get_current_user)
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Service not configured"
        )

    system_prompt = """
    Sei l'Assistente AI di Bite Digital, un'agenzia di performance marketing.
    Il tuo compito è aiutare i membri del team a navigare nei dati gestionali.
    Ti verranno forniti dei dati di contesto in formato JSON riguardanti:
    - KPI del mese (fatturato, margine, ore)
    - Lista clienti attivi
    - Commesse/Progetti del mese corrente

    Usa questi dati per rispondere in modo professionale, conciso e utile.
    Se un dato non è presente nel contesto, dillo chiaramente. Non inventare dati.
    Rispondi sempre in italiano, con un tono premium, proattivo e business-oriented.
    """

    # Prepare context summary for Claude
    context_str = json.dumps(request.context, indent=2) if request.context else "Nessun contesto fornito."

    messages = [
        {
            "role": "user",
            "content": f"Dati di contesto:\n{context_str}\n\nDomanda: {request.message}"
        }
    ]

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": CLAUDE_MODEL,
                    "max_tokens": 1024,
                    "system": system_prompt,
                    "messages": messages
                }
            )
            
            if response.status_code != 200:
                # Logghiamo internamente il dettaglio, mai esposto al client
                try:
                    error_msg = response.json().get("error", {}).get("message", response.text)
                except Exception:
                    error_msg = response.text
                logger.error(
                    "Claude API error %s: %s",
                    response.status_code,
                    error_msg,
                )
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="AI Service temporarily unavailable"
                )
            
            data = response.json()
            ai_text = data["content"][0]["text"]
            
            return AIChatResponse(response=ai_text)
            
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Service temporarily unavailable"
        )
    except HTTPException:
        raise  # re-raise senza alterare il messaggio già sicuro
    except Exception as e:
        logger.exception("Unhandled error in AI chat endpoint")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI Service temporarily unavailable"
        )
