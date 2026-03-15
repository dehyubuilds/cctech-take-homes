"""
Twilio SMS. Load credentials from environment.
"""
import os
from typing import List

def _client():
    from twilio.rest import Client
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not sid or not token:
        raise ValueError("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required")
    return Client(sid, token)

def send_sms(phone_number: str, message: str) -> str:
    """Send one SMS. Returns message SID or raises."""
    client = _client()
    from_num = os.environ.get("TWILIO_PHONE_NUMBER")
    if not from_num:
        raise ValueError("TWILIO_PHONE_NUMBER required")
    m = client.messages.create(to=phone_number, from_=from_num, body=message)
    return m.sid

def send_bulk_sms(phone_numbers: List[str], message: str) -> List[tuple]:
    """
    Send SMS to many numbers. Returns list of (phone_number, sid_or_error).
    """
    results = []
    for num in phone_numbers:
        try:
            sid = send_sms(num, message)
            results.append((num, sid))
        except Exception as e:
            results.append((num, str(e)))
    return results
