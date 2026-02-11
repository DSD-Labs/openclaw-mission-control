from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from .settings import settings


class CryptoError(RuntimeError):
    pass


def _fernet() -> Fernet:
    if not settings.gateway_token_key:
        raise CryptoError("GATEWAY_TOKEN_KEY not configured")
    try:
        return Fernet(settings.gateway_token_key.encode())
    except Exception as e:
        raise CryptoError(f"Invalid GATEWAY_TOKEN_KEY: {e}")


def encrypt_token(token: str) -> str:
    f = _fernet()
    return f.encrypt(token.encode()).decode()


def decrypt_token(token_ciphertext: str) -> str:
    f = _fernet()
    try:
        return f.decrypt(token_ciphertext.encode()).decode()
    except InvalidToken as e:
        raise CryptoError("Failed to decrypt token (bad key or corrupted ciphertext)") from e
