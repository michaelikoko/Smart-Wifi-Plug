from pydantic import BaseModel
from typing import Literal, Optional, Any
from datetime import datetime
from schemas.auth import TokenPayloadBase


class GoogleAuthCodePayload(TokenPayloadBase):
    """
    Short-lived JWT used as the OAuth `code` handed back to Google during
    account linking. Deliberately short expiry (2 min) since Google
    exchanges it for a token pair within seconds of receiving it.
    """
    type: Literal["google_auth_code"]
    jti: str


class GoogleTokenResponse(BaseModel):
    """OAuth2 token response shape Google's account-linking flow expects."""
    token_type: str = "Bearer"
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: int  # seconds


# ---- Fulfillment request/response (Google Smart Home Intent schema) ----
# Kept loose (dict-based) rather than fully typed, since Google's intent
# payloads are deeply nested and only a few fields are actually used here.

class FulfillmentInput(BaseModel):
    intent: str
    payload: dict[str, Any] = {}


class FulfillmentRequest(BaseModel):
    requestId: str
    inputs: list[FulfillmentInput]