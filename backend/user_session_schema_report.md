# UserSession Schema Report (Phase 2)

This report validates the schema of the `UserSession` model and database table to detect any mismatches.

## UserSession Model Definition (from models.py)
```python
class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    jti = Column(String, unique=True, index=True, nullable=False)
    device_name = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    os = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    country = Column(String, nullable=True)
    city = Column(String, nullable=True)
    last_active = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    is_current = Column(Boolean, default=False, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
```

## UserSession Database Definition (PostgreSQL)
```text
Column: id          | Type: uuid                     | Nullable: NO
Column: user_id     | Type: uuid                     | Nullable: NO
Column: jti         | Type: character varying        | Nullable: NO
Column: device_name | Type: character varying        | Nullable: YES
Column: browser     | Type: character varying        | Nullable: YES
Column: os          | Type: character varying        | Nullable: YES
Column: ip_address  | Type: character varying        | Nullable: YES
Column: country     | Type: character varying        | Nullable: YES
Column: city        | Type: character varying        | Nullable: YES
Column: last_active | Type: timestamp with time zone | Nullable: NO
Column: is_current  | Type: boolean                  | Nullable: NO
Column: is_revoked  | Type: boolean                  | Nullable: NO
Column: created_at  | Type: timestamp with time zone | Nullable: NO
Column: expires_at  | Type: timestamp with time zone | Nullable: NO
```

## Field Existence Verification
* `id`: **YES** (UUID)
* `user_id`: **YES** (UUID)
* `jti`: **YES** (character varying / String)
* `session_token`: **NO** (Neither the SQLAlchemy model nor the DB table has this column. The code uses JWT `jti` for tracking session state instead of opaque session tokens).
* `device_name`: **YES** (character varying / String)
* `browser`: **YES** (character varying / String)
* `os`: **YES** (character varying / String)
* `ip_address`: **YES** (character varying / String)
* `is_current`: **YES** (boolean)
* `is_revoked`: **YES** (boolean)
* `expires_at`: **YES** (timestamp with time zone)
* `created_at`: **YES** (timestamp with time zone)

## Schema Mismatches
**None.** The code and DB schemas are perfectly aligned. The code uses JWT ID (`jti`) as the session identifier, matching the database `jti` column.
