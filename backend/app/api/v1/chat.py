import uuid
import json
import re
from datetime import datetime
from typing import List, Dict, Optional, Set
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, Body, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, and_, text
from sqlalchemy.orm import joinedload, selectinload

from app.db.session import get_db
from app.core.security import get_current_user, get_user_from_token
from app.models.models import ChatMessaggio, ChatReazione, User, Progetto, ChatCanale, ChatMembro, UserRole
from app.schemas.schemas import ChatMessaggioRead, ChatMessaggioCreate, ChatMessaggioUpdate, ChatReazioneRead, ChatCanaleOut, ChatMembroOut, UserOut

router = APIRouter()

# ═══════════════════════════════════════════════════════
# WEBSOCKET MANAGER
# ═══════════════════════════════════════════════════════

class ConnectionManager:
    def __init__(self):
        # user_id -> list of active websockets
        self.active_connections: Dict[uuid.UUID, List[WebSocket]] = {}
        # user_id -> presence status
        self.user_status: Dict[uuid.UUID, str] = {}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket):
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        self.user_status[user_id] = "online"
        await self.broadcast_presence(user_id, "online")

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                self.user_status[user_id] = "offline"
                return True # Completamente offline
        return False

    async def broadcast_presence(self, user_id: uuid.UUID, status: str):
        message = {
            "type": "user_presence",
            "user_id": str(user_id),
            "status": status
        }
        await self.broadcast_globally(message)

    async def broadcast_globally(self, message: dict):
        payload = json.dumps(message)
        for connections in self.active_connections.values():
            for connection in connections:
                try:
                    await connection.send_text(payload)
                except:
                    pass

    async def broadcast_to_channel(self, db: AsyncSession, canal_id: uuid.UUID, message: dict, skip_user: Optional[uuid.UUID] = None):
        """Invia un messaggio solo ai membri del canale che sono online (Ottimizzato)."""
        # 1. Recupera i membri del canale (Otteniamo direttamente da DB per consistenza, ma il loop ora è mirato)
        stmt = select(ChatMembro.user_id).where(ChatMembro.canale_id == canal_id)
        res = await db.execute(stmt)
        member_ids = res.scalars().all()
        
        payload = json.dumps(message)
        
        # 2. Loop mirato solo sui membri: O(Membri Canale) invece di O(Utenti Totali Online)
        for user_id in member_ids:
            if skip_user and user_id == skip_user:
                continue
            
            # Recupera le connessioni attive per questo specifico utente
            connections = self.active_connections.get(user_id)
            if connections:
                for connection in connections:
                    try:
                        await connection.send_text(payload)
                    except:
                        # La connessione potrebbe essere chiusa ma non ancora rimossa dal manager
                        pass

manager = ConnectionManager()

# ═══════════════════════════════════════════════════════
# REST API - CHANNELS
# ═══════════════════════════════════════════════════════

