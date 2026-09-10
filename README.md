# NoteFlow — Real-Time Collaborative Notes

A full-stack, Notion-style collaborative note-taking application. NoteFlow lets authenticated users create, share, and edit block-based documents together while keeping document state, comments, chat history, and revisions persisted in MongoDB.

## Why I built it

Collaborative editing is more than sending the latest text to every browser: simultaneous edits can conflict, connections can drop, and the app still needs a durable source of truth. NoteFlow explores that problem with CRDT-based synchronization and a separate persistence path.

## What it does

- Create, organize, update, and delete notes
- Edit rich, block-based content with BlockNote
- Collaborate on the same note in real time
- Show active collaborators and cursor/presence updates
- Synchronize document edits with Yjs CRDT updates over Socket.io
- Persist block JSON, searchable plain text, and Yjs binary state in MongoDB
- Authenticate REST requests and WebSocket connections with JWTs
- Support comments, real-time note chat, sharing links, and revision restoration
- Offer guest sign-in for trying the collaboration experience

## Engineering highlights

- Used Yjs CRDTs so concurrent document updates can be merged without a central “last writer wins” conflict.
- Created authenticated Socket.io rooms per note and checked owner, collaborator, or public-access permissions before joining a room.
- Kept active Yjs documents in memory while collaborators are connected, then serialized the Yjs state to MongoDB when the room becomes empty.
- Stored both structured BlockNote JSON and extracted plain text alongside binary CRDT state, balancing editor recovery with useful application data.
- Separated REST APIs (auth, notes, comments, links) from low-latency real-time events (document sync, awareness, chat, comments).
- Implemented protected client routes with React context and React Router.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, React Router, BlockNote, Mantine, Tailwind CSS |
| Real-time collaboration | Socket.io, Yjs, y-protocols |
| Backend | Node.js, Express, JWT, bcryptjs, express-validator |
| Database | MongoDB, Mongoose |
| Tooling | ESLint, Nodemon |

## Architecture

```text
React + BlockNote client
    ├── REST API requests ──→ Express routes ──→ MongoDB
    └── Socket.io events ──→ authenticated note room
                                  ├── Yjs document in memory
                                  ├── collaboration/presence broadcasts
                                  └── persisted Yjs state + note data in MongoDB
```

## Run locally

### Prerequisites

- Node.js 18+
- A MongoDB Atlas connection string or local MongoDB instance

### 1. Clone and install dependencies

```bash
git clone https://github.com/tonysoftwarengineer/Collaborative-Notes-App-NoteFlow-.git
cd Collaborative-Notes-App-NoteFlow-

cd server && npm install
cd ../client && npm install
```

### 2. Configure the server

Create `server/.env`:

```env
PORT=5050
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=use_a_long_random_value
```

> The client currently sends local API requests to `http://localhost:5050`, so keep the server on port 5050 for local development.

### 3. Start the application

In two terminals:

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Repository structure

```text
├── client/
│   └── src/
│       ├── components/  # Editor, command palette, and UI components
│       ├── context/     # Authentication, notes, and theme state
│       ├── hooks/       # Client-side behavior including speech input
│       └── pages/       # Login, dashboard, and editor views
├── server/
│   ├── models/          # Users, notes, comments, chat messages, revisions
│   ├── routes/          # REST API endpoints
│   └── index.js         # Express server and Socket.io collaboration layer
├── architecture.md      # API and real-time event design
└── BLOCK_EDITOR_DESIGN.md
```

## Further reading

- [Architecture and API contract](./architecture.md)
- [Block editor and CRDT design](./BLOCK_EDITOR_DESIGN.md)
- [Software requirements](./SRS.md)
