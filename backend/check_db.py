import asyncio
from sqlalchemy import text
from app.db.session import engine

async def check():
    async with engine.connect() as conn:
        # Check task columns
        res = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tasks';
        """))
        cols = [r[0] for r in res.fetchall()]
        print("Tasks columns:", cols)

        # Check studio_node_type enum values
        try:
            res = await conn.execute(text("""
                SELECT enumlabel 
                FROM pg_enum 
                JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
                WHERE pg_type.typname = 'studio_node_type';
            """))
            vals = [r[0] for r in res.fetchall()]
            print("studio_node_type enum values:", vals)
        except Exception as e:
            print("Error checking enum:", e)

        # Check if studio_nodes table exists and its columns
        res = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'studio_nodes';
        """))
        cols_nodes = [r[0] for r in res.fetchall()]
        print("studio_nodes columns:", cols_nodes)

asyncio.run(check())
