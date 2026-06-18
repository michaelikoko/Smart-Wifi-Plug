from fastapi import APIRouter, status
from sqlmodel import select
from models.user import User
from schemas.user import UserResponse, UpdateBillingRateRequest
from db.session import SessionDep
from typing import Sequence
from auth.dependencies import CurrentActiveUser

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

@router.patch(
    "/me/billing", 
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update the user's electricity billing rate",
)
def update_billing_rate(
    body: UpdateBillingRateRequest,
    session: SessionDep,
    current_user: CurrentActiveUser,
):
    """
    Updates the global billing rate for the authenticated user.
    """
    current_user.billing_rate = body.billing_rate
    
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    
    return current_user