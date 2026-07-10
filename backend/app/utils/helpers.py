import re
import sys

EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

def validate_email_format(email):
    """
    Validates email against basic RFC structure.
    """
    return re.match(EMAIL_REGEX, email) is not None

def send_password_reset_email(email, reset_link):
    """
    Mocks password reset link delivery by writing it to stdout.
    This fulfills the secure password reset requirements for local testing.
    """
    mock_log = f"""
======================================================================
MOCK EMAIL SERVICE: PASSWORD RESET
To: {email}
Subject: NovaChat Password Reset Request
Link: {reset_link}
This link will expire in 15 minutes.
======================================================================
"""
    print(mock_log, file=sys.stdout, flush=True)
    return True
