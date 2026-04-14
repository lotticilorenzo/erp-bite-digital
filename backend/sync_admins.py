import asyncio
from app.db.session import SessionLocal
from app.models.models import ChatCanale, ChatMembro, User
from sqlalchemy import select

async def sync():
    async with SessionLocal() as db:
        res = await db.execute(select(User).where(User.ruolo == 'ADMIN'))
        admins = res.scalars().all()
        
        res = await db.execute(select(ChatCanale))
        channels = res.scalars().all()
        
        added = 0
        for admin in admins:
            for ch in channels:
                res = await db.execute(select(ChatMembro).where(ChatMembro.canale_id == ch.id, ChatMembro.user_id == admin.id))
                if not res.scalar_one_or_none():
                    db.add(ChatMembro(canale_id=ch.id, user_id=admin.id, ruolo='ADMIN'))
                    added += 1
        if added > 0:
            await db.commit()
            print(f"Aggiunte {added} appartenenze ai canali per gli admin (ora visibili a Lorenzo)")
        else:
            print("Tutti gli admin, incluso Lorenzo, vedono già i canali.")

if __name__ == "__main__":
    asyncio.run(sync())
