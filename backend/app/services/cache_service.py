import datetime
import logging
import json
from typing import Any, Optional, Dict
import threading

from app.config import settings

logger = logging.getLogger(__name__)

class LocalMemoryCache:
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._cache:
                entry = self._cache[key]
                if datetime.datetime.utcnow() < entry["expires_at"]:
                    return entry["data"]
                else:
                    del self._cache[key]
            return None

    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        with self._lock:
            expires_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=ttl_seconds)
            self._cache[key] = {
                "data": value,
                "expires_at": expires_at
            }

    def delete(self, key: str):
        with self._lock:
            if key in self._cache:
                del self._cache[key]

    def clear(self):
        with self._lock:
            self._cache.clear()

class HybridCache:
    def __init__(self):
        self.redis_client = None
        self.local_cache = LocalMemoryCache()
        
        try:
            import redis
            self.redis_client = redis.Redis.from_url(
                settings.REDIS_URL, 
                socket_timeout=2.0, 
                socket_connect_timeout=2.0,
                decode_responses=True
            )
            self.redis_client.ping()
            logger.info("Successfully connected to Redis caching service.")
        except Exception:
            self.redis_client = None
            logger.info("Redis offline or not installed. Falling back to high-performance local memory cache.")

    def get(self, key: str) -> Optional[Any]:
        if self.redis_client:
            try:
                val = self.redis_client.get(key)
                if val is not None:
                    return json.loads(val)
            except Exception as e:
                logger.warning(f"Redis read failed, falling back to memory: {e}")
        
        return self.local_cache.get(key)

    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        if self.redis_client:
            try:
                serialized = json.dumps(value, default=str)
                self.redis_client.set(key, serialized, ex=ttl_seconds)
                return
            except Exception as e:
                logger.warning(f"Redis write failed: {e}")
        
        self.local_cache.set(key, value, ttl_seconds)

    def delete(self, key: str):
        if self.redis_client:
            try:
                self.redis_client.delete(key)
                return
            except Exception as e:
                logger.warning(f"Redis delete failed: {e}")
        
        self.local_cache.delete(key)

    def clear(self):
        if self.redis_client:
            try:
                self.redis_client.flushdb()
                return
            except Exception as e:
                logger.warning(f"Redis clear failed: {e}")
        
        self.local_cache.clear()

cache = HybridCache()
