# Collaborative Notes App Implementation Plan

## Objective
Build a full-stack real-time collaborative notes application where multiple users can create, edit, and share notes simultaneously. The app will feature user authentication, real-time synchronization, and basic organization (tags/folders).

## Technology Stack
*   **Frontend:** React (Vite), Tailwind CSS, React Router
*   **Backend:** Node.js, Express
*   **Database:** MongoDB, Mongoose
*   **Real-time:** Socket.io
*   **Authentication:** JWT, bcrypt

## Architecture & Data Schema
### MongoDB Schema
*   **User:** `_id`, `email`, `passwordHash`, `name`, `createdAt`
*   **Note:** `_id`, `title`, `content` (text or rich text state), `ownerId` (ref User), `collaboratorIds` (array of ref User), `tags` (array of strings), `folder` (string), `createdAt`, `updatedAt`

### API Endpoints (REST + WebSocket)
*   **Auth REST:**
    *   `POST /api/auth/register`
    *   `POST /api/auth/login`
*   **Notes REST:**
    *   `GET /api/notes` (List user's notes)
    *   `POST /api/notes` (Create new note)
    *   `GET /api/notes/:id` (Get note details)
    *   `PUT /api/notes/:id` (Update note metadata/content via API)
    *   `DELETE /api/notes/:id` (Delete note)
*   **WebSocket Events (Socket.io):**
    *   `join-note`: Client joins a specific note room using Note ID.
    *   `send-changes`: Client sends content updates to the server.
    *   `receive-changes`: Server broadcasts updates to other connected clients in the same room.

## Phased Implementation Plan

### Phase 0: Foundation & Specification (Documentation-First)
1.  **Draft `SRS.md`:** Define strict software requirements, user flows, and edge cases.
2.  **Draft `architecture.md`:** Detail system design, data models, API contracts, and Socket.io event payloads.
3.  **Draft `GEMINI.md`:** Establish project-specific coding conventions, styling rules, and architectural patterns for AI guidance.
4.  **Draft `README.md`:** Create local setup instructions, environment variable templates, and project overview.

### Phase 1: Project Setup & Auth
1.  Initialize frontend (Vite React) and backend (Node.js/Express) in a monorepo or separate folders.
2.  Set up MongoDB connection (e.g., MongoDB Atlas) and define the User schema.
3.  Implement JWT-based authentication flow (Register, Login) on the backend.
4.  Create frontend Auth context, Login/Register pages, and protect application routes.

### Phase 2: Core Notes CRUD
1.  Create the Note schema in MongoDB.
2.  Implement REST API routes for creating, reading, updating, and deleting notes, secured by JWT middleware.
3.  Build frontend UI: A Dashboard sidebar to list notes, and a generic editor layout.

### Phase 3: Real-time Synchronization
1.  Integrate Socket.io into the Node.js server and connect the React client.
2.  Implement room joining logic on the server when a user opens a note.
3.  Implement collaborative text editing sync.
4.  Save document state periodically or on unmount to MongoDB to persist real-time changes.

### Phase 4: Organization & Bonus Features
1.  Add tags and folder organization UI to the Dashboard.
2.  Implement a sharing mechanism.

## Verification & Testing
*   **Documentation:** Review specifications before coding.
*   **Auth:** Verify successful user registration, login, and secure route access.
*   **CRUD:** Test creating, editing, and deleting notes.
*   **Real-time:** Open the same note in two different browser windows and verify sync.
