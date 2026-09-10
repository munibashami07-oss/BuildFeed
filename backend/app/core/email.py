import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import quote

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD and settings.SMTP_FROM_EMAIL)


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """
    Sends the password reset email over SMTP.

    Returns True if the email was sent, False otherwise (e.g. SMTP not configured,
    or the send failed). This never raises: callers (the forgot-password endpoint)
    must return the same generic response whether or not the send succeeds, to avoid
    leaking whether an account exists.
    """
    if not _smtp_configured():
        logger.warning("SMTP is not configured (SMTP_HOST/SMTP_USERNAME/SMTP_PASSWORD/SMTP_FROM_EMAIL); "
                        "skipping password reset email send.")
        return False

    reset_link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={quote(reset_token)}"

    subject = "Reset your build. password"
    text_body = (
        "We received a request to reset your build. password.\n\n"
        f"Reset your password: {reset_link}\n\n"
        "This link expires in 30 minutes. If you didn't request this, you can safely ignore this email."
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #171717;">Reset your password</h2>
      <p style="color: #6B6B6B;">We received a request to reset your build. account password.</p>
      <p style="margin: 24px 0;">
        <a href="{reset_link}"
           style="background-color: #E86A33; color: #fff; padding: 10px 20px; border-radius: 6px;
                  text-decoration: none; font-weight: 500;">
          Reset Password
        </a>
      </p>
      <p style="color: #6B6B6B; font-size: 13px;">This link expires in 30 minutes.
      If you didn't request this, you can safely ignore this email.</p>
    </div>
    """

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            if settings.SMTP_USE_TLS:
                server.starttls()
                server.ehlo()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], message.as_string())
        return True
    except Exception as exc:
        logger.exception("Failed to send password reset email to %s: %s", to_email, exc)
        return False