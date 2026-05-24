const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    default: 'Untitled Note',
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  yjsState: {
    type: Buffer, // Store Yjs binary state
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  collaborators: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  starredBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  tags: [String],
  folder: {
    type: String,
    default: 'General',
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  publicAccess: {
    type: String,
    enum: ['none', 'read', 'edit'],
    default: 'none',
  },
  plainText: {
    type: String,
    default: '',
  },
  contentUpdatedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create text index for search
noteSchema.index({ title: 'text', plainText: 'text' });

// Update updatedAt and contentUpdatedAt on save
noteSchema.pre('save', function () {
  this.updatedAt = Date.now();
  if (this.isModified('content') || this.isModified('plainText')) {
    this.contentUpdatedAt = Date.now();
  }
});

module.exports = mongoose.model('Note', noteSchema);
