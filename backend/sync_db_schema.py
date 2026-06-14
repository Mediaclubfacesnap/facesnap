import asyncio
import sys
import os
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.types import Boolean, Integer, Float, String, Text, DateTime, Date, JSON, Enum

# Add parent dir to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
import app.models  # load all models

def get_pg_type(col):
    col_type = col.type
    
    # Handle custom types or special mappings
    type_name = str(col_type).lower()
    if "vector" in type_name:
        return type_name # vector(512) etc.
        
    if isinstance(col_type, Boolean):
        default_val = "FALSE"
        if col.default and getattr(col.default, 'arg', None) is True:
            default_val = "TRUE"
        return f"BOOLEAN DEFAULT {default_val}"
        
    if isinstance(col_type, Integer):
        default_val = "0"
        if col.default and getattr(col.default, 'arg', None) is not None:
            default_val = str(col.default.arg)
        return f"INTEGER DEFAULT {default_val}"
        
    if isinstance(col_type, Float):
        default_val = "0.0"
        if col.default and getattr(col.default, 'arg', None) is not None:
            default_val = str(col.default.arg)
        return f"DOUBLE PRECISION DEFAULT {default_val}"
        
    if isinstance(col_type, DateTime):
        return "TIMESTAMPTZ"
        
    if isinstance(col_type, Date):
        return "DATE"
        
    if isinstance(col_type, JSON) or isinstance(col_type, JSONB):
        return "JSONB DEFAULT '{}'::jsonb"
        
    if isinstance(col_type, ARRAY):
        item_type = str(col_type.item_type).upper()
        if item_type == "VARCHAR" or item_type == "STRING":
            item_type = "VARCHAR"
        return f"{item_type}[]"
        
    if isinstance(col_type, UUID):
        return "UUID"
        
    if isinstance(col_type, String):
        return "VARCHAR"
        
    if isinstance(col_type, Text):
        return "TEXT"
        
    if isinstance(col_type, Enum):
        return "VARCHAR(100)"
        
    return "VARCHAR"

async def sync_schema():
    print("Starting database schema sync...")
    async with engine.connect() as conn:
        for table_name, table in Base.metadata.tables.items():
            print(f"Checking table '{table_name}'...")
            
            # Check if table exists
            table_check = await conn.execute(text(
                f"select exists (select from information_schema.tables where table_name = '{table_name}')"
            ))
            exists = table_check.scalar()
            if not exists:
                print(f"Table '{table_name}' does not exist. It will be created by create_all().")
                continue
                
            # Get existing columns
            cols_res = await conn.execute(text(
                f"select column_name from information_schema.columns where table_name = '{table_name}'"
            ))
            existing_cols = {r[0] for r in cols_res.fetchall()}
            
            # Find and add missing columns
            for col_name, col in table.columns.items():
                if col_name not in existing_cols:
                    pg_type = get_pg_type(col)
                    # We make new columns nullable initially to avoid constraints issue on existing rows,
                    # unless it has a default value.
                    nullable_str = "NULL" if col.nullable or "default" not in pg_type.lower() else "NOT NULL"
                    alter_query = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {pg_type}"
                    print(f"Adding column '{col_name}' ({pg_type}) to table '{table_name}'...")
                    try:
                        await conn.execute(text(alter_query))
                        await conn.commit()
                        print(f"Column '{col_name}' added successfully.")
                    except Exception as e:
                        print(f"Error adding column '{col_name}': {e}")
                        
    print("Schema sync complete!")

if __name__ == "__main__":
    asyncio.run(sync_schema())
