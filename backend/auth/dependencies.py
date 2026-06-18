from sqlmodel import select, desc
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pwdlib import PasswordHash
import jwt
from datetime import datetime, timedelta, timezone
from typing import Annotated
from jwt.exceptions import PyJWTError
from dotenv import load_dotenv
import os
from sqlmodel import Session
from db.session import SessionDep
from models.user import User
from schemas.auth import AccessTokenPayload, RefreshTokenPayload, ResetTokenPayload
import secrets
from models.otp_code import OtpCode, OtpPurpose

load_dotenv()

ACCESS_TOKEN_SECRET_KEY = os.getenv("ACCESS_TOKEN_SECRET_KEY")
if not ACCESS_TOKEN_SECRET_KEY:
    raise ValueError("ACCESS_TOKEN_SECRET_KEY environment variable is not set")
ALGORITHM = os.getenv("ALGORITHM") or "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7))
)

REFRESH_TOKEN_SECRET_KEY = os.getenv("REFRESH_TOKEN_SECRET_KEY")
if not REFRESH_TOKEN_SECRET_KEY:
    raise ValueError("REFRESH_TOKEN_SECRET_KEY environment variable is not set")
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", str(7)))

bearer_scheme = HTTPBearer()
password_hash_context = PasswordHash.recommended()


def verify_password(plain_password, hashed_password) -> bool:
    """
    Compares a verifies the given plain password and  hash.
    """
    return password_hash_context.verify(plain_password, hashed_password)


def get_password_hash(password) -> str:
    """
    Return the hash of a text password.
    """
    return password_hash_context.hash(password)


def get_access_token_expire_time() -> datetime:
    """
    Return the datetime when access token expires.
    """
    return datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)


def get_refresh_token_expire_time() -> datetime:
    """
    Return the datetime when refresh token expires.
    """
    return datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)


def create_access_token(user_id: int, email: str):
    """
    Create JWT access token with user email and id as payload.
    """
    payload = AccessTokenPayload (
        sub=str(user_id),
        email=email,
        exp=get_access_token_expire_time(),
        type="access",
    )
    return jwt.encode(payload.model_dump(), ACCESS_TOKEN_SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int, email: str) -> str:
    """
    Create a JWT refresh token with user email and id as payload.
    """
    # jti (JWT ID) is a random nonce that makes every refresh token unique and lets us invalidate individual tokens without touching the others.
    payload = RefreshTokenPayload(
        sub=str(user_id),
        email=email,
        exp=get_refresh_token_expire_time(),
        type="refresh",
        jti=secrets.token_hex(32),
    )
    return jwt.encode(payload.model_dump(), REFRESH_TOKEN_SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> AccessTokenPayload:
    """
    Decode and validate an access token.
    Raises HTTP 401 on any failure.
    """
    try:
        raw_payload = jwt.decode(token, ACCESS_TOKEN_SECRET_KEY, algorithms=[ALGORITHM])
        payload = AccessTokenPayload(**raw_payload)
        if payload.type != "access":
            raise ValueError("Wrong token type")
        return payload
    except PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token is invalid or expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def decode_refresh_token(token: str) -> RefreshTokenPayload:
    """
    Decode and validate a refresh token.
    Raises HTTP 401 on any failure.
    """
    try:
        raw_payload = jwt.decode(token, REFRESH_TOKEN_SECRET_KEY, algorithms=[ALGORITHM])
        payload = RefreshTokenPayload(**raw_payload)
        if payload.type != "refresh":
            raise ValueError("Wrong token type")
        return payload
    except PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired",
        ) from exc


def authenticate_user(email: str, password: str, session: Session) -> User | None:
    """
    Return the user after verifying password.
    """
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def get_current_user(
    token: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    session: SessionDep,
) -> User:
    """
    Return current authenticated user.
    """
    payload = decode_access_token(token.credentials)
    user_id = int(payload.sub)
    user = session.exec(select(User).where(User.id == int(user_id))).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]):
    """
    Return current authenticated active user.
    """
    if current_user.is_active is False:
        raise HTTPException(status_code=403, detail="Inactive user")
    return current_user


