# Collaborative Notes App

A professional, real-time collaborative block editor (Notion-style) with integrated Voice-to-Text dictation.

## 🚀 Key Features
- **Block-Based Editor:** Slash commands (`/`), drag-and-drop, and rich formatting powered by **BlockNote**.
- **Real-Time Collaboration:** Conflict-free synchronization using **Yjs (CRDTs)** and **WebSockets**.
- **Visual Presence:** Live multi-user cursors with labels and active collaborator avatars.
- **Voice-to-Text Dictation:** Hands-free note-taking with **Smart Voice Commands** (e.g., say "Checklist" to create a checkbox).
- **Secure Auth:** JWT-based authentication for both REST APIs and real-time Socket connections.
- **Cloud Persistence:** Notes are automatically saved to **MongoDB Atlas**.

## 🛠️ Tech Stack
- **Frontend:** React (Vite), Tailwind CSS, Mantine, BlockNote, Yjs.
- **Backend:** Node.js, Express, Socket.io.
- **Database:** MongoDB (Mongoose).

## 📦 Local Setup

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account

### 1. Backend Setup
```bash
cd server
npm install
# Create a .env file with:
# PORT=5050
# MONGODB_URI=your_mongodb_atlas_uri
# JWT_SECRET=your_secret_key
npm run dev
```

### 2. Frontend Setup
```bash
cd client
npm install
npm run dev
```

## 📜 Documentation
- [PROJECT_VUE.md](./PROJECT_VUE.md) - Deep dive into the 3-Tier Architecture and Data Flow.
- [BLOCK_EDITOR_DESIGN.md](./BLOCK_EDITOR_DESIGN.md) - Technical design of the Block Editor and CRDT layer.
- [SRS.md](./SRS.md) - Software Requirements Specification.
- [architecture.md](./architecture.md) - System architecture and API contracts.

## 🏗️ Development
This project follows a "Documentation-First" approach and adheres to modern Mongoose v9 standards.
