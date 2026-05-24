const express = require('express');
const { body, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const Note = require('../models/Note');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get unread comments for the user
router.get('/unread', auth, async (req, res) => {
  try {
    // Find all notes the user is a collaborator on or owns
    const notes = await Note.find({
      $and: [
        { $or: [{ owner: req.user }, { collaborators: req.user }] },
        { isDeleted: { $ne: true } },
      ],
    });
    
    const noteIds = notes.map(n => n._id);

    // Find comments in these notes that the user hasn't read, and aren't by the user
    const unreadComments = await Comment.find({
      note: { $in: noteIds },
      author: { $ne: req.user },
      isReadBy: { $ne: req.user }
    }).sort({ createdAt: -1 }).populate('note', 'title');

    res.json({ success: true, data: unreadComments });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Post a comment to a note
router.post(
  '/',
  auth,
  [
    body('noteId').notEmpty().withMessage('Note ID is required'),
    body('content').notEmpty().withMessage('Content is required'),
    body('authorName').notEmpty().withMessage('Author name is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    try {
      const note = await Note.findById(req.body.noteId);
      if (!note) {
        return res.status(404).json({ success: false, error: 'Note not found' });
      }

      // Permissions check
      const isOwner = note.owner.toString() === req.user;
      const isCollaborator = note.collaborators.includes(req.user);
      if (!isOwner && !isCollaborator) {
        return res.status(401).json({ success: false, error: 'Not authorized' });
      }

      // Parse @username mentions
      const content = req.body.content || '';
      const mentionRegex = /@([a-zA-Z0-9_\-\.]+)/g;
      let match;
      const mentionedUsernames = [];
      while ((match = mentionRegex.exec(content)) !== null) {
        mentionedUsernames.push(match[1]);
      }

      const mentions = [];
      if (mentionedUsernames.length > 0) {
        const allUsers = await User.find({});
        for (const username of mentionedUsernames) {
          const targetUser = allUsers.find(u => {
            const normalizedName = u.name.replace(/\s+/g, '').toLowerCase();
            const normalizedUsername = username.toLowerCase();
            const emailPrefix = u.email.split('@')[0].toLowerCase();
            return normalizedName === normalizedUsername || emailPrefix === normalizedUsername;
          });
          if (targetUser && !mentions.includes(targetUser._id.toString())) {
            mentions.push(targetUser._id);
          }
        }
      }

      const newComment = new Comment({
        note: req.body.noteId,
        content: req.body.content,
        author: req.user,
        authorName: req.body.authorName,
        isReadBy: [req.user], // author has read it
        mentions,
      });

      const comment = await newComment.save();
      res.status(201).json({ success: true, data: comment });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

// Mark comment as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    if (!comment.isReadBy.includes(req.user)) {
      comment.isReadBy.push(req.user);
      await comment.save();
    }

    res.json({ success: true, data: comment });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Mark all comments for a note as read
router.put('/note/:noteId/read', auth, async (req, res) => {
  try {
    const comments = await Comment.find({ note: req.params.noteId, isReadBy: { $ne: req.user } });
    
    for (let comment of comments) {
      comment.isReadBy.push(req.user);
      await comment.save();
    }

    res.json({ success: true, data: 'All comments marked as read' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
