import sys
import os
import uuid

# Aggiungi il path per poter importare i moduli di app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.models.models import WikiCategoria, WikiArticolo, User
from sqlalchemy import select
import asyncio

ARTICOLI = {
    # (The same ARTICOLI dictionary remains here)

    "Panoramica del Sistema": """
### Cos'è Bite ERP e a cosa serve
Bite ERP è il "cervello digitale" dell'agenzia. Ti permette di avere tutto sotto controllo in un unico posto: i progetti dei clienti, le ore lavorate dal team, i preventivi, le fatture e le comunicazioni interne. Dimentica i mille fogli Excel: qui troverai ogni informazione in modo rapido e ordinato.

### Come accedere (login)
Per entrare, vai all'indirizzo web fornito dall'amministrazione e inserisci la tua **Email** e **Password**. Se non le ricordi, clicca su "Password Dimenticata" per ricevere un link di recupero nella tua casella email.

### Struttura generale (ERP + Studio OS)
Il sistema è diviso in due grandi cuori pulsanti, accessibili tramite i pulsanti in basso a sinistra nel menu:
- **L'area ERP (Gestione Agenzia)**: Dedicata alla parte amministrativa, manageriale e contabile. Questa sezione è usata principalmente da amministratori.
- **L'area Studio OS (Project Management)**: L'ambiente di lavoro quotidiano per il team. È lo spazio dove trovi le tue "Task" e azioni il cronometro.

### Come navigare tra le sezioni
Sulla sinistra troverai sempre una *sidebar* (barra laterale). Cliccando sulle varie voci cambierai la schermata principale. Puoi espandere o restringere la sidebar cliccando sull'icona apposita.
""",

    "Sezione ERP - Gestione Agenzia": """
### Dashboard
La Dashboard è la bussola dell'agenzia. 
- **Cosa mostra**: Un riepilogo a colpo d'occhio della salute aziendale.
- **Come leggere i KPI**: Troverai dei "blocchetti" (Card) colorati con numeri chiave.
- **Come interpretare le scadenze**: Una lista ti avviserà dei preventivi o delle commesse prossime alla scadenza.

### Clienti
- **Come creare un cliente**: Vai su "Clienti" e clicca il grande pulsante "+ Nuovo Cliente".
- **Come modificare i dati**: Clicca su un cliente esistente per entrare nella sua scheda e premi l'icona a forma di matita o il bottone "Modifica".
- **Come caricare il logo**: All'interno del dettaglio cliente, fai click sull'avatar/logo per caricarne uno nuovo dal tuo computer.

### Progetti
- **Come creare un progetto**: Entra nei progetti e usa il bottone aggiungi ("+").
- **Come usare Gantt e Chat**: Clicca su **Gantt / Timeline** per vedere un calendario visivo di come si spalmano i lavori. Clicca su **Chat Progetto** per scambiare messaggi con chi ci sta lavorando in tempo reale.

### Commesse
- **Cos'è una commessa**: È l'ordine d'acquisto ufficiale. Le commesse contengono il monte ore pattuito.
- **Come generare il PDF**: Clicca sui tre puntini a fianco alla commessa o nel dettaglio e scegli "Scarica PDF".

### Timesheet
- **Come inserire le ore lavorate**: Anche se puoi inserire ore manualmente, ti consigliamo di usare il Timer automatico nello Studio OS.
- **Come approvare i timesheet (admin)**: Alla fine di un mese, gli amministratori possono vedere la tabella globale con i tempi di tutti e validarle.

### Preventivi
- **Come creare un preventivo**: Clicca "+ Nuovo" in "Preventivi" e usa il modulo "Voci Preventivo".
- **Come convertire in commessa**: Se il cliente accetta, clicca sui tre puntini del preventivo e premi **"Converti in Commessa"**.

### Budget e Analytics
- **Budget vs reale**: Grafici che mostrano spese/entrate previste vs quelle vere.
- **Drill-down**: Cliccando su zone del grafico, scendi nel dettaglio per capire ad esempio *chi* nel team ha generato determinate ore.

### CRM Pipeline
- **Gestire i lead**: Trascina semplicemente il potenziale cliente col mouse dalla colonna "Contatto" alla colonna "Negoziazione" nel Kanban board.
""",

    "Studio OS - Project Management": """
### Come funziona Studio OS
Lo Studio OS è per "Il sudore della fronte e l'operatività". Qui è dove si progetta la giornata.
- **Come navigare tra clienti e progetti**: Sulla sinistra, in "Progetti Attivi", i progetti sono raggruppati sotto al nome del Cliente. Fai click sull'icona a freccetta per svelarne i progetti.

### Gestione Task
- **Come creare una task**: Scegli il progetto e clicca "+ AGGIUNGI TASK" nella finestra centrale. Oppure premi il grande tasto lilla "+ NUOVO".
- **Come assegnare a un operatore**: Nella finestrella della task, clicca l'icona e scegli il nome del tuo collega.
- **Come cambiare stato**: Cambia il flag in alto (da "Nuovo" a "In Corso", e poi "Completato").
- **Come aggiungere subtask**: Aggiungi "Sotto-task", cioè piccole micro-azioni spuntabili.

### Timer
- **Come avviare il timer**: Sopra il menù o dentro la scheda task, c'è un grande pulsante "Avvia".
- **Come mettere in pausa o fermare**: Usa "Pausa" o "Stop" quando chiudi il compito.
- **Come salvare le ore**: Quando premi *Stop*, quelle ore vengono magicamente inviate al *Timesheet*. Tu non devi fare nient'altro!

### Viste disponibili
- **Vista Lista**: Come una tabella ordinata pulita.
- **Vista Board/Kanban**: Un tabellone a colonne.
- **Vista Calendario**: Per scadenze mensili.
- **Vista Team**: Vedi colonne col nome dei tuoi colleghi e le loro task.
- **Vista Gantt**: Il piano lungo per vedere dipendenze tra task e scadenze nel tempo.
""",

    "Strumenti Trasversali": """
### Notifiche
- **Tipi di notifiche**: Ricevi avvisi quando: 1) ti assegnano una Task, 2) qualcuno ti menziona, 3) un progetto in cui sei scade oggi.
- **Come gestire**: Clicca sulla campanellina per visualizzarle e smarcarle come lette.

### Chat per Progetto
- **Chat Progetto**: Tab interna ad ogni progetto.
- **Menzioni**: Usa `@TuoNome` per inviare notifiche istantanee.
- **Reazioni**: Aggiungi emoji (👍, 🚀) ai messaggi dei tuoi compagni.

### Impostazioni
- **Profilo e foto**: Cambia la tua faccia o dati anagrafici dal menu in basso a sinistra > "Profilo".
- **Tema e colori**: Scegli il tuo tema visivo (Light mode o Dark mode resposivo all'interno del menù e del "Theme Panel").
""",

    "Livelli di Accesso": """
Non tutti vedono tutto. Così si evitano errori catastrofici o panico per dati in eccesso.

### MANUTENTORE (Lorenzo)
- È "Dio" all'interno del sistema (Backup, Dati Distruttivi, Migrazioni).

### ADMIN (Titolare agenzia)
- Può invitare o bloccare operatori.
- Può leggere completamente la **Sezione ERP Manageriale** e i dati Finanziari ("I Soldi").
- Può guardare la dashboard vitale e approvare i timesheet.

### COLLABORATORE (Operatori del team)
- **Vede:** Solo l'interfaccia **Studio OS**. Vede i suoi compiti (Task), il timer, la chat e solo il proprio *Timesheet*. 
- **NON vede:** Prezzi delle commesse, stipendi dei colleghi, preventivi ai clienti o area Finanze. Zero.
""",

    "Flusso di Lavoro Tipico": """
### Flusso mensile per il titolare (Admin):
1. Arriva il 1° del mese, entra su ERP e usa **Crea Commessa** mensile per cliente *PippoSrl*.
2. Si dirige in *Studio OS* e dal progetto "Pippo Marketing", crea 5 **Task** da sbrigare.
3. Usando `@` e la tendina assegna i task al suo team.
4. Va occasionalmente su *Studio OS* a vederle completare o cambiare di stato.
5. Alla fine del mese approva i *Timesheet*.
6. Visita la **Dashboard Analytics** per vedere marginalità e utili effettivi.

### Flusso quotidiano per un operatore:
1. Caffè, pc acceso, apre il gestionale su **Studio OS**.
2. Vede le task "Da Fare" assegnate a se stesso.
3. Apre la sua task più urgente e schiaccia in alto **Avvia Timer**.
4. Sposta la task su "In Corso".
5. Quando è pronta e completata, preme **Stop Timer** inviando le ore al totale di fine mese.
""",

    "FAQ - Domande Frequenti": """
- **Come faccio se dimentico la password?**
  Dalla schermata di Login clikka "Password dimenticata?". Metti la tua mail lavorativa e avrai magicamente il link di reset.

- **Come vedo quanto tempo ho lavorato?**
  Clicca su `Generale` > `Timesheet` sulla sinistra (se abilitato per te). Troverai il calendario delle timbrature.

- **Come contatto il team su un progetto?**
  Vai sul Progetto in questione, apri la cartella `Chat Progetto` e usa le Menzioni `@Nome`.

- **Come vedo le scadenze di oggi?**
  Lo Studio OS nella pagina iniziale Mostra attività in scadenza proprio oggi evidenziate pesantemente.

- **Come aggiungo un nuovo cliente?**
  Devi avere permessi Admin! Poi da "Gestione" > "Clienti", clicca "Nuovo Cliente".
"""
}

