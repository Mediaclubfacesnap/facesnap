# Root Cause Analysis: Deploy Event CORS Failure

## 1. Exact Traceback
The frontend CORS error masks a backend `500 Internal Server Error` originating from SQLAlchemy. Since the startup sequence optimization decoupled the `create_all()` automatic schema migrations, the newly added fields for `Event` (Phase 6 features) do not exist in the active database table.

```python
Traceback (most recent call last):
  File "fastapi/routing.py", line ..., in app
    response = await func(**kwargs)
  File "backend/app/routes/events.py", line 96, in create_event
    await db.commit()
  File "sqlalchemy/ext/asyncio/session.py", line ..., in commit
    ...
sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedColumn) column "category" of relation "events" does not exist
LINE 1: INSERT INTO events (..., category, max_participants, registration_deadline) ...
```

## 2. Exact Failing File
`backend/app/routes/events.py`

## 3. Exact Failing Line
Line 96: `await db.commit()` inside the `POST /{community_id}` endpoint (and similarly `await db.execute(select(Event)...)` in `GET /{event_id}`).

## 4. Exact Code Fix
The backend code (`events.py`) and schema (`schemas.py`, `models.py`) are completely correct. The crash is purely a **Missing database columns** issue (Item #2 on your provided checklist). Because we removed automatic schema generation from the `main.py` startup for performance reasons in the previous session, the `events` table in the development database is currently lacking `category`, `max_participants`, and `registration_deadline`.

**Fix:**
Run the schema migration script manually to apply the pending `ALTER TABLE` statements and synchronize the database with the updated `Event` model:
```bash
python scripts/migrate_schema.py
```
*(I have already reverted my debugging `try...except` wrapper so the code is perfectly clean again).*

## 5. Confirmation
Once the database schema is synchronized by running the script above, `POST /api/v1/events/{community_id}` will succeed without a 500 error, successfully inserting the event. Following this, the event will exist in the database and `GET /api/v1/events/{event_id}` will return `200 OK`, allowing the frontend dashboard to render the event without the CORS/500 errors.
