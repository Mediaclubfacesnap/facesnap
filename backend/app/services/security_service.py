import bleach
import logging
import os
from fastapi import HTTPException, status
from PIL import Image
import io

logger = logging.getLogger(__name__)

ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'a']
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target', 'rel']
}

DISALLOWED_EXTENSIONS = {'.exe', '.bat', '.cmd', '.php', '.js', '.sh', '.htm', '.html', '.vbs', '.scr', '.pif'}

def scan_file(file_bytes: bytes) -> bool:
    """
    Antivirus placeholder hook for future integration (e.g. ClamAV).
    """
    # Placeholder: return True for now
    return True

class SecurityService:
    @staticmethod
    def sanitize_html(text: str) -> str:
        """
        Module 6: HTML Content Sanitization using Bleach.
        Sanitizes text fields to prevent XSS (Script, Style, IFrame injections).
        Allows basic tags: <b>, <strong>, <i>, <em>, <u>, <a>.
        """
        if not text:
            return ""
        try:
            cleaned = bleach.clean(
                text,
                tags=ALLOWED_TAGS,
                attributes=ALLOWED_ATTRIBUTES,
                strip=True
            )
            return cleaned
        except Exception as e:
            logger.error(f"HTML sanitization failed: {e}")
            # Fallback basic escape to prevent raw tags from slipping through
            import html
            return html.escape(text)

    @staticmethod
    def validate_upload(filename: str, file_bytes: bytes, content_type: str, max_size_mb: float = 20.0) -> bool:
        """
        Module 5: Upload Security Layer.
        Validates file extensions, content-types, sizes, magic bytes, and performs antivirus scanning.
        """
        # 1. Antivirus Scan Hook
        if not scan_file(file_bytes):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload rejected: File failed security/antivirus scan."
            )

        # 2. Size Validation
        size_mb = len(file_bytes) / (1024 * 1024)
        if size_mb > max_size_mb:
            logger.warning(f"Upload blocked: {filename} size {size_mb:.2f}MB exceeds limit of {max_size_mb}MB.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Upload rejected: File size ({size_mb:.2f}MB) exceeds limit of {max_size_mb}MB."
            )

        # 3. MIME type validation (image/jpeg, image/png, image/webp, video/mp4 only)
        allowed_mimes = {"image/jpeg", "image/png", "image/webp", "video/mp4"}
        content_type_lower = content_type.lower()
        if content_type_lower not in allowed_mimes:
            logger.warning(f"Upload blocked: Unsupported MIME type '{content_type}' for {filename}.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Upload rejected: Unsupported file type '{content_type}'. Allowed types: {', '.join(allowed_mimes)}"
            )

        # 4. Extension Check
        _, ext = os.path.splitext(filename.lower())
        if ext in DISALLOWED_EXTENSIONS or not ext:
            logger.warning(f"Upload blocked: Dangerous extension '{ext}' in file {filename}.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Upload rejected: Dangerous or invalid file extension '{ext}'."
            )

        # 5. Magic Bytes Check
        if "image" in content_type_lower:
            try:
                img = Image.open(io.BytesIO(file_bytes))
                img.verify()
            except Exception as e:
                logger.error(f"Image integrity validation failed for {filename}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Upload rejected: Corrupt or spoofed image file signature."
                )
        elif "video" in content_type_lower:
            if len(file_bytes) > 12:
                header = file_bytes[:12]
                is_valid_video = (b"ftyp" in header or b"RIFF" in header or b"webm" in header or b"matroska" in header or b"FLV" in header)
                if not is_valid_video:
                    logger.warning(f"Upload blocked: Invalid video header signature for {filename}.")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Upload rejected: Invalid video file signature."
                    )

        return True

security_service = SecurityService()
