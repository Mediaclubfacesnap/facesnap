# FaceSnap v1.0 Master QA Checklist

## 1. Authentication & Roles
- [ ] User can sign up with a new account
- [ ] User can log in
- [ ] User can log out
- [ ] Roles are properly assigned (Admin vs. User)
- [ ] JWT tokens expire and refresh properly
- [ ] Rate limits prevent brute-force attacks on login

## 2. Communities
- [ ] Users can create a community
- [ ] Users can join a community
- [ ] Users can leave a community
- [ ] Community owner can edit community details
- [ ] Community owner can remove members
- [ ] Community gallery displays only to members

## 3. Events & Registration
- [ ] Event can be created within a community
- [ ] Event dates and limits are enforced
- [ ] User can register for an event (generates QR/Ticket)
- [ ] Event host can scan/verify tickets
- [ ] Event gallery groups photos by event

## 4. Media & Face Matching
- [ ] Uploading a photo saves it to S3/Local Storage
- [ ] Uploading triggers Celery worker for EXIF extraction
- [ ] Uploading triggers Celery worker for Face Detection (MTCNN)
- [ ] "Photos of Me" correctly identifies user in new uploads
- [ ] Face match notification is sent (Push/In-App) when user is detected
- [ ] AI Highlights successfully cluster faces into albums

## 5. Messaging
- [ ] User can send direct messages
- [ ] User can view message history
- [ ] User can report abusive messages
- [ ] Real-time or polled delivery works smoothly

## 6. Global Search
- [ ] Search by User works
- [ ] Search by Community works
- [ ] Semantic search (pgvector) returns relevant photo matches

## 7. Admin Operations (Phase 5H)
- [ ] Operations Dashboard loads live telemetry
- [ ] User Management: Can suspend a user
- [ ] Maintenance: Can enable global lockout
- [ ] Feature Flags: Can toggle features on/off
- [ ] Incidents: Can declare and resolve incidents
- [ ] Storage: Correctly estimates disk usage
- [ ] Health: Correctly pings DB, Redis, and Workers

## 8. Mobile / PWA
- [ ] App can be installed on Android/Chrome
- [ ] App can be installed on iOS Safari
- [ ] Offline fallback page works
- [ ] Background sync registers failed actions

---
**Sign-off Criteria**: >95% Pass Rate required for Launch.
