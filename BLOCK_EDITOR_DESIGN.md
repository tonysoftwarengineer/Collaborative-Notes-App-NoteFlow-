# Final Design: Collaborative Block Editor Upgrade

## 1. Executive Summary
This project upgrades the "Collaborative Notes App" from a basic plain-text MVP to a professional-grade, block-based collaborative editor. The upgrade focuses on three core pillars: **Conflict-Free Synchronization (CRDTs)**, **Hardened WebSocket Security**, and a **Notion-style User Experience**.

## 2. System Architecture

### 2.1 The Sync Engine (CRDTs)
*   **Library:** Yjs (Conflict-free Replicated Data Types).
*   **Logic:** Every character and block is assigned a unique, immutable ID. Yjs merges concurrent edits from multiple users mathematically, ensuring that the document state is identical across all clients without a central "authority" overwriting data.
*   **Awareness:** Real-time presence (cursors and user names) is handled via the Yjs Awareness protocol, ensuring cursors stay attached to the correct text regardless of document growth.

### 2.2 Transport Layer
*   **Protocol:** WebSockets via Socket.io.
*   **Provider:** A custom Yjs-Socket.io provider will be used to sync binary document updates between the React client and the Node.js server.

## 3. Security & Data Schema

### 3.1 Hardened Authentication
*   **Handshake Security:** Socket.io connections will use a middleware to verify JWT tokens during the initial handshake.
*   **Room Authorization:** Before joining a room (`socket.join(noteId)`), the server will verify in MongoDB that the `userId` has `owner` or `collaborator` permissions for that specific note.

### 3.2 MongoDB Schema Update
*   **Field:** `content`
*   **Type:** `Mongoose.Schema.Types.Mixed`
*   **Structure:** An array of JSON objects representing the BlockNote state (e.g., `[{ "id": "...", "type": "paragraph", "content": [...] }]`).

## 4. UI/UX Specification
*   **Editor:** BlockNote.js.
*   **Interactions:** 
    *   Slash commands (`/`) for block types.
    *   Drag-and-drop block reordering.
    *   Floating formatting toolbar for text selection.
    *   Real-time multi-user cursors with labels.

## 5. Decision Log
| Decision | Alternative | Reasoning |
| :--- | :--- | :--- |
| **Yjs (CRDT)** | Raw Sockets / OT | Ensures zero data loss during concurrent edits; less complex than OT. |
| **Mixed JSON Schema** | Rigid Sub-documents | Provides flexibility for new block types without database migrations. |
| **Yjs Awareness** | Mouse Coordinates | Cursors stay relative to text/blocks even as content moves. |
| **Socket.io JWT** | Unsecured Sockets | Prevents unauthorized users from sniffing real-time data streams. |

## 6. Implementation Strategy
*   **Phase 1:** Install dependencies and harden Socket.io security middleware.
*   **Phase 2:** Update Backend Note schema and Note routes to handle JSON content.
*   **Phase 3:** Integrate BlockNote and Yjs on the Frontend.
*   **Phase 4:** Implement Presence (Cursors) and final UI polish.
