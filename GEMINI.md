# Project Instructions: Collaborative Notes App

This file contains the foundational mandates and architectural rules for the Collaborative Notes App. Adhere to these strictly.

## 1. Coding Standards
- **Components:** Use Functional Components with Hooks. Prefer the `const ComponentName = () => {}` syntax.
- **Styling:** Use Tailwind CSS exclusively for styling. Avoid custom CSS files unless absolutely necessary for complex animations.
- **Typing:** Use TypeScript-like JSDoc or clear variable naming to maintain clarity (even if in a JS project).
- **State Management:** 
  - Use React Context for Global Auth and UI state.
  - Use local `useState` for editor content to minimize re-render lag.
  - Use `useEffect` for Socket.io listeners.

## 2. Backend Rules
- **Error Handling:** Always wrap async route handlers in a try-catch block or use a higher-order `asyncHandler` wrapper.
- **Responses:** Follow a consistent JSON response structure: `{ success: boolean, data?: any, error?: string }`.
- **Validation:** Use `express-validator` or simple custom middleware to validate incoming request bodies.
- **Mongoose Middleware:** NEVER use the `next` callback parameter in Mongoose hooks (e.g., `schema.pre('save')`). Mongoose v9 requires you to use standard `async/await` or synchronous functions without calling `next()`.

## 3. Real-time Implementation
- **Throttling:** Implement client-side throttling for `send-changes` events to prevent flooding the server during rapid typing.
- **Room Logic:** Ensure users are properly joined/leaved from rooms to prevent cross-contamination of note data.

## 4. File Organization
- Follow the directory structure defined in `architecture.md`.
- Group related logic (e.g., all note-related API routes in `routes/notes.js`).

## 5. Development Workflow
- **Validation:** After every major change, run the frontend and backend to verify basic connectivity.
- **Testing:** Add manual or automated tests for Auth and Note CRUD before moving to Phase 3 (Real-time).
