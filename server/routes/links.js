const express = require('express');
const { body, validationResult } = require('express-validator');
const PinnedLink = require('../models/PinnedLink');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all pinned links for the user
router.get('/', auth, async (req, res) => {
  try {
    const links = await PinnedLink.find({ user: req.user }).sort({ createdAt: -1 });
    res.json({ success: true, data: links });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create a new pinned link
router.post(
  '/',
  auth,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('url').isURL().withMessage('Valid URL is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    try {
      const newLink = new PinnedLink({
        title: req.body.title,
        url: req.body.url,
        user: req.user,
      });

      const link = await newLink.save();
      res.status(201).json({ success: true, data: link });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

// Delete a pinned link
router.delete('/:id', auth, async (req, res) => {
  try {
    const link = await PinnedLink.findById(req.params.id);
    if (!link) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }

    if (link.user.toString() !== req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    await PinnedLink.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: 'Link removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
