from fastapi import APIRouter, status
from sqlmodel import select
from models.user import User
from schemas.auth import UserResponse
from db.session import SessionDep
from typing import Sequence
#from auth.dependencies import CurrentActiveUser

router = APIRouter(prefix="/users", tags=["users"])

@router.get(
        "/",
        response_model= list[UserResponse],
        status_code = status.HTTP_200_OK,
        summary= "List all users in the database"
)
#async def get_users(session: SessionDep, current_user: CurrentActiveUser) -> Sequence[User]:
async def get_users(session: SessionDep) -> Sequence[User]:
    """
    Retrieve all users.
    Remove this endpoint in production, or restrict access to admin users only.
    """
    users = session.exec(select(User)).all()
    return users