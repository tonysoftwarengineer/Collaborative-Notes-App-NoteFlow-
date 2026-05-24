const express = require('express');
const { body, validationResult } = require('express-validator');
const Note = require('../models/Note');
const Revision = require('../models/Revision');
const auth = require('../middleware/auth');
const authOptional = require('../middleware/authOptional');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });


const router = express.Router();

// Get all notes for the authenticated user (owned or shared, excluding soft-deleted notes)
router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.find({
      $and: [
        { $or: [{ owner: req.user }, { collaborators: req.user }] },
        { isDeleted: { $ne: true } },
      ],
    }).sort({ updatedAt: -1 });
    res.json({ success: true, data: notes });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Get all starred notes for the authenticated user
router.get('/starred', auth, async (req, res) => {
  try {
    const notes = await Note.find({
      starredBy: req.user,
      isDeleted: { $ne: true },
    }).sort({ updatedAt: -1 });
    res.json({ success: true, data: notes });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Get unique collaborators the user has worked with
router.get('/collaborators', auth, async (req, res) => {
  try {
    const notes = await Note.find({
      $and: [
        { $or: [{ owner: req.user }, { collaborators: req.user }] },
        { isDeleted: { $ne: true } },
      ],
    }).populate('owner', 'name email color').populate('collaborators', 'name email color');

    const usersMap = new Map();
    notes.forEach((note) => {
      if (note.owner._id.toString() !== req.user) {
        usersMap.set(note.owner._id.toString(), note.owner);
      }
      note.collaborators.forEach((collab) => {
        if (collab._id.toString() !== req.user) {
          usersMap.set(collab._id.toString(), collab);
        }
      });
    });

    res.json({ success: true, data: Array.from(usersMap.values()) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Get all soft-deleted (trash) notes for the authenticated user
router.get('/trash', auth, async (req, res) => {
  try {
    const notes = await Note.find({
      owner: req.user,
      isDeleted: true,
    }).sort({ updatedAt: -1 });
    res.json({ success: true, data: notes });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create a new note
router.post(
  '/',
  auth,
  [
    body('title').optional().isString().withMessage('Title must be a string'),
    body('folder').optional().isString().withMessage('Folder must be a string'),
    body('parentId').optional().custom((value) => {
      if (value && typeof value !== 'string') {
        throw new Error('Parent ID must be a string');
      }
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    if (req.isGuest || (req.user && req.user.startsWith('guest_'))) {
      return res.status(403).json({ success: false, error: 'Guests cannot create notes' });
    }

    const { title, folder, parentId } = req.body;
    try {
      if (parentId) {
        const parentNote = await Note.findById(parentId);
        if (!parentNote) {
          return res.status(404).json({ success: false, error: 'Parent note not found' });
        }
        // Check permissions on the parent note
        if (parentNote.owner.toString() !== req.user && !parentNote.collaborators.includes(req.user)) {
          return res.status(401).json({ success: false, error: 'Not authorized for parent note' });
        }
      }

      const newNote = new Note({
        title,
        folder,
        parentId: parentId || null,
        owner: req.user,
      });
      const note = await newNote.save();
      res.status(201).json({ success: true, data: note });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

// Get note by ID
router.get('/:id', authOptional, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // A note is not accessible if it is soft-deleted, unless owner checks trash
    if (note.isDeleted) {
      const isOwner = req.user && note.owner.toString() === req.user;
      if (!isOwner) {
        return res.status(404).json({ success: false, error: 'Note not found' });
      }
    }

    // Check if user has access
    const isOwner = req.user && note.owner.toString() === req.user;
    const isCollaborator = req.user && note.collaborators.includes(req.user);
    const isPublic = note.publicAccess && note.publicAccess !== 'none';

    if (!isOwner && !isCollaborator && !isPublic) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    res.json({ success: true, data: note });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update note
router.put(
  '/:id',
  authOptional,
  [
    body('title').optional().isString().withMessage('Title must be a string'),
    body('content').optional().isArray().withMessage('Content must be an array of blocks'),
    body('plainText').optional().isString().withMessage('Plain text must be a string'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string'),
    body('folder').optional().isString().withMessage('Folder must be a string'),
    body('publicAccess').optional().isIn(['none', 'read', 'edit']).withMessage('Invalid publicAccess value'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { title, content, plainText, tags, folder, publicAccess } = req.body;
    try {
      let note = await Note.findById(req.params.id);
      if (!note) {
        return res.status(404).json({ success: false, error: 'Note not found' });
      }

      const isOwner = req.user && note.owner.toString() === req.user;
      const isCollaborator = req.user && note.collaborators.includes(req.user);
      const isPublicEdit = note.publicAccess === 'edit';

      // Check if user has edit access
      if (!isOwner && !isCollaborator && !isPublicEdit) {
        return res.status(401).json({ success: false, error: 'Not authorized' });
      }

      // Check permissions: only owner can change publicAccess
      if (publicAccess !== undefined && !isOwner) {
        return res.status(403).json({ success: false, error: 'Only the note owner can change access settings' });
      }

      // Update fields
      if (title) note.title = title;
      if (content !== undefined) note.content = content;
      if (plainText !== undefined) note.plainText = plainText;
      if (tags) note.tags = tags;
      if (folder) note.folder = folder;
      if (publicAccess !== undefined) note.publicAccess = publicAccess;

      note = await note.save();
      res.json({ success: true, data: note });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

// Toggle star on a note
router.put('/:id/star', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // Check if user has access
    const isOwner = note.owner.toString() === req.user;
    const isCollaborator = note.collaborators.includes(req.user);
    if (!isOwner && !isCollaborator) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const index = note.starredBy.indexOf(req.user);
    if (index === -1) {
      note.starredBy.push(req.user);
    } else {
      note.starredBy.splice(index, 1);
    }

    await note.save();
    res.json({ success: true, data: note });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete note (Soft delete)
router.delete('/:id', auth, async (req, res) => {
  if (req.isGuest || (req.user && req.user.startsWith('guest_'))) {
    return res.status(403).json({ success: false, error: 'Guests cannot delete notes' });
  }
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // Only owner can delete
    if (note.owner.toString() !== req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    note.isDeleted = true;
    note.deletedBy = req.user;
    note.deletedAt = Date.now();
    await note.save();

    // Soft delete all recursive children
    const softDeleteChildren = async (parentId) => {
      const children = await Note.find({ parentId });
      for (const child of children) {
        if (!child.isDeleted) {
          child.isDeleted = true;
          child.deletedBy = req.user;
          child.deletedAt = Date.now();
          await child.save();
          await softDeleteChildren(child._id);
        }
      }
    };
    await softDeleteChildren(note._id);

    res.json({ success: true, data: 'Note moved to trash' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Restore soft-deleted note
router.put('/:id/restore', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // Check permissions
    if (note.owner.toString() !== req.user && !note.collaborators.includes(req.user)) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    note.isDeleted = false;
    note.deletedBy = null;
    note.deletedAt = null;

    // Check if the parent note is still deleted. If so, reset parentId to null to avoid orphan status.
    if (note.parentId) {
      const parentNote = await Note.findById(note.parentId);
      if (!parentNote || parentNote.isDeleted) {
        note.parentId = null;
      }
    }

    await note.save();
    res.json({ success: true, data: note });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Permanently delete note
router.delete('/:id/permanent', auth, async (req, res) => {
  if (req.isGuest || (req.user && req.user.startsWith('guest_'))) {
    return res.status(403).json({ success: false, error: 'Guests cannot delete notes' });
  }
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // Only owner can delete permanently
    if (note.owner.toString() !== req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    // Delete this note and all its recursive children permanently
    const deletePermanentlyRecursive = async (parentId) => {
      const children = await Note.find({ parentId });
      for (const child of children) {
        await deletePermanentlyRecursive(child._id);
      }
      await Note.findByIdAndDelete(parentId);
    };

    await deletePermanentlyRecursive(note._id);

    res.json({ success: true, data: 'Note permanently removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Share note with another user by email
router.post(
  '/:id/share',
  auth,
  [
    body('email').isEmail().withMessage('Please include a valid email to share with'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email } = req.body;
    try {
      const note = await Note.findById(req.params.id);
      if (!note) {
        return res.status(404).json({ success: false, error: 'Note not found' });
      }

      // Only owner can share
      if (note.owner.toString() !== req.user) {
        return res.status(401).json({ success: false, error: 'Not authorized to share this note' });
      }

      const User = require('../models/User');
      const userToShare = await User.findOne({ email });
      if (!userToShare) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (note.collaborators.includes(userToShare._id)) {
        return res.status(400).json({ success: false, error: 'User is already a collaborator' });
      }

      note.collaborators.push(userToShare._id);
      await note.save();

      res.json({ success: true, data: 'Note shared successfully' });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

// Upload a file locally
router.post('/upload', authOptional, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      data: { url: fileUrl },
      url: fileUrl // support direct url field format
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Upload failed: ' + err.message });
  }
});

// Get revisions for a note
router.get('/:id/revisions', authOptional, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // Check if user has access
    const isOwner = req.user && note.owner.toString() === req.user;
    const isCollaborator = req.user && note.collaborators.includes(req.user);
    const isPublic = note.publicAccess && note.publicAccess !== 'none';

    if (!isOwner && !isCollaborator && !isPublic) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const revisions = await Revision.find({ note: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: revisions });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create a new revision snapshot for a note
router.post(
  '/:id/revisions',
  auth,
  [
    body('title').optional().isString().withMessage('Revision title must be a string'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    try {
      const note = await Note.findById(req.params.id);
      if (!note) {
        return res.status(404).json({ success: false, error: 'Note not found' });
      }

      // Check if user has edit access
      const isOwner = note.owner.toString() === req.user;
      const isCollaborator = note.collaborators.includes(req.user);
      const isPublicEdit = note.publicAccess === 'edit';

      if (!isOwner && !isCollaborator && !isPublicEdit) {
        return res.status(401).json({ success: false, error: 'Not authorized' });
      }

      const User = require('../models/User');
      const getUserName = async (userId, tokenName) => {
        if (userId && userId.startsWith('guest_')) {
          return tokenName || 'Guest User';
        }
        const user = await User.findById(userId);
        return user ? user.name : 'Unknown User';
      };

      const authorName = await getUserName(req.user, req.userName);

      // Use optional overrides if provided in body, else snap from current note
      const content = req.body.content !== undefined ? req.body.content : note.content;
      const plainText = req.body.plainText !== undefined ? req.body.plainText : note.plainText;
      const yjsState = req.body.yjsState !== undefined ? req.body.yjsState : note.yjsState;

      const newRevision = new Revision({
        note: note._id,
        title: req.body.title || 'Manual Snapshot',
        content,
        plainText,
        yjsState,
        createdBy: req.user,
        createdByName: authorName,
      });

      await newRevision.save();
      res.status(201).json({ success: true, data: newRevision });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

// Restore a revision to the note
router.post('/:id/revisions/:revisionId/restore', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // Check if user has edit access
    const isOwner = note.owner.toString() === req.user;
    const isCollaborator = note.collaborators.includes(req.user);
    const isPublicEdit = note.publicAccess === 'edit';

    if (!isOwner && !isCollaborator && !isPublicEdit) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const revision = await Revision.findById(req.params.revisionId);
    if (!revision) {
      return res.status(404).json({ success: false, error: 'Revision not found' });
    }

    if (revision.note.toString() !== note._id.toString()) {
      return res.status(400).json({ success: false, error: 'Revision does not belong to this note' });
    }

    // Restore note's content, plainText and yjsState
    note.content = revision.content;
    note.plainText = revision.plainText || '';
    note.yjsState = revision.yjsState;
    await note.save();

    res.json({ success: true, data: note });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
