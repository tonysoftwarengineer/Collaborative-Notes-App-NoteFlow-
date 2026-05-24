### Design Section 3: UI & Collaborative Presence

To make the app truly "stand out," we are implementing a minimalist, interactive UI that focuses on the **Notion experience**.

#### **1. The Block Interface**
*   **Slash Commands:** Typing `/` will trigger a popover menu allowing the user to choose between Paragraph, Heading 1, 2, 3, Bullet List, Checkbox List, or Quote.
*   **Drag-and-Drop:** Every block will have a "six-dot" handle on the left, allowing users to reorder content effortlessly.
*   **Contextual Toolbar:** Selecting text will show a floating toolbar for Bold, Italic, Strikethrough, and Code formatting.

#### **2. Collaborative Presence (The "Wow" Factor)**
*   **Multi-User Cursors:** Using the **Yjs Awareness** protocol, we will sync the cursor positions of every active user in real-time.
*   **User Identification:** Cursors will be color-coded and display the user's name (e.g., "John is typing...") floating above their cursor.
*   **Activity Indicators:** The top-right of the editor will show a row of small circular avatars for everyone currently viewing the note.

#### **3. Performance & Polish**
*   **Optimistic UI:** When you change a block type (e.g., turning a Paragraph into a Heading), the UI updates instantly locally while the server verifies the change in the background.
*   **Zero Flicker:** Because we are using Yjs, there is no "re-fetch" that overwrites the screen. The editor state is reactive and only updates the specific parts of the document that changed.

#### **Technical Decision Log (Entry #3)**
*   **Decision:** Use **Yjs Awareness** instead of raw Socket.io for cursor tracking.
*   **Alternative:** Sending `mousemove` events over Socket.io.
*   **Reasoning:** Yjs Awareness is optimized for document-relative positions. If User A adds 5 lines of text at the top, User B's cursor will correctly "push down" to stay at the right word. Raw mouse coordinates would stay in the same place on the screen, appearing in the wrong part of the text.

**Does this final UI and Presence design look right to you?** 
*(Once confirmed, I will provide the final "Understanding Lock" summary and we can move to implementation.)*
