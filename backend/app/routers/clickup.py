from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.auth import get_current_user
import httpx
import os

router = APIRouter(prefix="/api/v1/clickup", tags=["clickup"])

CLICKUP_BASE = "https://api.clickup.com/api/v2"
TEAM_ID = "9015889235"


def get_token():
    token = os.getenv("CLICKUP_TOKEN", "")
    if not token:
        raise HTTPException(status_code=500, detail="CLICKUP_TOKEN non configurato")
    return token


async def cu_get(path: str, token: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{CLICKUP_BASE}{path}",
            headers={"Authorization": token}
        )
        r.raise_for_status()
        return r.json()


@router.get("/tasks")
async def get_tasks_per_utente(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    token = get_token()

    # 1. Leggi clickup_user_id dell'utente corrente
    result = await db.execute(
        text("SELECT clickup_user_id FROM users WHERE id = :id"),
        {"id": str(current_user["id"])}
    )
    row = result.fetchone()
    if not row or not row.clickup_user_id:
        raise HTTPException(
            status_code=400,
            detail="clickup_user_id non configurato per questo utente"
        )

    cu_user_id = str(row.clickup_user_id)

    # 2. Carica tutti gli space
    spaces_data = await cu_get(f"/team/{TEAM_ID}/space?archived=false", token)
    tasks_out = []

    for space in spaces_data.get("spaces", []):
        if space["name"] == "BITE":
            continue

        folders_data = await cu_get(
            f"/space/{space['id']}/folder?archived=false", token
        )

        for folder in folders_data.get("folders", []):
            cliente_nome = folder["name"]
            lists_data = await cu_get(
                f"/folder/{folder['id']}/list?archived=false", token
            )

            for lst in lists_data.get("lists", []):
                tasks_data = await cu_get(
                    f"/list/{lst['id']}/task"
                    f"?assignees[]={cu_user_id}&subtasks=true&include_closed=false",
                    token
                )

                # Mappa id → nome per risolvere parent name
                id_to_name = {
                    t["id"]: t["name"]
                    for t in tasks_data.get("tasks", [])
                }

                for task in tasks_data.get("tasks", []):
                    parent_id = task.get("parent")

                    if parent_id:
                        parent_name = id_to_name.get(parent_id, parent_id)
                        display_name = f"{parent_name} · {task['name']}"
                    else:
                        display_name = task["name"]

                    tasks_out.append({
                        "id": task["id"],
                        "name": task["name"],
                        "display_name": display_name,
                        "parent_id": parent_id,
                        "parent_name": id_to_name.get(parent_id) if parent_id else None,
                        "cliente_nome": cliente_nome,
                        "folder_id": folder["id"],
                        "list_id": lst["id"],
                        "list_name": lst["name"],
                        "status": task.get("status", {}).get("status", ""),
                        "url": task.get("url", ""),
                    })

    # 3. Raggruppa per cliente
    grouped = {}
    for t in tasks_out:
        k = t["cliente_nome"]
        if k not in grouped:
            grouped[k] = {
                "cliente_nome": k,
                "folder_id": t["folder_id"],
                "tasks": []
            }
        grouped[k]["tasks"].append(t)

    return {
        "clienti": list(grouped.values()),
        "totale_task": len(tasks_out)
    }


@router.get("/users")
async def get_clickup_users(
    current_user: dict = Depends(get_current_user)
):
    """Ritorna gli utenti ClickUp con ID - per configurare clickup_user_id"""
    if current_user.get("ruolo") not in ("ADMIN", "PM"):
        raise HTTPException(status_code=403, detail="Solo ADMIN/PM")
    token = get_token()
    data = await cu_get(f"/team/{TEAM_ID}/member", token)
    members = []
    for m in data.get("members", []):
        u = m.get("user", {})
        members.append({
            "id": u.get("id"),
            "username": u.get("username"),
            "email": u.get("email"),
        })
    return {"members": members}
