import os
import base64
import hashlib
import logging
from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger(__name__)

# Resolve encryption key
def get_encryption_key() -> str:
    key_env = os.getenv("BACKUP_ENCRYPTION_KEY")
    if key_env:
        try:
            # Validate if it's a valid Fernet key
            Fernet(key_env.encode())
            return key_env
        except Exception:
            logger.warning("BACKUP_ENCRYPTION_KEY environment variable is not a valid 32-byte base64 key. Deriving key from JWT_SECRET instead.")
    
    # Deterministic fallback derivation from JWT_SECRET for development/staging
    jwt_sec = getattr(settings, "JWT_SECRET", "facesnap_dev_secret_key_123456789")
    key_hash = hashlib.sha256(jwt_sec.encode()).digest()
    derived_key = base64.urlsafe_b64encode(key_hash).decode()
    return derived_key

# Singleton Fernet instance
_key = get_encryption_key()
_cipher = Fernet(_key.encode())

def encrypt_data(data: bytes) -> bytes:
    """
    Encrypts raw bytes using AES-256 Fernet.
    """
    return _cipher.encrypt(data)

def decrypt_data(data: bytes) -> bytes:
    """
    Decrypts ciphertext bytes using AES-256 Fernet.
    """
    return _cipher.decrypt(data)

def encrypt_file(src_path: str, dest_path: str):
    """
    Encrypts a file and writes it to dest_path.
    """
    with open(src_path, "rb") as f:
        data = f.read()
    encrypted = encrypt_data(data)
    with open(dest_path, "wb") as f:
        f.write(encrypted)

def decrypt_file(src_path: str, dest_path: str):
    """
    Decrypts a file and writes it to dest_path.
    """
    with open(src_path, "rb") as f:
        encrypted_data = f.read()
    decrypted = decrypt_data(encrypted_data)
    with open(dest_path, "wb") as f:
        f.write(decrypted)

def generate_sha256(file_path: str) -> str:
    """
    Generates SHA-256 hash of a file.
    """
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def verify_integrity(file_path: str, expected_checksum: str) -> bool:
    """
    Verifies that file_path matches expected_checksum.
    """
    if not expected_checksum:
        return False
    actual = generate_sha256(file_path)
    return actual.lower() == expected_checksum.lower()
