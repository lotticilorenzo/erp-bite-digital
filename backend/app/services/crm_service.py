import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import CRMLead, CRMActivity, CRMStage, User
from decimal import Decimal

class CRMService:
    @staticmethod
    async def calculate_lead_score(db: AsyncSession, lead_id: uuid.UUID) -> int:
        """
        Calcola il lead score basandosi su:
        - Valore stimato (+20 se > 5000)
        - Data di creazione (freschezza)
        - Ultima attività (+10 per ogni attività recente, -5 per ogni settimana di inattività)
        - Stadio (più avanzato = più punti)
        """
        lead = await db.get(CRMLead, lead_id)
        if not lead:
            return 0
        
        score = 0
        
        # 1. Valore
        if lead.valore_stimato > 10000: score += 30
        elif lead.valore_stimato > 5000: score += 20
        elif lead.valore_stimato > 1000: score += 10
        
        # 2. Probabilità
        score += int(lead.probabilita_chiusura / 2)
        
        # 3. Attività Recenti
        query = select(CRMActivity).where(CRMActivity.lead_id == lead_id).order_by(CRMActivity.data_attivita.desc())
        result = await db.execute(query)
        attivita = result.scalars().all()
        
        if attivita:
            ultima_data = attivita[0].data_attivita
            diff_giorni = (datetime.now(ultima_data.tzinfo) - ultima_data).days
            
            # Bonus per attività negli ultimi 3 giorni
            if diff_giorni <= 3: score += 25
            elif diff_giorni <= 7: score += 15
            elif diff_giorni > 30: score -= 20 # Penalità per abbandono
            
            # Bonus per numero attività
            score += min(len(attivita) * 5, 25)
        else:
            score -= 10 # Nessuna attività registrata
            
        return max(0, min(100, score))

    @staticmethod
    async def log_activity(
        db: AsyncSession, 
        lead_id: uuid.UUID, 
        tipo: str, 
        descrizione: str, 
        autore_id: uuid.UUID,
        activity_metadata: Optional[dict] = None
    ):
        attivita = CRMActivity(
            lead_id=lead_id,
            tipo=tipo,
            descrizione=descrizione,
            autore_id=autore_id,
            activity_metadata=activity_metadata
        )
        db.add(attivita)
        await db.flush() # Ensure ID is assigned if needed, although not strictly necessary here
        
        # Aggiorna il lead score dopo ogni attività
        lead = await db.get(CRMLead, lead_id)
        if lead:
            new_score = await CRMService.calculate_lead_score(db, lead_id)
            lead.lead_score = new_score
            
        await db.commit()
        return attivita

    @staticmethod
    async def send_mock_email(db: AsyncSession, lead_id: uuid.UUID, subject: str, body: str, autore_id: uuid.UUID):
        """Simula l'invio di una email e la logga nel CRM"""
        lead = await db.get(CRMLead, lead_id)
        if not lead or not lead.email:
            raise Exception("Lead non trovato o email mancante")
            
        descrizione = f"EMAIL INVIATA\nOggetto: {subject}\n\n{body}"
        return await CRMService.log_activity(
            db, 
            lead_id, 
            "EMAIL", 
            descrizione, 
            autore_id, 
            activity_metadata={"subject": subject, "status": "SENT"}
        )
