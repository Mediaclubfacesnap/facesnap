import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres.bcahxnvuodsslmeqdnin:Mediaclubfacesnap@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
    SUPABASE_URL: str = "https://bcahxnvuodsslmeqdnin.supabase.co"
    SUPABASE_KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjYWh4bnZ1b2Rzc2xtZXFkbmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTUzMzMzNCwiZXhwIjoyMDk1MTA5MzM0fQ.4tWm0p1mxUCfGjoWvV74GD2zW-hbIsWPgl-WZQGgg88"
    SUPABASE_BUCKET: str = "facesnap-memories"
    
    JWT_SECRET: str = "7a4bb7123ee978cd2a73ef56bfd31e9c8cfd9016e78dbf6b8df817ea89098ca3"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
