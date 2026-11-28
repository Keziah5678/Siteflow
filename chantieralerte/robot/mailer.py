"""Envoi des emails : Brevo (production), SMTP, outbox (tests) ou log.

Brevo, offre gratuite : 300 emails/jour (campagnes + transactionnels).
Le plafond est respecté via MAIL_DAILY_LIMIT (défaut 290, marge de sécurité).
"""
from __future__ import annotations

import logging
import os
import smtplib
import time
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

import requests

log = logging.getLogger(__name__)
BREVO_URL = "https://api.brevo.com/v3/smtp/email"


@dataclass
class Email:
    to: str
    subject: str
    html: str
    text: str
    unsubscribe_url: str | None = None


class QuotaReached(RuntimeError):
    pass


class Transport(Protocol):
    def send(self, msg: Email) -> None: ...


class BrevoTransport:
    def __init__(self, api_key: str, sender_email: str, sender_name: str):
        self.s = requests.Session()
        self.s.headers.update({"api-key": api_key, "accept": "application/json", "content-type": "application/json"})
        self.sender = {"email": sender_email, "name": sender_name}

    def send(self, msg: Email) -> None:
        payload = {"sender": self.sender, "to": [{"email": msg.to}], "subject": msg.subject, "htmlContent": msg.html, "textContent": msg.text}
        if msg.unsubscribe_url:
            payload["headers"] = {"List-Unsubscribe": f"<{msg.unsubscribe_url}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}
        for attempt in range(1, 4):
            r = self.s.post(BREVO_URL, json=payload, timeout=30)
            if r.status_code in (200, 201, 202):
                return
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(5 * attempt)
                continue
            # 400/401/402 : erreur de configuration ou quota → inutile d'insister.
            if r.status_code == 402 or "limit" in r.text.lower():
                raise QuotaReached(f"Brevo : quota atteint ({r.status_code})")
            raise RuntimeError(f"Brevo {r.status_code}: {r.text[:300]}")
        raise RuntimeError("Brevo indisponible après 3 essais")


class SmtpTransport:
    def __init__(self, host: str, port: int, user: str | None, password: str | None, sender: str):
        self.host, self.port, self.user, self.password, self.sender = host, port, user, password, sender

    def send(self, msg: Email) -> None:
        m = EmailMessage()
        m["From"], m["To"], m["Subject"] = self.sender, msg.to, msg.subject
        if msg.unsubscribe_url:
            m["List-Unsubscribe"] = f"<{msg.unsubscribe_url}>"
            m["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
        m.set_content(msg.text)
        m.add_alternative(msg.html, subtype="html")
        with smtplib.SMTP(self.host, self.port, timeout=30) as s:
            if self.user:
                s.starttls()
                s.login(self.user, self.password or "")
            s.send_message(m)


class OutboxTransport:
    """Stocke les emails dans la table outbox (tests locaux / préproduction)."""

    def __init__(self, db):
        self.db = db

    def send(self, msg: Email) -> None:
        self.db.insert("outbox", {"to_email": msg.to, "subject": msg.subject, "html": msg.html})


class LogTransport:
    def __init__(self):
        self.sent: list[Email] = []

    def send(self, msg: Email) -> None:
        self.sent.append(msg)
        log.info("[email simulé] → %s : %s", msg.to, msg.subject)


class Mailer:
    """Transport + plafond quotidien."""

    def __init__(self, transport: Transport, daily_limit: int):
        self.t, self.limit, self.count = transport, daily_limit, 0

    @property
    def remaining(self) -> int:
        return self.limit - self.count

    def send(self, msg: Email) -> None:
        if self.count >= self.limit:
            raise QuotaReached(f"plafond quotidien atteint ({self.limit})")
        self.t.send(msg)
        self.count += 1


def from_env(db=None) -> Mailer:
    mode = os.environ.get("MAIL_MODE", "brevo").lower()
    limit = int(os.environ.get("MAIL_DAILY_LIMIT", "290"))
    sender_email = os.environ.get("MAIL_FROM", "")
    sender_name = os.environ.get("MAIL_FROM_NAME", "ChantierAlerte")
    if mode == "brevo":
        key = os.environ.get("BREVO_API_KEY")
        if not key or not sender_email:
            raise SystemExit("BREVO_API_KEY et MAIL_FROM sont requis (ou MAIL_MODE=log pour tester).")
        return Mailer(BrevoTransport(key, sender_email, sender_name), limit)
    if mode == "smtp":
        return Mailer(SmtpTransport(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587")), os.environ.get("SMTP_USER"), os.environ.get("SMTP_PASSWORD"), f"{sender_name} <{sender_email}>"), limit)
    if mode == "outbox":
        if db is None:
            raise SystemExit("MAIL_MODE=outbox nécessite la base")
        return Mailer(OutboxTransport(db), limit)
    return Mailer(LogTransport(), limit)
