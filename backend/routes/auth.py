from fastapi import APIRouter, HTTPException, status, Depends
from sqlmodel import select
from db.session import SessionDep
from models.user import User
from models.refresh_token import RefreshToken
from schemas.auth import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    ForgotPasswordResponse,
    ForgotPasswordRequest,
    VerifyResetOtpRequest,
    VerifyResetOtpResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from schemas.user import UserResponse
from auth.dependencies import (
    get_password_hash,
    authenticate_user,
    create_access_token,
    create_refresh_token,
    get_refresh_token_expire_time,
    decode_refresh_token,
    CurrentActiveUser,
    issue_otp,
    verify_otp,
    create_reset_token,
    decode_reset_token,
)
from models.otp_code import OtpPurpose
from models.used_reset_token import UsedResetToken
from typing import Annotated
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from emails.email_service import send_otp_email

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
def register(body: RegisterRequest, session: SessionDep) -> User:
    """
    Register a new user account.
    """
    if body.password != body.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    password_hash = get_password_hash(body.password)
    user = User(
        email=body.email,
        password_hash=password_hash,
        full_name=body.full_name,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive a JWT access token",
)
def login(body: LoginRequest, session: SessionDep) -> TokenResponse:
    """
    Login user and return valid JWT token.
    """
    user = authenticate_user(body.email, body.password, session)

    if user is None or user.id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token = create_access_token(user_id=user.id, email=user.email)
    refresh_token = create_refresh_token(user_id=user.id, email=user.email)

    refresh_token_record = RefreshToken(
        token=refresh_token, user_id=user.id, expires_at=get_refresh_token_expire_time()
    )
    session.add(refresh_token_record)
    session.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate a refresh token and receive a new token pair",
)
def refresh(body: RefreshRequest, session: SessionDep) -> TokenResponse:
    """
    Rotate a refresh token and receive a new token pair.
    1. Decode + validate the incoming refresh token (signature, expiry, type).
    2. Look it up in the DB.
    3. If it's already revoked, reuse detected. Revoke ALL tokens for this user (full compromise assumed) and 401.
    4. If valid → revoke the old token, issue a new pair (access + refresh).
    """
    refresh_token_payload = decode_refresh_token(body.refresh_token)
    user_id = int(refresh_token_payload.sub)

    stored = session.exec(
        select(RefreshToken).where(RefreshToken.token == body.refresh_token)
    ).first()

    if stored is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not recognised",
        )

    if stored.revoked:
        # Reuse detected — someone is replaying an old token. Revoke every active refresh token for this user immediately.
        all_tokens = session.exec(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked == False,
            )
        ).all()
        for token in all_tokens:
            token.revoked = True
        session.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token already used. Please log in again.",
        )

    user = session.get(User, user_id)
    if user is None or not user.is_active or user.id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    stored.revoked = True

    new_access_token = create_access_token(user_id=user.id, email=user.email)
    new_refresh_token = create_refresh_token(user_id=user.id, email=user.email)

    new_refresh_token_record = RefreshToken(
        token=new_refresh_token,
        user_id=user.id,
        expires_at=get_refresh_token_expire_time(),
    )
    session.add(new_refresh_token_record)
    session.commit()

    return TokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the current refresh token",
)
def logout(body: RefreshRequest, session: SessionDep) -> None:
    """
    Revoke the provided refresh token.
    We don't error if the token is already revoked or unknown
    It is idempotent.
    """
    stored = session.exec(
        select(RefreshToken).where(RefreshToken.token == body.refresh_token)
    ).first()
    if stored and not stored.revoked:
        stored.revoked = True
        session.commit()


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    summary="Request a password-reset OTP via email",
)
def forgot_password(
    body: ForgotPasswordRequest, session: SessionDep
) -> ForgotPasswordResponse:
    """
    Always returns 200 with the same generic message, whether or not the
    email is registered — prevents account enumeration.
    """
    user = session.exec(select(User).where(User.email == body.email)).first()
    if user is None or user.id is None or not user.is_active:
        # User doesn't exist or is inactive, but still return 200 with the same generic message
        return ForgotPasswordResponse()

    if user is not None:
        otp = issue_otp(session, user_id=user.id, purpose=OtpPurpose.PASSWORD_RESET)
        send_otp_email(to=user.email, otp=otp, purpose=OtpPurpose.PASSWORD_RESET)

    return ForgotPasswordResponse()


@router.post(
    "/verify-reset-otp",
    response_model=VerifyResetOtpResponse,
    summary="Verify a password-reset OTP and receive a short-lived reset token",
)
def verify_reset_otp(
    body: VerifyResetOtpRequest, session: SessionDep
) -> VerifyResetOtpResponse:
    user = session.exec(select(User).where(User.email == body.email)).first()

    if user is None or user.id is None or not user.is_active:
        # Generic 401 even if the user doesn't exist, same error as a bad OTP
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired code",
        )

    verify_otp(
        session, user_id=user.id, purpose=OtpPurpose.PASSWORD_RESET, code=body.otp
    )

    reset_token = create_reset_token(user_id=user.id, email=user.email)
    return VerifyResetOtpResponse(reset_token=reset_token)


reset_token_scheme = HTTPBearer()


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    summary="Set a new password using a verified reset token",
)
def reset_password(
    body: ResetPasswordRequest,
    session: SessionDep,
    token: Annotated[HTTPAuthorizationCredentials, Depends(reset_token_scheme)],
) -> ResetPasswordResponse:
    if body.new_password != body.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    reset_token_payload = decode_reset_token(token.credentials)
    user_id = int(reset_token_payload.sub)
    jti = reset_token_payload.jti


    already_used = session.get(UsedResetToken, jti)
    if already_used is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Reset session expired. Please request a new code.",
        )

    user = session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    user.password_hash = get_password_hash(body.new_password)

    session.add(UsedResetToken(jti=jti, user_id=user_id))

    # Revoke all refresh tokens, force re-login everywhere
    active_refresh_tokens = session.exec(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,  # noqa: E712
        )
    ).all()
    for refresh_token in active_refresh_tokens:
        refresh_token.revoked = True

    session.commit()

    return ResetPasswordResponse()


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user",
)
def get_me(current_user: CurrentActiveUser) -> User:
    """
    Retrieve the current authenticated user.
    """
    return current_user