async def seed():
    async with AsyncSessionLocal() as db:
        try:
            # Cerca categoria
            result = await db.execute(select(WikiCategoria).where(WikiCategoria.nome == "Guide e Tutorial"))
            cat = result.scalar_one_or_none()
            if not cat:
                cat = WikiCategoria(nome="Guide e Tutorial", icona="BookOpen", ordine=1)
                db.add(cat)
                await db.commit()
                await db.refresh(cat)
                print(f"Creato categoria '{cat.nome}'")

            # Cerca il main user per author_id (di solito l'admin)
            result = await db.execute(select(User).order_by(User.created_at.asc()))
            main_user = result.scalars().first()
            if not main_user:
                print("Nessun utente trovato per impostarlo come autore.")
                return

            added = 0
            for title, content in ARTICOLI.items():
                if title.startswith("# (The"):
                    continue
                result = await db.execute(select(WikiArticolo).where(
                    WikiArticolo.titolo == title, 
                    WikiArticolo.categoria_id == cat.id
                ))
                art = result.scalar_one_or_none()
                if not art:
                    art = WikiArticolo(
                        categoria_id=cat.id,
                        titolo=title,
                        contenuto=content.strip(),
                        autore_id=main_user.id,
                        pubblicato=True
                    )
                    db.add(art)
                    print(f"Creato articolo '{title}'")
                    added += 1
                else:
                    art.contenuto = content.strip()
                    print(f"Aggiornato articolo '{title}'")
            
            await db.commit()
            print(f"Success! {added} articoli creati/aggiornati nella Wiki.")
        except Exception as e:
            await db.rollback()
            print(f"Errore durante l'importazione: {str(e)}")

if __name__ == "__main__":
    asyncio.run(seed())
