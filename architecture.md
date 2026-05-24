# System Architecture - Collaborative Notes App

## 1. High-Level Design
The application follows a Client-Server architecture with a real-time synchronization layer.
- **Frontend:** React SPA (Vite) for the UI.
- **Backend:** Node.js Express server for REST APIs and Socket.io for WebSockets.
- **Database:** MongoDB for persistent storage of users and notes.

## 2. Directory Structure (Monorepo)
```text
/collaborative-notes-app
├── client/                 # React Frontend
│   ├── src/
│   │   ├── pages/          # Page-level components & inline UI components
│   │   ├── context/        # Auth & Note Contexts (includes API service requests)
│   │   └── hooks/          # Custom React hooks (includes speech recognition)
├── server/                 # Node.js Backend
│   ├── models/             # Mongoose Schemas
│   ├── routes/             # Express Route Handlers
│   ├── middleware/         # Auth & Validation
│   └── sockets/            # Socket.io Event Handlers (Integrated in index.js)
├── SRS.md
├── architecture.md
└── GEMINI.md
```

## 3. Data Models (MongoDB/Mongoose)

### 3.1 User Schema
- `email`: String (Unique, Required)
- `password`: String (Hashed)
- `name`: String
- `createdAt`: Date

### 3.2 Note Schema
- `title`: String
- `content`: Mixed (Array of JSON blocks representing BlockNote state)
- `yjsState`: Buffer (Binary state for Yjs collaboration history)
- `owner`: ObjectId (Ref: User)
- `collaborators`: [ObjectId] (Ref: User)
- `tags`: [String]
- `folder`: String
- `updatedAt`: Date

## 4. API Contract (REST)

### 4.1 Auth
- `POST /api/auth/register`: `{ email, password, name }` -> `{ token, user }`
- `POST /api/auth/login`: `{ email, password }` -> `{ token, user }`

### 4.2 Notes
- `GET /api/notes`: Returns list of notes (owned or shared).
- `POST /api/notes`: `{ title, folder }` -> Returns new note object.
- `GET /api/notes/:id`: Returns full note details.
- `PUT /api/notes/:id`: Updates metadata (title, tags, folder).
- `DELETE /api/notes/:id`: Deletes note.

## 5. WebSocket Protocol (Socket.io & Yjs)
Clients connect and join a "room" identified by the `noteId`. Sockets verify the user's JWT token during the initial handshake, and the server checks room permissions (`owner` or `collaborator`) before allowing room entry.

### Events:
- `join-note(noteId)`: Client requests authorization to join a specific note's room. Server validates permissions and responds with the current binary state (`init-note-state`).
- `update-note-content({ noteId, update })`: Client sends Yjs binary updates to the server.
- `receive-update(update)`: Server broadcasts document updates to other collaborators in the room.
- `update-awareness({ noteId, awarenessUpdate })`: Client broadcasts their local presence state (cursor position, name, color).
- `receive-awareness(awarenessUpdate)`: Server broadcasts presence updates to other collaborators.
- `save-to-db({ noteId, blocks })`: Client debounces and sends the structured JSON blocks to be persisted to MongoDB along with the current binary Yjs state.

## 6. Security
- JWT for all `/api/notes/*` routes.
- Socket.io connection will require JWT verification during the handshake.
- Ownership check middleware for any write/delete operations on notes.
