from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from db.session import SessionDep
from auth.dependencies import CurrentActiveUser
from models.device import Device
from schemas.device import DeviceRegisterRequest, DeviceResponse

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.post(
    "/register",
    response_model=DeviceResponse,
    summary="Register a smart plug to the authenticated user",
)
def register_device(
    body: DeviceRegisterRequest,
    session: SessionDep,
    current_user: CurrentActiveUser,
):
    """
    Register a smart plug to an authenticated user.
    """
    device = session.exec(
        select(Device).where(Device.device_id == body.device_id)
    ).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid Device ID: '{body.device_id}' is not a registered device.",
        )

    if device.user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Device '{body.device_id}' is already registered to another user.",
        )

    if current_user.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User ID is missing from the database record.",
        )

    device.user_id = current_user.id
    device.name = body.name
    device.is_enabled = True  # Enable the device upon registration

    session.add(device)
    session.commit()
    session.refresh(device)
    return device


@router.get(
    "/",
    response_model=list[DeviceResponse],
    summary="List all devices for the authenticated user",
)
def list_devices(session: SessionDep, current_user: CurrentActiveUser):
    """
    List all devices registered to the authenticated user.
    """
    devices = session.exec(
        select(Device)
        .where(Device.user_id == current_user.id)
        .where(Device.is_enabled == True)  # noqa: E712
    ).all()
    return devices


@router.get(
    "/{device_id}",
    response_model=DeviceResponse,
    summary="Get a single device by device_id",
)
def get_device(
    device_id: str,
    session: SessionDep,
    current_user: CurrentActiveUser,
):
    """
    Get a single device by device_id.
    """
    if current_user.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User ID is missing from the database record.",
        )

    device = _get_owned_device(device_id, current_user.id, session)
    return device


@router.patch(
    "/{device_id}",
    response_model=DeviceResponse,
    summary="Update device name",
)
def update_device(
    device_id: str,
    body: DeviceRegisterRequest,
    session: SessionDep,
    current_user: CurrentActiveUser,
):
    """
    Update device name.
    """
    if current_user.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User ID is missing from the database record.",
        )
    device = _get_owned_device(device_id, current_user.id, session)
    device.name = body.name
    session.add(device)
    session.commit()
    session.refresh(device)
    return device


@router.delete(
    "/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unregister a device",
)
def delete_device(
    device_id: str,
    session: SessionDep,
    current_user: CurrentActiveUser,
):
    """
    Unregister a device by marking it as disabled.
    """
    if current_user.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User ID is missing from the database record.",
        )
    device = _get_owned_device(device_id, current_user.id, session)
    # Soft delete — mark inactive rather than removing the row
    # Preserves telemetry history linked to this device_id
    device.user_id = None  # Unassign from user
    device.is_enabled = False
    session.add(device)
    session.commit()


def _get_owned_device(device_id: str, user_id: int, session) -> Device:
    """
    Fetch a device by device_id, verifying it belongs to the given user.
    Raises 404 if not found or not owned by the user.
    """
    device = session.exec(
        select(Device)
        .where(Device.device_id == device_id)
        .where(Device.user_id == user_id)
        .where(Device.is_enabled == True)  # noqa: E712
    ).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found",
        )
    return device
