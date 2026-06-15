import logging
from models.otp_code import OtpPurpose

logger = logging.getLogger("email_service")


def send_otp_email(to: str, otp: str, purpose: OtpPurpose) -> None:
    """
    Send an OTP code via email for the specified purpose (e.g., "password_reset", "verification").
    """
    if purpose == OtpPurpose.PASSWORD_RESET:
        subject = "Your GridCore Pulse password reset code"
    else:
        subject = "Your GridCore Pulse verification code"

    # ── DEV ──────────────────────────────────────────────────────────────────
    logger.info("EMAIL → %s | %s | OTP: %s", to, subject, otp)
    print(f"[DEV EMAIL] To: {to} | Subject: {subject} | OTP: {otp}")

    # ── PRODUCTION (example with a generic SMTP/provider call) ────────────────
    # provider.send(
    #     to=to,
    #     subject=subject,
    #     body=f"Your code is {otp}. It expires in {OTP_EXPIRE_MINUTES} minutes.",
    # )

# email_service.py
#
# Dev stub — prints OTP to console instead of sending email.
# Replace with a real provider (SES, Postmark, Resend, SMTP) for production.
# Keep the function signature stable so routers/auth.py doesn't need changes.