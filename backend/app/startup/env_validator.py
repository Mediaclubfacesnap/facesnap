import os
import logging
from app.config import settings

logger = logging.getLogger(__name__)

def validate_environment():
    """
    Validates that the required environment variables are set.
    If any critical variables are missing or use default placeholders in staging/production,
    it raises a ValueError to prevent starting the application in an insecure or misconfigured state.
    """
    # Define required keys
    required_keys = [
        "DATABASE_URL",
        "JWT_SECRET",
        "REDIS_URL",
        "SUPABASE_URL",
        "SUPABASE_KEY"
    ]
    
    # We want to check environment mode
    env_mode = os.environ.get("ENVIRONMENT", settings.ENVIRONMENT if hasattr(settings, "ENVIRONMENT") else "development").lower()
    
    logger.info(f"Validating environment configurations for mode: {env_mode}")
    
    missing_keys = []
    for key in required_keys:
        val = os.environ.get(key)
        # If not in env, check settings (Settings class reads from .env / defaults)
        if not val:
            val = getattr(settings, key, None)
            
        if not val:
            missing_keys.append(key)
            
    if missing_keys:
        error_msg = f"CRITICAL STARTUP ERROR: Missing required environment variables: {', '.join(missing_keys)}"
        logger.critical(error_msg)
        raise ValueError(error_msg)
        
    # Security check: Check for default JWT secret in non-development modes
    jwt_secret = os.environ.get("JWT_SECRET") or getattr(settings, "JWT_SECRET", None)
    default_jwt_secret = "7a4bb7123ee978cd2a73ef56bfd31e9c8cfd9016e78dbf6b8df817ea89098ca3"
    
    if env_mode in ["production", "staging"] and jwt_secret == default_jwt_secret:
        error_msg = "CRITICAL SECURITY ERROR: Default JWT_SECRET is not allowed in staging or production environments!"
        logger.critical(error_msg)
        raise ValueError(error_msg)
        
    logger.info("Environment configuration validation passed successfully.")