@router.get("/channels", response_model=List[ChatCanaleOut])
async def get_channels(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Recupera tutti i canali dell'utente con l'anteprima dell'ultimo messaggio (Ottimizzato)."""
    # ── ENSURE GENERAL CHANNEL EXISTS & USER IS MEMBER ────────────────
    # Cerca il canale GENERAL
    stmt_gen = select(ChatCanale).where(ChatCanale.tipo == 'GENERAL')
    res_gen = await db.execute(stmt_gen)
    general_channel = res_gen.scalar_one_or_none()
    
    if not general_channel:
        # Crea il canale generale se non esiste
        general_channel = ChatCanale(
            id=uuid.uuid4(),
            nome="Chat Generale",
            tipo="GENERAL",
            logo_url="https://api.dicebear.com/7.x/shapes/svg?seed=general"
        )
        db.add(general_channel)
        await db.flush()
        
        # Aggiungi un messaggio di benvenuto
        welcome_msg = ChatMessaggio(
            id=uuid.uuid4(),
            canale_id=general_channel.id,
            autore_id=current_user.id,
            contenuto="Benvenuti nella Chat Generale di Bite! Qui possiamo collaborare e scambiare aggiornamenti veloci con tutto il team. 🚀",
            tipo="testo"
        )
        db.add(welcome_msg)
        
        # Aggiungi tutti gli utenti attivi (inizializzazione)
        from app.services.services import list_users
        all_users = await list_users(db, attivo=True)
        for u in all_users:
            db.add(ChatMembro(canale_id=general_channel.id, user_id=u.id, ruolo='MEMBER'))
        await db.commit()
    else:
        # Verifica se l'utente corrente è membro (Lazy membership)
        stmt_m = select(ChatMembro).where(ChatMembro.canale_id == general_channel.id, ChatMembro.user_id == current_user.id)
        res_m = await db.execute(stmt_m)
        if not res_m.scalar_one_or_none():
            db.add(ChatMembro(canale_id=general_channel.id, user_id=current_user.id, ruolo='MEMBER'))
            await db.commit()

    # 1. Recupera i canali (inclusi quelli appena aggiunti/creati)
    stmt = select(ChatCanale).join(ChatMembro).where(ChatMembro.user_id == current_user.id)\
        .options(selectinload(ChatCanale.membri).joinedload(ChatMembro.user))
    res = await db.execute(stmt)
    channels = res.scalars().all()
    
    if not channels:
        return []

    channel_ids = [c.id for c in channels]

    # 2. Bulk fetch dell'ultimo messaggio per ogni canale (Evita N+1)
    # Usiamo una subquery per trovare il created_at massimo per ogni canale
    subq = select(
        ChatMessaggio.canale_id,
        func.max(ChatMessaggio.created_at).label("latest")
    ).where(ChatMessaggio.canale_id.in_(channel_ids)).group_by(ChatMessaggio.canale_id).subquery()

    last_msgs_stmt = select(ChatMessaggio).join(
        subq, and_(
            ChatMessaggio.canale_id == subq.c.canale_id,
            ChatMessaggio.created_at == subq.c.latest
        )
    )
    lm_res = await db.execute(last_msgs_stmt)
    # Raggruppiamo per canale_id (in caso di timestamp identici)
    last_messages_map = {m.canale_id: m for m in lm_res.scalars().all()}
    
    out = []
    for c in channels:
        last_msg = last_messages_map.get(c.id)
        c_dict = ChatCanaleOut.model_validate(c).model_dump()
        
        # Gestione Nome per chat dirette (DM)
        if c.tipo == 'DIRECT':
            other_member = next((m for m in c.membri if m.user_id != current_user.id), None)
            if other_member and other_member.user:
                c_dict["nome"] = f"{other_member.user.nome} {other_member.user.cognome}"
                c_dict["logo_url"] = other_member.user.avatar_url
            else:
                c_dict["nome"] = "Chat Privata"

        if last_msg:
            c_dict["last_message"] = last_msg.contenuto if last_msg.tipo == 'testo' else '[Allegato]'
            c_dict["last_message_at"] = last_msg.created_at
        
        # Unread count (mocked)
        c_dict["unread_count"] = 0
        out.append(c_dict)
    
    # Ordina per attività recente (Safe timezone comparison)
    def get_sort_key(x):
        dt = x.get("last_message_at") or x.get("created_at")
        # Assicuriamoci che sia naive per il confronto sicuro (Postgres TIMESTAMPTZ vs TIMESTAMP)
        if dt and dt.tzinfo:
            return dt.replace(tzinfo=None)
        return dt

    return sorted(out, key=get_sort_key, reverse=True)

@router.get("/users", response_model=List[UserOut])
async def get_chat_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ritorna la lista di tutti i collaboratori attivi per iniziare nuove chat."""
    from app.services.services import list_users
    return await list_users(db, attivo=True)

@router.post("/channels/direct", response_model=ChatCanaleOut)
async def get_or_create_direct_channel(
    other_user_id: uuid.UUID = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Recupera o crea una chat privata (DM) tra l'utente corrente e un altro."""
    if other_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Non puoi iniziare una chat con te stesso")

    # Cerca un canale DIRECT che abbia ENTRAMBI gli utenti come membri
    # (Metodo robusto: cerca canali DIRECT di cui l'utente corrente è membro, 
    # poi controlla se l'altro utente è pure membro dello STESSO canale)
    stmt = text("""
        SELECT c.id FROM chat_canali c
        JOIN chat_membri m1 ON c.id = m1.canale_id
        JOIN chat_membri m2 ON c.id = m2.canale_id
        WHERE c.tipo = 'DIRECT' 
        AND m1.user_id = :u1 
        AND m2.user_id = :u2
        LIMIT 1
    """)
    res = await db.execute(stmt, {"u1": current_user.id, "u2": other_user_id})
    existing_id = res.scalar()

    if existing_id:
        # Recupera il canale esistente
        chan_stmt = select(ChatCanale).where(ChatCanale.id == existing_id)\
            .options(selectinload(ChatCanale.membri).joinedload(ChatMembro.user))
        chan_res = await db.execute(chan_stmt)
        channel = chan_res.scalar_one()
    else:
        # Crea nuovo canale DIRECT
        channel = ChatCanale(
            id=uuid.uuid4(),
            nome="Direct Chat",
            tipo="DIRECT"
        )
        db.add(channel)
        await db.flush()
        
        # Aggiungi entrambi i membri
        db.add(ChatMembro(canale_id=channel.id, user_id=current_user.id, ruolo='MEMBER'))
        db.add(ChatMembro(canale_id=channel.id, user_id=other_user_id, ruolo='MEMBER'))
        await db.commit()
        await db.refresh(channel)
        
        # Ricarica con relazioni per la risposta
        chan_stmt = select(ChatCanale).where(ChatCanale.id == channel.id)\
            .options(selectinload(ChatCanale.membri).joinedload(ChatMembro.user))
        chan_res = await db.execute(chan_stmt)
        channel = chan_res.scalar_one()

    # Formatta risposta
    c_dict = ChatCanaleOut.model_validate(channel).model_dump()
    other_member = next((m for m in channel.membri if m.user_id != current_user.id), None)
    if other_member and other_member.user:
        c_dict["nome"] = f"{other_member.user.nome} {other_member.user.cognome}"
        c_dict["logo_url"] = other_member.user.avatar_url
    
    return c_dict

@router.post("/channels/{canal_id}/members", tags=["Admin"])
async def manage_members(
    canal_id: uuid.UUID,
    user_ids: List[uuid.UUID] = Body(...),
    action: str = Query("add"), # add, remove
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli Admin possono gestire i membri dei canali")
    
    if action == "add":
        for uid in user_ids:
            # Check if already member
            exists = await db.execute(select(ChatMembro).where(ChatMembro.canale_id == canal_id, ChatMembro.user_id == uid))
            if not exists.scalar_one_or_none():
                db.add(ChatMembro(canale_id=canal_id, user_id=uid))
    else:
        for uid in user_ids:
            await db.execute(text("DELETE FROM chat_membri WHERE canale_id = :cid AND user_id = :uid"), {"cid": canal_id, "uid": uid})
    
    await db.commit()
    return {"success": True}

# ═══════════════════════════════════════════════════════
# WEBSOCKET ENDPOINT
# ═══════════════════════════════════════════════════════

@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: AsyncSession = Depends(get_db)):
    # Accettiamo subito la connessione per stabilità Handshake con Proxy
    await websocket.accept()
    
    user = await get_user_from_token(db, token)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        await manager.connect(user.id, websocket)
    except Exception as e:
        print(f"WS Manager Error: {e}")
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "typing":
                await manager.broadcast_to_channel(db, uuid.UUID(message["channel_id"]), {
                    "type": "user_typing",
                    "user_id": str(user.id),
                    "user_nome": f"{user.nome} {user.cognome}",
                    "is_typing": message["is_typing"],
                    "channel_id": message["channel_id"]
                }, skip_user=user.id)
            
            elif message["type"] == "message_seen":
                channel_id = uuid.UUID(message["channel_id"])
                now = datetime.utcnow().isoformat()
                await manager.broadcast_to_channel(db, channel_id, {
                    "type": "message_seen",
                    "user_id": str(user.id),
                    "last_seen_at": now,
                    "channel_id": str(channel_id)
                }, skip_user=user.id)

    except WebSocketDisconnect:
        if manager.disconnect(user.id, websocket):
            await manager.broadcast_presence(user.id, "offline")
    except Exception as e:
        print(f"WS Error: {e}")
        manager.disconnect(user.id, websocket)

# ═══════════════════════════════════════════════════════
# REST API - MESSAGES
# ═══════════════════════════════════════════════════════

@router.get("/channels/{canal_id}/messages", response_model=List[ChatMessaggioRead])
async def get_messages(
    canal_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verifica se l'utente è membro del canale
    stmt_member = select(ChatMembro).where(ChatMembro.canale_id == canal_id, ChatMembro.user_id == current_user.id)
    res_member = await db.execute(stmt_member)
    if not res_member.scalar_one_or_none() and current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non hai accesso a questo canale")

    stmt = select(ChatMessaggio).options(
        joinedload(ChatMessaggio.autore),
        selectinload(ChatMessaggio.reazioni).joinedload(ChatReazione.user)
    ).where(ChatMessaggio.canale_id == canal_id)\
     .order_by(ChatMessaggio.created_at.desc())\
     .limit(limit).offset(offset)
    
    result = await db.execute(stmt)
    messages = result.scalars().all()
    
    for m in messages:
        m.autore_nome = f"{m.autore.nome} {m.autore.cognome}" if m.autore else "Anonimo"
        for r in m.reazioni:
            r.user_nome = f"{r.user.nome} {r.user.cognome}" if r.user else "Anonimo"
            
    return sorted(messages, key=lambda x: x.created_at)

@router.post("/messages", response_model=ChatMessaggioRead)
async def send_message(
    message_in: ChatMessaggioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.services.notification_service import create_notification
    
    # Verify access
    stmt_member = select(ChatMembro).where(ChatMembro.canale_id == message_in.canale_id, ChatMembro.user_id == current_user.id)
    res_member = await db.execute(stmt_member)
    if not res_member.scalar_one_or_none() and current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non hai accesso a questo canale")

    new_message = ChatMessaggio(
        canale_id=message_in.canale_id,
        progetto_id=message_in.progetto_id,
        autore_id=current_user.id,
        contenuto=message_in.contenuto,
        tipo=message_in.tipo,
        risposta_a=message_in.risposta_a
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)
    
    new_message.autore_nome = f"{current_user.nome} {current_user.cognome}"
    new_message.reazioni = []
    
    msg_dict = ChatMessaggioRead.model_validate(new_message).model_dump()
    msg_dict["created_at"] = new_message.created_at.isoformat()
    
    await manager.broadcast_to_channel(db, message_in.canale_id, {
        "type": "new_message",
        "message": msg_dict
    })
    
    # Mentions & Notifications
    mentions = re.findall(r"@([^ \n\r\t]+ [^ \n\r\t]+)", message_in.contenuto)
    for mention_name in mentions:
        user_stmt = select(User).where(
            func.concat(User.nome, " ", User.cognome).ilike(mention_name.strip()),
            User.attivo == True
        )
        u_res = await db.execute(user_stmt)
        u_tagged = u_res.scalar_one_or_none()
        if u_tagged and u_tagged.id != current_user.id:
            await create_notification(
                db,
                user_id=u_tagged.id,
                title=f"Menzionato in Chat",
                message=f"{current_user.nome} ti ha menzionato.",
                type="MESSAGGIO",
                link=f"/studio-os?channel={message_in.canale_id}"
            )
            
    return new_message

@router.patch("/messages/{message_id}")
async def edit_message(
    message_id: uuid.UUID,
    contenuto: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(ChatMessaggio).where(ChatMessaggio.id == message_id)
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()
    
    if not msg:
        raise HTTPException(status_code=404, detail="Messaggio non trovato")
    if msg.autore_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non puoi modificare questo messaggio")
        
    msg.contenuto = contenuto
    msg.updated_at = datetime.utcnow()
    msg.modificato = True
    await db.commit()
    
    await manager.broadcast_to_channel(db, msg.canale_id, {
        "type": "message_edited",
        "message_id": str(message_id),
        "canale_id": str(msg.canale_id),
        "contenuto": contenuto
    })
    return {"success": True}

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(ChatMessaggio).where(ChatMessaggio.id == message_id)
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()
    
    if not msg:
        raise HTTPException(status_code=404, detail="Messaggio non trovato")
    if msg.autore_id != current_user.id and current_user.ruolo != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non autorizzato")
        
    canal_id = msg.canale_id
    await db.delete(msg)
    await db.commit()
    
    await manager.broadcast_to_channel(db, canal_id, {
        "type": "delete_message",
        "message_id": str(message_id),
        "canale_id": str(canal_id)
    })
    return {"success": True}

@router.get("/search")
async def search_messages(
    q: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Cerca messaggi nei canali dove l'utente è membro
    stmt = select(ChatMessaggio).join(ChatMembro, ChatMembro.canale_id == ChatMessaggio.canale_id)\
        .options(joinedload(ChatMessaggio.autore))\
        .where(
            and_(
                ChatMembro.user_id == current_user.id,
                ChatMessaggio.contenuto.ilike(f"%{q}%")
            )
        ).order_by(ChatMessaggio.created_at.desc()).limit(20)

    res = await db.execute(stmt)
    messages = res.scalars().all()
    for m in messages:
        m.autore_nome = f"{m.autore.nome} {m.autore.cognome}" if m.autore else "Anonimo"
    return messages

# ═══════════════════════════════════════════════════════
# REST API - REACTIONS
# ═══════════════════════════════════════════════════════

@router.post("/messages/{message_id}/reactions")
async def add_reaction(
    message_id: uuid.UUID,
    emoji: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verifica che il messaggio esista e l'utente abbia accesso al canale
    stmt = select(ChatMessaggio).where(ChatMessaggio.id == message_id)
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Messaggio non trovato")

    # Verifica membership
    if msg.canale_id:
        stmt_m = select(ChatMembro).where(ChatMembro.canale_id == msg.canale_id, ChatMembro.user_id == current_user.id)
        res_m = await db.execute(stmt_m)
        if not res_m.scalar_one_or_none() and current_user.ruolo != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Non hai accesso a questo canale")

    # Idempotente: se la reazione esiste già, non fare nulla
    existing_stmt = select(ChatReazione).where(
        ChatReazione.messaggio_id == message_id,
        ChatReazione.user_id == current_user.id,
        ChatReazione.emoji == emoji
    )
    existing = await db.execute(existing_stmt)
    if existing.scalar_one_or_none():
        return {"success": True, "already_exists": True}

    reaction = ChatReazione(
        messaggio_id=message_id,
        user_id=current_user.id,
        emoji=emoji
    )
    db.add(reaction)
    await db.commit()

    if msg.canale_id:
        await manager.broadcast_to_channel(db, msg.canale_id, {
            "type": "reaction_added",
            "message_id": str(message_id),
            "canale_id": str(msg.canale_id),
            "emoji": emoji,
            "user_id": str(current_user.id),
            "user_nome": f"{current_user.nome} {current_user.cognome}"
        })

    return {"success": True}


@router.delete("/messages/{message_id}/reactions/{emoji}")
async def remove_reaction(
    message_id: uuid.UUID,
    emoji: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(ChatReazione).where(
        ChatReazione.messaggio_id == message_id,
        ChatReazione.user_id == current_user.id,
        ChatReazione.emoji == emoji
    )
    res = await db.execute(stmt)
    reaction = res.scalar_one_or_none()

    if not reaction:
        raise HTTPException(status_code=404, detail="Reazione non trovata")

    # Get canale_id for broadcast before deleting
    msg_stmt = select(ChatMessaggio.canale_id).where(ChatMessaggio.id == message_id)
    msg_res = await db.execute(msg_stmt)
    canale_id = msg_res.scalar_one_or_none()

    await db.delete(reaction)
    await db.commit()

    if canale_id:
        await manager.broadcast_to_channel(db, canale_id, {
            "type": "reaction_removed",
            "message_id": str(message_id),
            "canale_id": str(canale_id),
            "emoji": emoji,
            "user_id": str(current_user.id)
        })

    return {"success": True}
