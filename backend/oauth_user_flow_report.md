# OAuth User Flow Report (Phase 5)

This report details the execution and validation of the New User creation and Existing User update flows on the `/sync-oauth` endpoint.

## DB User Schema Provider Columns
As noted, Supabase acts as the primary identity manager and forwards verified unique user IDs (`UUID`). The application's `public.users` table holds the user representation mapped by this unique `id` (matching the Supabase Auth UUID). This eliminates the need for redundant `provider` or `provider_id` fields in the local database.

---

## Test Execution Results

### 1. New User Flow
- **Input:** Unique user UUID, random email, name: `"Original OAuth Name"`, and avatar URL.
- **Endpoint Response:** `200 OK`
- **Token Output:** Access token successfully generated containing the subject and JWT ID.
- **Database Verification:**
  - `User` record successfully created.
  - Correct email, name, and avatar URL persisted.
  - Active `UserSession` successfully initialized (Sessions count: 1).

### 2. Existing User Flow (Update)
- **Input:** Same user UUID, same email, but updated name: `"Updated OAuth Name"` and updated avatar URL.
- **Endpoint Response:** `200 OK`
- **Token Output:** Access token successfully generated.
- **Database Verification:**
  - Existing `User` record updated to new full name and avatar URL.
  - Email constraint preserved.
  - A new active `UserSession` successfully added for this login event (Sessions count: 2).
