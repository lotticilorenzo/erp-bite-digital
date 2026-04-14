"""
Script one-shot per creare/aggiornare gli utenti reali di Bite Studio.
Eseguire con: docker exec bite_erp_backend python app/setup_users.py
"""
import asyncio
import sys
sys.path.insert(0, '/app')

from app.db.session import AsyncSessionLocal
from app.models.models import User, UserRole
from app.core.security import hash_password
from sqlalchemy import select

# ── CONFIGURAZIONE UTENTI ─────────────────────────────────────────────────────
# Password di default per ruolo (da cambiare al primo accesso)
PASSWORDS = {
    "ADMIN":       "BiteAdmin2025!",
    "DEVELOPER":   "BiteDev2025!",
    "DIPENDENTE":  "BiteTeam2025!",
}

USERS = [
    # email                               nome               cognome       ruolo
    ("francesco.ghirardi@bitestudio.com", "Francesco",       "Ghirardi",   "ADMIN"),
    ("federico.ravazzoni@bitestudio.com", "Federico",        "Ravazzoni",  "DIPENDENTE"),
    ("elia.bertolotti@bitestudio.com",    "Elia",            "Bertolotti", "DIPENDENTE"),
    ("lorenzo.lottici@bitestudio.com",    "Lorenzo",         "Lottici",    "DEVELOPER"),
    ("benedetta.faraboli@bitestudio.com", "Benedetta",       "Faraboli",   "DIPENDENTE"),
    ("alessia.trauzzi@bitestudio.com",    "Alessia",         "Trauzzi",    "DIPENDENTE"),
    ("luca.bottioni@bitestudio.com",      "Luca",            "Bottioni",   "ADMIN"),
    ("gabriele.timofte@bitestudio.com",   "Gabriele",        "Timofte",    "DIPENDENTE"),
    ("vittoria.mangora@bitestudio.com",   "Vittoria",        "Mangora",    "DIPENDENTE"),
    ("alessandro.mora@bitestudio.com",    "Alessandro",      "Mora",       "ADMIN"),
    ("francesco.marchi@bitestudio.com",   "Francesco",       "Marchi",     "DIPENDENTE"),
    ("nhielle.cacao@bitestudio.com",      "Nhielle",         "Cacao",      "DIPENDENTE"),
]

async def main():
    async with AsyncSessionLocal() as db:
        created = 0
        updated = 0
        for email, nome, cognome, ruolo_str in USERS:
            ruolo = UserRole(ruolo_str)
            password = PASSWORDS[ruolo_str]
            
            res = await db.execute(select(User).where(User.email == email))
            user = res.scalar_one_or_none()
            
            if user:
                # Aggiorna ruolo e password
                user.ruolo = ruolo
                user.password_hash = hash_password(password)
                user.attivo = True
                updated += 1
                print(f"  ✅ UPDATED: {email} → {ruolo_str}")
            else:
                # Crea nuovo utente
                new_user = User(
                    nome=nome,
                    cognome=cognome,
                    email=email,
                    password_hash=hash_password(password),
                    ruolo=ruolo,
                    attivo=True,
                )
                db.add(new_user)
                created += 1
                print(f"  ✨ CREATED: {email} → {ruolo_str}")
        
        await db.commit()
        print(f"\n{'─'*50}")
        print(f"  Completato: {created} creati, {updated} aggiornati")
        print(f"\n  PASSWORD DI DEFAULT:")
        for ruolo, pwd in PASSWORDS.items():
            print(f"    {ruolo:<15} → {pwd}")
        print(f"\n  ⚠️  Comunicare le credenziali agli utenti!")
        print(f"{'─'*50}")

if __name__ == "__main__":
    asyncio.run(main())
