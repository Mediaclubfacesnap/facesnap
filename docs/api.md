# FaceSnap API Reference

FaceSnap's backend is built on FastAPI and follows RESTful paradigms. All request and response bodies are JSON unless specified otherwise. Authentication is enforced via OAuth2 bearer JWT tokens.

---

## 1. Authentication (`/api/v1/auth`)

Endpoints for user registration, session management, and authentication tokens.

### User Registration
- **URL**: `/api/v1/auth/signup`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "username": "johndoe",
    "email": "john@example.com",
    "password": "securepassword",
    "full_name": "John Doe"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "id": "uuid-string",
    "username": "johndoe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "created_at": "2026-06-12T20:00:00Z"
  }
  ```

### User Login
- **URL**: `/api/v1/auth/login`
- **Method**: `POST`
- **Body (form-data)**:
  - `username`: john@example.com (or username)
  - `password`: securepassword
- **Response** (200 OK):
  ```json
  {
    "access_token": "jwt-token-string",
    "token_type": "bearer",
    "user": {
      "id": "uuid-string",
      "username": "johndoe",
      "email": "john@example.com"
    }
  }
  ```

---

## 2. Communities (`/api/v1/communities`)

Private groups, invite-based onboarding, and media galleries.

### Create Community
- **URL**: `/api/v1/communities`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "title": "Family Trip 2026",
    "description": "Photos from the family summer trip",
    "category": "Travel",
    "visibility": "PRIVATE"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "id": "community-uuid",
    "title": "Family Trip 2026",
    "description": "Photos from the family summer trip",
    "category": "Travel",
    "creator_id": "user-uuid",
    "visibility": "PRIVATE",
    "archived_at": null,
    "created_at": "2026-06-12T20:05:00Z"
  }
  ```

### Archive Community
- **URL**: `/api/v1/communities/{community_id}/archive`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (200 OK):
  ```json
  {
    "message": "Community successfully archived. All members are restricted to read-only."
  }
  ```

---

## 3. Events (`/api/v1/events`)

Retrieve, create, and manage community events.

### Create Event
- **URL**: `/api/v1/events`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "community_id": "community-uuid",
    "title": "Welcome Dinner",
    "description": "Arrival dinner at the lodge",
    "location": "Lodge Main Hall",
    "date": "2026-07-15"
  }
  ```

---

## 4. Photos (`/api/v1/photos`)

Retrieve and confirm personal face matches.

### Get My Photos
- **URL**: `/api/v1/photos/me`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**:
  - `section`: `all`, `favorites`, `recent` (default: `all`)
  - `limit`: `20`
  - `offset`: `0`
- **Response** (200 OK):
  ```json
  [
    {
      "match_id": "match-uuid",
      "media_id": null,
      "photo_id": "photo-uuid",
      "file_url": "https://storage.facesnap.com/events/...",
      "confidence": 0.92,
      "status": "approved",
      "is_favorite": false,
      "is_hidden": false,
      "title": "dinner.jpg",
      "community_title": "Family Trip 2026",
      "created_at": "2026-06-12T20:10:00Z"
    }
  ]
  ```

### Confirm Match
- **URL**: `/api/v1/photos/{match_id}/confirm`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (200 OK):
  ```json
  {
    "message": "Match approved successfully.",
    "status": "approved"
  }
  ```

---

## 5. Search (`/api/v1/search`)

Privacy-scoped vector search queries.

### Global Search
- **URL**: `/api/v1/search/global`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**:
  - `q`: Search query string
- **Response** (200 OK): Lists matched users, communities, events, photos, and memories scoped to the caller's permissions.

---

## 6. Notifications (`/api/v1/notifications`)

Fetch system, match, and community notifications.

### List My Notifications
- **URL**: `/api/v1/notifications`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (200 OK): Array of active notification objects.
