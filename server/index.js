require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Note = require('./models/Note');
const ChatMessage = require('./models/ChatMessage');
const User = require('./models/User');
const Comment = require('./models/Comment');
const Revision = require('./models/Revision');
const Y = require('yjs');
const path = require('path');

const authRoutes = require('./routes/auth');
const noteRoutes = require('./routes/notes');
const commentRoutes = require('./routes/comments');
const linkRoutes = require('./routes/links');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // In production, replace with client URL
    methods: ['GET', 'POST'],
  },
});

// Socket.io Middleware: JWT Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
    socket.data.userId = decoded.userId;
    socket.data.userName = decoded.name || 'Anonymous';
    socket.data.isGuest = decoded.isGuest || false;
    next();
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/public/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/links', linkRoutes);

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

// Socket.io Logic
const yDocs = new Map();

// Helper to clean up empty note rooms
const cleanUpRoom = async (noteId) => {
  const room = io.sockets.adapter.rooms.get(noteId);
  const numClients = room ? room.size : 0;
  if (numClients === 0) {
    const doc = yDocs.get(noteId);
    if (doc) {
      try {
        const note = await Note.findById(noteId);
        if (note) {
          const yjsState = Buffer.from(Y.encodeStateAsUpdate(doc));
          await Note.findByIdAndUpdate(noteId, { yjsState });
          console.log(`Note ${noteId} finalized and persisted on room empty`);
        }
      } catch (err) {
        console.error(`Error saving note ${noteId} during cleanup:`, err);
      }
      yDocs.delete(noteId);
      console.log(`Cleaned up yDoc for note ${noteId} from server memory.`);
    }
  }
};

// Helper to extract plain text from BlockNote blocks
const extractPlainText = (blocks) => {
  if (!Array.isArray(blocks)) return '';
  let text = '';
  const traverse = (blockList) => {
    for (const block of blockList) {
      if (block.content) {
        if (typeof block.content === 'string') {
          text += block.content + ' ';
        } else if (Array.isArray(block.content)) {
          for (const item of block.content) {
            if (item.text) {
              text += item.text;
            }
          }
          text += ' ';
        }
      }
      if (block.children && Array.isArray(block.children)) {
        traverse(block.children);
      }
    }
  };
  traverse(blocks);
  return text.trim();
};

const getDeterministicColor = (userId) => {
  if (!userId) return '#3b82f6';
  try {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
    }
    const color = Math.abs(hash).toString(16).substring(0, 6);
    return '#' + '000000'.substring(0, 6 - color.length) + color;
  } catch {
    return '#3b82f6';
  }
};

const sendGlobalPresenceToSocket = (targetSocket) => {
  const presenceMap = {};
  for (const noteId of yDocs.keys()) {
    const room = io.sockets.adapter.rooms.get(noteId);
    if (room && room.size > 0) {
      const usersInRoom = [];
      for (const socketId of room) {
        const socketInRoom = io.sockets.sockets.get(socketId);
        if (socketInRoom && socketInRoom.data && socketInRoom.data.userId) {
          usersInRoom.push({
            userId: socketInRoom.data.userId,
            name: socketInRoom.data.userName || 'Anonymous',
            color: getDeterministicColor(socketInRoom.data.userId)
          });
        }
      }
      presenceMap[noteId] = usersInRoom;
    }
  }
  targetSocket.emit('global-presence-update', presenceMap);
};

const broadcastGlobalPresence = () => {
  const presenceMap = {};
  for (const noteId of yDocs.keys()) {
    const room = io.sockets.adapter.rooms.get(noteId);
    if (room && room.size > 0) {
      const usersInRoom = [];
      for (const socketId of room) {
        const socketInRoom = io.sockets.sockets.get(socketId);
        if (socketInRoom && socketInRoom.data && socketInRoom.data.userId) {
          usersInRoom.push({
            userId: socketInRoom.data.userId,
            name: socketInRoom.data.userName || 'Anonymous',
            color: getDeterministicColor(socketInRoom.data.userId)
          });
        }
      }
      presenceMap[noteId] = usersInRoom;
    }
  }
  io.emit('global-presence-update', presenceMap);
};