CurrentUser = Annotated[User, Depends(get_current_user)]

CurrentActiveUser = Annotated[
    User,
    Depends(get_current_active_user),
]

RESET_TOKEN_SECRET_KEY = os.environ["RESET_TOKEN_SECRET_KEY"]
if not RESET_TOKEN_SECRET_KEY:
    raise ValueError("RESET_TOKEN_SECRET_KEY environment variable is not set")
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", str(10)))
OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", str(10)))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", str(5)))

otp_hash_context = PasswordHash.recommended()


def get_reset_token_expire_time() -> datetime:
    """
    Return the datetime when reset token expires.
    """
    return datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)


def generate_otp() -> str:
    """6-digit numeric OTP, zero-padded."""
    return f"{secrets.randbelow(1_000_000):06d}"


def issue_otp(session: Session, user_id: int, purpose: OtpPurpose) -> str:
    """
    Create a new OTP for (user_id, purpose).
    Invalidates any prior unconsumed OTPs for the same purpose —
    only one active OTP per purpose at a time.
    """
    # Invalidate previous active OTPs of the user for this purpose
    existing = session.exec(
        select(OtpCode).where(
            OtpCode.user_id == user_id,
            OtpCode.purpose == purpose,
            OtpCode.consumed == False,  # noqa: E712
        )
    ).all()
    for code in existing:
        code.consumed = True

    plaintext_otp = generate_otp()

    record = OtpCode(
        user_id=user_id,
        purpose=purpose,
        otp_hash=otp_hash_context.hash(plaintext_otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES),
    )
    session.add(record)
    session.commit()

    return plaintext_otp


def verify_otp(session: Session, user_id: int, purpose: OtpPurpose, code: str) -> None:
    """
    Validate `code` against the active OTP for (user_id, purpose).
    Raises HTTPException(401) on any failure — same generic message for
    "wrong code", "expired", and "too many attempts" so we don't leak
    which case occurred.

    On success, marks the OTP as consumed (single-use).
    """
    generic_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired code",
    )

    record = session.exec(
        select(OtpCode)
        .where(
            OtpCode.user_id == user_id,
            OtpCode.purpose == purpose,
            OtpCode.consumed == False,  # noqa: E712
        )
        .order_by(desc(OtpCode.created_at))
    ).first()

    if record is None:
        raise generic_error
    
    #if record.expires_at < datetime.now(timezone.utc).replace(tzinfo=None): For SQLite, we need to remove tzinfo for comparison
    if record.expires_at < datetime.now(timezone.utc):
        record.consumed = True
        session.commit()
        raise generic_error

    if record.attempts >= OTP_MAX_ATTEMPTS:
        record.consumed = True
        session.commit()
        raise generic_error

    if not otp_hash_context.verify(code, record.otp_hash):
        # Wrong code, increase attempts of the valid OTP record
        record.attempts += 1
        session.commit()
        raise generic_error

    record.consumed = True
    session.commit()


def create_reset_token(user_id: int, email: str) -> str:
    """
    Create a JWT password-reset token with user id as payload.
    """
    payload = ResetTokenPayload(
        email=email,
        sub=str(user_id),
        exp=get_reset_token_expire_time(),
        type="reset",
        jti=secrets.token_hex(32),
    )
    return jwt.encode(payload.model_dump(), RESET_TOKEN_SECRET_KEY, algorithm=ALGORITHM)


def decode_reset_token(token: str) -> ResetTokenPayload:
    """Decode + validate a password-reset token. Raises 401 on failure."""
    try:
        raw_payload = jwt.decode(token, RESET_TOKEN_SECRET_KEY, algorithms=[ALGORITHM])
        payload = ResetTokenPayload(**raw_payload)
        if payload.type != "reset":
            raise ValueError("Wrong token type")
        return payload
    except PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Reset session expired. Please request a new code.",
        ) from exc
