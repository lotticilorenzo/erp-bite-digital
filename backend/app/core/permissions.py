import uuid
from typing import Set, Tuple
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import User, UserRole, ProgettoTeam, Task, Progetto, ChatMembro, ChatCanale
from app.core.security import is_studio_only_role, has_erp_access

async def get_user_access_scope(
    db: AsyncSession,
    user: User,
) -> Tuple[Set[uuid.UUID], Set[uuid.UUID], Set[uuid.UUID]]:
    """
    Returns (project_ids, task_ids, client_ids) accessible by the user.
    If user has ERP access, returns empty sets (indicating unrestricted access within the tenant).
    """
    if has_erp_access(user.ruolo):
        # Admin and Developers see everything.
        return set(), set(), set()

    project_ids: Set[uuid.UUID] = set()
    task_ids: Set[uuid.UUID] = set()
    client_ids: Set[uuid.UUID] = set()

    # 1. Projects where user is in the team
    team_result = await db.execute(
        select(ProgettoTeam.progetto_id)
        .join(Progetto, Progetto.id == ProgettoTeam.progetto_id)
        .where(ProgettoTeam.user_id == user.id, Progetto.is_deleted == False)
    )
    project_ids.update(team_result.scalars().all())

    # 2. Tasks where user is assignee or reviewer
    task_result = await db.execute(
        select(Task.id, Task.progetto_id).where(
            or_(Task.assegnatario_id == user.id, Task.revisore_id == user.id),
            Task.is_deleted == False
        )
    )
    for task_id, progetto_id in task_result.all():
        task_ids.add(task_id)
        if progetto_id:
            project_ids.add(progetto_id)

    # 3. Clients linked to those projects
    if project_ids:
        project_meta_result = await db.execute(
            select(Progetto.id, Progetto.cliente_id).where(Progetto.id.in_(project_ids))
        )
        for progetto_id, cliente_id in project_meta_result.all():
            project_ids.add(progetto_id)
            if cliente_id:
                client_ids.add(cliente_id)

    return project_ids, task_ids, client_ids

async def can_access_project(db: AsyncSession, user: User, progetto_id: uuid.UUID) -> bool:
    if has_erp_access(user.ruolo):
        return True
    p_ids, _, _ = await get_user_access_scope(db, user)
    return progetto_id in p_ids

async def can_access_task(db: AsyncSession, user: User, task_id: uuid.UUID) -> bool:
    if has_erp_access(user.ruolo):
        return True
    _, t_ids, p_ids = await get_user_access_scope(db, user)
    
    if task_id in t_ids:
        return True
    
    # Check if user has access to the task's project
    task = await db.get(Task, task_id)
    if task and task.progetto_id in p_ids:
        return True
        
    return False

async def can_access_channel(db: AsyncSession, user: User, canale_id: uuid.UUID) -> bool:
    if has_erp_access(user.ruolo):
        return True
        
    stmt = select(ChatMembro).where(ChatMembro.canale_id == canale_id, ChatMembro.user_id == user.id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none() is not None
