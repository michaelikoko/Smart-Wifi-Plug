"""
Google Home Graph API client.

Two responsibilities:
  - report_state(): proactively push a device's current on/off + online
    state to Google, so Google Home/Assistant reflect changes made outside
    of a Google-initiated EXECUTE (mobile app toggle, timer firing,
    auto-cutoff, device going stale/offline).
  - request_sync(): tell Google to re-fetch a user's device list (SYNC) —
    call after a device is added, removed, renamed, or enabled/disabled.

Auth: uses a Google Cloud service account (NOT the per-user OAuth tokens
issued in routes/google_home.py) with the homegraph scope. This is
Google's required auth model for Home Graph API calls — it identifies
your *integration*, while agentUserId in each call identifies *which*
linked user the state/sync applies to.

Required env var:
  GOOGLE_HOMEGRAPH_SERVICE_ACCOUNT_JSON — full contents of the service
  account JSON key file (Cloud Console → IAM & Admin → Service Accounts).
"""

import json
import logging
import os
import secrets
from typing import Optional

import google.auth.transport.requests
import requests
from google.oauth2 import service_account

logger = logging.getLogger("homegraph")

REPORT_STATE_URL = "https://homegraph.googleapis.com/v1/devices:reportStateAndNotification"
REQUEST_SYNC_URL = "https://homegraph.googleapis.com/v1/devices:requestSync"

_SCOPES = ["https://www.googleapis.com/auth/homegraph"]

_credentials: Optional[service_account.Credentials] = None


def _get_credentials() -> service_account.Credentials:
    global _credentials
    if _credentials is None:
        raw = os.environ["GOOGLE_HOMEGRAPH_SERVICE_ACCOUNT_JSON"]
        info = json.loads(raw)
        _credentials = service_account.Credentials.from_service_account_info(
            info, scopes=_SCOPES
        )
    if not _credentials.valid:
        _credentials.refresh(google.auth.transport.requests.Request())
    return _credentials


def report_state(
    agent_user_id: str,
    device_id: str,
    online: bool,
    on: bool,
    request_id: Optional[str] = None,
) -> None:
    """
    Push a device's current state to Home Graph. Failures are logged and
    swallowed — this is a best-effort proactive update, never something
    that should break the caller's own request (MQTT handler, timer
    sweep, etc.) if Google's API is briefly unavailable.
    """
    try:
        creds = _get_credentials()
    except Exception as e:
        logger.error("Home Graph credentials unavailable, skipping report_state: %s", e)
        return

    body = {
        "requestId": request_id or secrets.token_hex(8),
        "agentUserId": agent_user_id,
        "payload": {
            "devices": {
                "states": {
                    device_id: {
                        "online": online,
                        "on": on,
                    }
                }
            }
        },
    }

    try:
        resp = requests.post(
            REPORT_STATE_URL,
            headers={
                "Authorization": f"Bearer {creds.token}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=5,
        )
        if resp.status_code != 200:
            logger.warning(
                "Home Graph reportState failed — status=%s body=%s",
                resp.status_code,
                resp.text,
            )
        else:
            logger.info(
                "Home Graph reportState sent — device=%s on=%s online=%s",
                device_id,
                on,
                online,
            )
    except Exception as e:
        logger.error("Home Graph reportState request error: %s", e)


def request_sync(agent_user_id: str) -> None:
    """
    Ask Google to re-run SYNC for this user's linked account — call after
    a device is added, removed, renamed, or enabled/disabled, so Google
    Home picks up the change without the user manually unlinking/relinking.
    """
    try:
        creds = _get_credentials()
    except Exception as e:
        logger.error("Home Graph credentials unavailable, skipping request_sync: %s", e)
        return

    try:
        resp = requests.post(
            REQUEST_SYNC_URL,
            headers={
                "Authorization": f"Bearer {creds.token}",
                "Content-Type": "application/json",
            },
            json={"agentUserId": agent_user_id},
            timeout=5,
        )
        if resp.status_code != 200:
            logger.warning(
                "Home Graph requestSync failed — status=%s body=%s",
                resp.status_code,
                resp.text,
            )
        else:
            logger.info("Home Graph requestSync sent — agentUserId=%s", agent_user_id)
    except Exception as e:
        logger.error("Home Graph requestSync request error: %s", e)