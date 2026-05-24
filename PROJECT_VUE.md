# Collaborative Notes App: Technical Reference & FAQ

This document serves as a "Cheat Sheet" for understanding the architecture, terminology, and logic of this project.

## 1. High-Level Architecture
The app follows a **3-Tier Full-Stack Architecture** with a **Real-Time Event Synchronization** layer.

*   **Frontend (Presentation):** React (Vite), Tailwind CSS, Lucide Icons.
*   **Backend (Logic):** Node.js, Express, Socket.io.
*   **Database (Data):** MongoDB Atlas (NoSQL), Mongoose (ODM).



---

## 2. Key Technical Terms

### State Management
The process of keeping track of information that changes over time (like what you are typing or if you are logged in).
*   **React Context API:** Used for "Global" state (like Auth and Notes list) so it can be shared across the whole app without passing props manually.

### REST API (Representational State Transfer)
A standardized way for the browser to ask the server to do a specific task (Create, Read, Update, Delete) using a URL. It's like a **Restaurant Menu**: you order, you get your food, the transaction ends.
*   **Used for:** Login, Registration, Fetching the list of notes, and Persistent Saving.

### WebSockets (Socket.io)
A permanent, two-way pipe between the browser and the server. It's like a **Phone Call**: both sides can talk instantly without hanging up.
*   **Used for:** Real-time collaboration. When you type, the change is "pushed" to other users immediately.

### JWT (JSON Web Tokens)
A secure way to prove who you are. After logging in, the server gives you a "Digital Passport" (the token). You send this passport with every request to prove you have permission to see your notes.

---

## 3. The "Journey" of a Keystroke
When a user types a letter in the editor, the upgraded collaboration flow handles it as follows:
1.  **Local Update:** The local Yjs document captures the keystroke and updates the BlockNote editor immediately for zero lag.
2.  **Sync (WebSocket):** The incremental change is converted to a binary delta update and sent to the server via Socket.io (`update-note-content`), which instantly broadcasts it to all other active collaborators (`receive-update`).
3.  **Debouncing:** A local timer waits for the user to pause typing (e.g., for 3 seconds).
4.  **Persistence (WebSocket):** Once the timer fires, the editor's current block structure is emitted to the server via a `save-to-db` Socket.io event, saving both the structured JSON blocks and the binary Yjs state to MongoDB.

---

## 4. Security Features
*   **Password Hashing:** We use **Bcrypt.js** to turn passwords into unreadable gibberish before saving them. Even if a hacker steals the database, they won't see your password.
*   **Protected Routes:** A custom **Middleware** on the backend checks the JWT token on every request. If you aren't logged in, the server blocks you.
*   **Ownership Scoping:** The backend ensures that even if you are logged in, you can only see notes where your `userId` is listed as the `owner` or a `collaborator`.

---

## 5. Frequently Asked Questions (FAQ)

### Why is my MongoDB size 116MB when I only typed one sentence?
MongoDB Atlas pre-allocates space (WiredTiger engine) and maintains system metadata, indexes (for fast searching), and logs. Most of that space is "reserved" for future growth to keep the app fast.

### Why did we use MongoDB instead of SQL?
Notes are hierarchical and flexible (they can have different tags, folders, or content lengths). MongoDB's JSON-like format matches the way we think about "Documents" much better than a rigid SQL table.

### What is the purpose of `GEMINI.md`?
It acts as the "Source of Truth" or "Brain" for the project. It contains specific architectural rules (like how to handle Mongoose v9 hooks) so that any future AI or developer working on the project follows the same standards.

### Why did we get the "next is not a function" error?
In Mongoose v9, `async` hooks (like pre-save) return a Promise. Older styles used a `next()` callback. Using both at once causes a conflict. We updated the code to the modern `async/await` standard.

---

## 6. How to Run the Project
1.  **Backend:** `cd server && npm run dev` (Runs on port 5050).
2.  **Frontend:** `cd client && npm run dev` (Runs on port 5173).
3.  **Database:** Requires a `.env` file with a valid `MONGODB_URI` from MongoDB Atlas.
