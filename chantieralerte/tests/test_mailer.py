"""Transport Brevo (sans réseau) et plafond quotidien."""
import pytest

from robot.mailer import BrevoTransport, Email, LogTransport, Mailer, QuotaReached, from_env


class Resp:
    def __init__(self, code, text=""):
        self.status_code, self.text = code, text


class FakeSession:
    def __init__(self, codes):
        self.codes, self.calls, self.headers = list(codes), [], {}

    def post(self, url, json, timeout):
        self.calls.append((url, json))
        return Resp(*self.codes.pop(0))


def transport(codes):
    t = BrevoTransport("cle", "alertes@exemple.fr", "ChantierAlerte")
    t.s = FakeSession(codes)
    return t


def test_brevo_payload():
    t = transport([(201,)])
    t.send(Email("artisan@exemple.fr", "Sujet", "<p>x</p>", "x", "https://fn/unsubscribe?t=1"))
    url, body = t.s.calls[0]
    assert url == "https://api.brevo.com/v3/smtp/email"
    assert body["sender"] == {"email": "alertes@exemple.fr", "name": "ChantierAlerte"}
    assert body["to"] == [{"email": "artisan@exemple.fr"}] and body["htmlContent"] == "<p>x</p>" and body["textContent"] == "x"
    assert body["headers"]["List-Unsubscribe"] == "<https://fn/unsubscribe?t=1>"
    assert body["headers"]["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"


def test_brevo_retries_on_server_error(monkeypatch):
    monkeypatch.setattr("robot.mailer.time.sleep", lambda s: None)
    t = transport([(503,), (201,)])
    t.send(Email("a@b.fr", "s", "h", "t"))
    assert len(t.s.calls) == 2


def test_brevo_quota_error_is_recognised():
    with pytest.raises(QuotaReached):
        transport([(402, "daily limit reached")]).send(Email("a@b.fr", "s", "h", "t"))


def test_daily_cap():
    m = Mailer(LogTransport(), daily_limit=2)
    m.send(Email("a@b.fr", "s", "h", "t"))
    m.send(Email("a@b.fr", "s", "h", "t"))
    with pytest.raises(QuotaReached):
        m.send(Email("a@b.fr", "s", "h", "t"))


def test_missing_brevo_config_fails_clearly(monkeypatch):
    monkeypatch.setenv("MAIL_MODE", "brevo")
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    with pytest.raises(SystemExit, match="BREVO_API_KEY"):
        from_env()
