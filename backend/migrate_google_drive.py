import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "bite.db")

def migrate():
    if not os.path.exists(db_path):
        print(f"Database non trovato in {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Controlla se la colonna esiste già
        cursor.execute("PRAGMA table_info(clienti)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if "google_drive_url" not in columns:
            print("Aggiunta colonna google_drive_url alla tabella clienti...")
            cursor.execute("ALTER TABLE clienti ADD COLUMN google_drive_url VARCHAR(500)")
            conn.commit()
            print("Migrazione completata con successo.")
        else:
            print("La colonna google_drive_url esiste già.")

    except Exception as e:
        print(f"Errore durante la migrazione: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
