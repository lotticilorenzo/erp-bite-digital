import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def migrate():
    db = AsyncSessionLocal()
    try:
        print("Creating chat tables...")
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS chat_messaggi (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                progetto_id UUID REFERENCES progetti(id) ON DELETE CASCADE,
                autore_id UUID REFERENCES users(id),
                contenuto TEXT NOT NULL,
                tipo VARCHAR(20) DEFAULT 'testo',
                risposta_a UUID REFERENCES chat_messaggi(id) ON DELETE SET NULL,
                modificato BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS chat_reazioni (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                messaggio_id UUID REFERENCES chat_messaggi(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id),
                emoji VARCHAR(10) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(messaggio_id, user_id, emoji)
            );
        """))
        await db.commit()
        print("Chat tables created successfully.")
    except Exception as e:
        print(f"Error creating chat tables: {e}")
        await db.rollback()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(migrate())
