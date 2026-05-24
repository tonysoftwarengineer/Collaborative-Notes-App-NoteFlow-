const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Note = require('../models/Note');
const ChatMessage = require('../models/ChatMessage');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Register
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { name, email, password } = req.body;

    try {
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ success: false, error: 'User already exists' });
      }

      user = new User({ name, email, password });
      await user.save();

      const payload = { userId: user.id };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        success: true,
        data: {
          token,
          user: { id: user.id, name: user.name, email: user.email },
        },
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, error: 'Server error: ' + err.message });
    }
  }
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password').exists().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ success: false, error: 'Invalid credentials' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Invalid credentials' });
      }

      const payload = { userId: user.id };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        success: true,
        data: {
          token,
          user: { id: user.id, name: user.name, email: user.email },
        },
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, error: 'Server error: ' + err.message });
    }
  }
);

// Guest login
router.post('/guest', (req, res) => {
  const adjectives = ['Creative', 'Swift', 'Bright', 'Clever', 'Happy', 'Silent', 'Wise', 'Playful', 'Brave', 'Kind'];
  const animals = ['Koala', 'Panda', 'Fox', 'Otter', 'Owl', 'Dolphin', 'Penguin', 'Tiger', 'Falcon', 'Rabbit'];
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
  const guestName = `${randomAdjective} ${randomAnimal}`;
  
  // Generate random guest ID
  const guestId = `guest_${Math.random().toString(36).substring(2, 11)}`;
  
  const payload = { userId: guestId, name: guestName, isGuest: true };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }); // ephemeral guest token valid for 1 day
  
  res.json({
    success: true,
    data: {
      token,
      user: { id: guestId, name: guestName, isGuest: true },
    },
  });
});

// Delete Account
router.delete('/delete-account', auth, async (req, res) => {
  if (req.isGuest || (req.user && req.user.startsWith('guest_'))) {
    return res.status(403).json({ success: false, error: 'Guests cannot delete accounts' });
  }
  try {
    // 1. Find all notes owned by the user
    const userNotes = await Note.find({ owner: req.user });
    const noteIds = userNotes.map((n) => n._id);

    // 2. Delete all owned notes
    await Note.deleteMany({ owner: req.user });

    // 3. Delete chat messages for those notes
    if (noteIds.length > 0) {
      await ChatMessage.deleteMany({ note: { $in: noteIds } });
    }

    // 4. Delete chat messages sent by the user in other notes
    await ChatMessage.deleteMany({ sender: req.user });

    // 5. Remove user from collaborator list in notes owned by others
    await Note.updateMany(
      { collaborators: req.user },
      { $pull: { collaborators: req.user } }
    );

    // 6. Delete user account
    await User.findByIdAndDelete(req.user);

    res.json({
      success: true,
      data: { message: 'Account deleted successfully' },
    });
  } catch (err) {
    console.error('Delete account error:', err.message);
    res.status(500).json({ success: false, error: 'Server error: ' + err.message });
  }
});

module.exports = router;
