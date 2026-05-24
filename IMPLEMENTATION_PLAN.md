# Implementation Plan: Collaborative Block Editor Upgrade

## Phase 1: Security Hardening & Dependency Setup
*   **Goal:** Secure the real-time layer and install the core CRDT/Editor libraries.
*   **Tasks:**
    1.  Install backend dependencies: `yjs`, `y-socket.io` (or equivalent provider).
    2.  Install frontend dependencies: `@blocknote/core`, `@blocknote/react`, `yjs`, `y-websocket`.
    3.  Implement JWT authentication middleware for Socket.io.
    4.  Update `server/index.js` to enforce authorization before allowing users to join note rooms.
*   **Verification:** Attempt to connect a socket without a token (should fail) and with a valid token (should succeed).

## Phase 2: Data Schema & API Migration
*   **Goal:** Prepare the database to handle structured JSON blocks.
*   **Tasks:**
    1.  Update `server/models/Note.js` to change `content` to `Mixed` (JSON).
    2.  Update `server/routes/notes.js` to handle JSON payloads instead of strings.
    3.  Create a "Migration script" (or simple logic) to handle existing string-based notes.
*   **Verification:** Use Postman/curl to create a note with a JSON array as content and verify it saves correctly in MongoDB.

## Phase 3: Block Editor & Yjs Integration
*   **Goal:** Replace the textarea with a real-time collaborative block editor.
*   **Tasks:**
    1.  Implement the `BlockNote` editor component in `Editor.jsx`.
    2.  Integrate `Yjs` for document state management.
    3.  Connect the `Yjs` doc to the WebSocket provider for real-time sync.
    4.  Remove the old REST-based auto-save (as Yjs/Websockets handle this now).
*   **Verification:** Open the same note in two windows and verify that typing in one block appears instantly in the other without data loss.

## Phase 4: Presence, Polish & Verification
*   **Goal:** Add the "wow" factor with multi-user cursors and final UI refinements.
*   **Tasks:**
    1.  Implement **Yjs Awareness** to track and display user cursor positions.
    2.  Add name labels and colors to the cursors.
    3.  Add "Active Users" avatar list in the toolbar.
    4.  Final UI styling polish using Tailwind CSS.
*   **Verification:** Verify that cursors move correctly and show the correct user names across different browser windows.
