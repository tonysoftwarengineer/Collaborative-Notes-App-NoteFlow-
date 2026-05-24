# Software Requirements Specification (SRS) - Collaborative Notes App

## 1. Introduction
The Collaborative Notes App is a web-based platform designed for real-time collaboration. Users can create, edit, share, and organize notes. Changes made by one user are instantly reflected for all other users currently viewing the same note.

## 2. User Roles
- **Guest:** Can view the landing page and sign up/log in.
- **User:** A registered account that can create notes, own notes, and be invited to collaborate on others' notes.

## 3. Functional Requirements

### 3.1 User Authentication
- **FR-1:** Users must be able to register with an email and password.
- **FR-2:** Users must be able to log in to access their notes.
- **FR-3:** Sessions must be persisted via JWT (JSON Web Tokens).

### 3.2 Note Management
- **FR-4:** Users can create new notes with a title and content.
- **FR-5:** Users can edit note titles and content.
- **FR-6:** Users can delete notes they own.
- **FR-7:** Users can list all notes they own or have been invited to.
- **FR-8:** Users can organize notes using tags (array of strings) and folders (single string).

### 3.3 Real-time Collaboration
- **FR-9:** Multiple users can open the same note simultaneously.
- **FR-10:** Content changes must be synchronized in real-time across all active viewers using WebSockets.
- **FR-11:** (Optional/Stretch) Visual indicators for other users active in the same note.

### 3.4 Sharing & Permissions
- **FR-12:** A note owner can share a note with another user by their email address.
- **FR-13:** Only the owner and authorized collaborators can view or edit a note.

## 4. User Interface Requirements
- **Dashboard:** A sidebar showing folders/tags and a list of notes.
- **Editor:** A clean, focused workspace for writing.
- **Auth Pages:** Minimalist Login and Sign-up forms.
- **Responsiveness:** The UI should be usable on desktop and tablet browsers.

## 5. Non-Functional Requirements
- **Performance:** Synchronization latency should be under 200ms for a smooth experience.
- **Security:** Passwords must be hashed using bcrypt. Sensitive data must not be exposed in the frontend.
- **Reliability:** Note content should be periodically persisted to the database to prevent data loss.

## 6. User Flows
1. **Onboarding:** Landing Page -> Sign Up -> Dashboard.
2. **Note Creation:** Dashboard -> "New Note" -> Editor -> Real-time sync begins.
3. **Collaboration:** User A opens Note -> User A shares with User B -> User B opens Note -> Both see each other's changes.