io.on('connection', (socket) => {
  console.log('User connected (Authenticated):', socket.id, 'User ID:', socket.data.userId);

  // Send current active collaborators status
  sendGlobalPresenceToSocket(socket);

  socket.on('request-global-presence', () => {
    sendGlobalPresenceToSocket(socket);
  });

  socket.on('join-note', async (noteId) => {
    try {
      const note = await Note.findById(noteId);
      if (!note) {
        return socket.emit('error', 'Note not found');
      }

      const isOwner = socket.data.userId && note.owner.toString() === socket.data.userId;
      const isCollaborator = socket.data.userId && note.collaborators.includes(socket.data.userId);
      const isPublic = note.publicAccess && note.publicAccess !== 'none';

      if (!isOwner && !isCollaborator && !isPublic) {
        return socket.emit('error', 'Unauthorized access to this note');
      }

      socket.join(noteId);
      console.log(`User ${socket.data.userId} joined note room: ${noteId}`);
      broadcastGlobalPresence();

      if (!yDocs.has(noteId)) {
        const doc = new Y.Doc();
        // Load existing state from DB if it exists
        if (note.yjsState) {
          Y.applyUpdate(doc, note.yjsState);
        }
        yDocs.set(noteId, doc);
      }
      
      const state = Y.encodeStateAsUpdate(yDocs.get(noteId));
      socket.emit('init-note-state', state);

      // Load recent persistent chat history (sorted ascending by creation)
      const chatHistory = await ChatMessage.find({ note: noteId })
        .sort({ createdAt: 1 })
        .limit(50);
      socket.emit('init-chat-history', chatHistory);
    } catch (err) {
      console.error('Error joining note:', err);
      socket.emit('error', 'Server error during note join');
    }
  });

  socket.on('update-note-content', (data) => {
    const { noteId, update } = data;
    const doc = yDocs.get(noteId);
    if (doc) {
      Y.applyUpdate(doc, new Uint8Array(update));
      socket.to(noteId).emit('receive-update', update);
    }
  });

  socket.on('update-awareness', (data) => {
    const { noteId, awarenessUpdate } = data;
    socket.to(noteId).emit('receive-awareness', awarenessUpdate);
  });

  socket.on('cursor-reaction', (data) => {
    const { noteId, emoji, blockId } = data;
    socket.to(noteId).emit('receive-cursor-reaction', {
      userId: socket.data.userId,
      userName: socket.data.userName,
      emoji,
      blockId
    });
  });

  socket.on('send-chat-message', async (data) => {
    const { noteId, text } = data;
    try {
      const user = await User.findById(socket.data.userId);
      const senderName = user ? user.name : (socket.data.userName || 'Anonymous');

      const newMessage = new ChatMessage({
        note: noteId,
        sender: socket.data.userId,
        senderName,
        text,
      });
      await newMessage.save();

      io.to(noteId).emit('receive-chat-message', newMessage);
    } catch (err) {
      console.error('Chat message error:', err);
      socket.emit('error', 'Error sending chat message');
    }
  });

  socket.on('save-to-db', async (data) => {
    const { noteId, blocks, clientTimestamp } = data;
    const doc = yDocs.get(noteId);
    try {
      const note = await Note.findById(noteId);
      if (!note) {
        console.error(`Note ${noteId} not found in save-to-db`);
        return;
      }

      const clientTime = clientTimestamp ? new Date(clientTimestamp) : new Date();
      const dbTime = note.contentUpdatedAt || note.updatedAt || new Date(0);

      // Only update content and plainText if clientTimestamp is newer than contentUpdatedAt
      if (clientTime > dbTime) {
        const plainText = extractPlainText(blocks);
        const yjsState = doc ? Buffer.from(Y.encodeStateAsUpdate(doc)) : note.yjsState;

        await Note.findByIdAndUpdate(noteId, { 
          content: blocks,
          plainText: plainText,
          contentUpdatedAt: clientTime,
          yjsState: yjsState
        });
        console.log(`Note ${noteId} fully persisted with clientTimestamp: ${clientTime} (JSON + Binary)`);
      } else {
        console.log(`Skipped db save for note ${noteId} because clientTimestamp (${clientTime}) <= contentUpdatedAt (${dbTime})`);
      }
    } catch (err) {
      console.error('Auto-save error:', err);
    }
  });

  socket.on('send-comment', async (data) => {
    const { noteId, content, comment: existingComment } = data;
    try {
      let comment = existingComment;

      // If the comment object wasn't passed directly, save it to the DB (fallback)
      if (!comment && content) {
        const user = await User.findById(socket.data.userId);
        const authorName = user ? user.name : (socket.data.userName || 'Anonymous');

        // Simple mention parsing for robustness (e.g. "@username" or "@email")
        const mentions = [];
        const words = content.split(/\s+/);
        for (const word of words) {
          if (word.startsWith('@')) {
            const searchStr = word.slice(1);
            const mentionedUser = await User.findOne({
              $or: [
                { email: searchStr },
                { name: { $regex: new RegExp(`^${searchStr}$`, 'i') } }
              ]
            });
            if (mentionedUser) {
              mentions.push(mentionedUser._id);
            }
          }
        }

        const newComment = new Comment({
          note: noteId,
          content,
          author: socket.data.userId,
          authorName,
          isReadBy: [socket.data.userId],
          mentions
        });
        comment = await newComment.save();
      }

      if (!comment) return;

      // Populate note info to broadcast
      const populatedComment = await Comment.findById(comment._id).populate('note', 'title owner collaborators');
      const note = populatedComment ? populatedComment.note : await Note.findById(noteId);

      // Broadcast comment to note room
      io.to(noteId).emit('receive-comment', populatedComment || comment);

      // Broadcast global unread notification to all online collaborators/owner (except author)
      if (note) {
        const recipients = [note.owner.toString(), ...note.collaborators.map(c => c.toString())]
          .filter(userId => userId !== socket.data.userId);

        for (let [id, s] of io.of("/").sockets) {
          if (s.data.userId && recipients.includes(s.data.userId.toString())) {
            s.emit('unread-comment-notification', {
              commentId: comment._id,
              noteId: noteId,
              noteTitle: note.title,
              authorName: populatedComment ? populatedComment.authorName : comment.authorName,
              content: comment.content,
              mentions: comment.mentions
            });
          }
        }
      }
    } catch (err) {
      console.error('Error handling send-comment:', err);
      socket.emit('error', 'Error sending comment');
    }
  });

  socket.on('restore-revision-state', async (data) => {
    const { noteId, revisionId, yjsState } = data;
    try {
      let stateBuffer = null;
      if (yjsState) {
        stateBuffer = Buffer.isBuffer(yjsState) ? yjsState : Buffer.from(new Uint8Array(yjsState));
      } else if (revisionId) {
        const revision = await Revision.findById(revisionId);
        if (revision) {
          stateBuffer = revision.yjsState;
        }
      }

      if (!stateBuffer) {
        console.error('No state buffer found to restore');
        return;
      }

      // Overwrite the in-memory Y.Doc with the restored state
      const newDoc = new Y.Doc();
      Y.applyUpdate(newDoc, stateBuffer);
      yDocs.set(noteId, newDoc);

      const fullUpdate = Y.encodeStateAsUpdate(newDoc);

      // Broadcast update to the note room to align all clients
      io.to(noteId).emit('receive-update', Array.from(fullUpdate));
      io.to(noteId).emit('init-note-state', Array.from(fullUpdate));
      io.to(noteId).emit('revision-restored', Array.from(fullUpdate));

      // Persist the restored state to DB
      await Note.findByIdAndUpdate(noteId, {
        yjsState: stateBuffer,
        contentUpdatedAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`Successfully restored revision state for note ${noteId}`);
    } catch (err) {
      console.error('Error restoring revision state:', err);
      socket.emit('error', 'Error restoring revision state');
    }
  });

  socket.on('disconnecting', () => {
    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomName) => {
      if (roomName !== socket.id) {
        process.nextTick(() => {
          cleanUpRoom(roomName);
          broadcastGlobalPresence();
        });
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
