import asyncio
import uuid
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import select, delete
from app.db.session import AsyncSessionLocal
from app.models.models import User, Risorsa, Task, Progetto, Cliente, UserRole, ProjectType, TaskStatus

async def seed():
    async with AsyncSessionLocal() as db:
        # 1. Pulizia task temporanee (per evitare duplicati sporchi)
        await db.execute(delete(Task).where(Task.titolo.like("Seed%")))
        
        # 2. Assicuriamoci di avere un Cliente e un Progetto
        result = await db.execute(select(Cliente).limit(1))
        cliente = result.scalar_one_or_none()
        if not cliente:
            cliente = Cliente(
                id=uuid.uuid4(),
                ragione_sociale="Bite Digital Client",
                attivo=True
            )
            db.add(cliente)
            await db.flush()
        
        result = await db.execute(select(Progetto).limit(1))
        progetto = result.scalar_one_or_none()
        if not progetto:
            progetto = Progetto(
                id=uuid.uuid4(),
                nome="Internal Design System",
                cliente_id=cliente.id,
                tipo=ProjectType.ONE_OFF,
                attivo=True
            )
            db.add(progetto)
            await db.flush()

        # 3. Creazione Risorse (Team)
        team_data = [
            ("Lorenzo", "Bite", "PM", 40, UserRole.ADMIN),
            ("Marco", "Rossi", "Senior Developer", 40, UserRole.DIPENDENTE),
            ("Sofia", "Bianchi", "UI/UX Designer", 40, UserRole.DIPENDENTE),
            ("Luca", "Ferrari", "Junior Dev", 32, UserRole.DIPENDENTE),
            ("Anna", "Conti", "Social Media Manager", 20, UserRole.FREELANCER),
        ]
        
        risorse_ids = []
        for nome, cognome, ruolo, ore, user_role in team_data:
            # Cerchiamo se l'utente esiste già
            email = f"{nome.lower()}@example.com"
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            
            if not user:
                user = User(
                    id=uuid.uuid4(),
                    nome=nome,
                    cognome=cognome,
                    email=email,
                    password_hash="hashed",
                    ruolo=user_role,
                    ore_settimanali=ore,
                    attivo=True
                )
                db.add(user)
                await db.flush()
            
            # Creazione Risorsa
            result = await db.execute(select(Risorsa).where(Risorsa.user_id == user.id))
            risorsa = result.scalar_one_or_none()
            if not risorsa:
                risorsa = Risorsa(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    nome=nome,
                    cognome=cognome,
                    ruolo=ruolo,
                    ore_settimanali=Decimal(str(ore)),
                    attivo=True
                )
                db.add(risorsa)
                await db.flush()
            risorse_ids.append(user.id)

        # 4. Creazione Task (Alcune assegnate, alcune no)
        today = date(2026, 4, 11) # Basato su metadata
        monday_this_week = date(2026, 4, 6)
        monday_next_week = date(2026, 4, 13)
        
        tasks_to_create = [
            # Assegnate questa settimana
            ("Seed: Setup Repository", risorse_ids[1], monday_this_week, 120),
            ("Seed: Database Schema", risorse_ids[1], monday_this_week + timedelta(days=1), 240),
            ("Seed: Wireframes Homepage", risorse_ids[2], monday_this_week, 480),
            ("Seed: Concept Social", risorse_ids[4], monday_this_week + timedelta(days=2), 180),
            ("Seed: Planning Meeting", risorse_ids[0], monday_this_week, 60),
            
            # Prossima settimana
            ("Seed: API Frontend", risorse_ids[1], monday_next_week, 300),
            ("Seed: Review Design", risorse_ids[0], monday_next_week + timedelta(days=1), 120),
            
            # Backlog (Non assegnate)
            ("Seed: Refactor Auth", None, None, 480),
            ("Seed: Analytics Dashboard", None, None, 600),
            ("Seed: Bugfix: Login layout", None, None, 60),
            ("Seed: SEO Optimization", None, None, 240),
            ("Seed: Client Feedback Review", None, None, 90),
        ]
        
        for titolo, uid, scadenza, stima in tasks_to_create:
            task = Task(
                id=uuid.uuid4(),
                titolo=titolo,
                assegnatario_id=uid,
                data_scadenza=scadenza,
                stima_minuti=stima,
                progetto_id=progetto.id,
                stato=TaskStatus.DA_FARE
            )
            db.add(task)
        
        await db.commit()
        print(f"Seed completato con successo: {len(tasks_to_create)} task create.")

if __name__ == "__main__":
    asyncio.run(seed())
