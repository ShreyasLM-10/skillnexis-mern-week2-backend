const { Schema, model } = require('mongoose');

const LIMITS = Object.freeze({ title: 200, content: 20_000, tags: 10, tagLength: 30 });

const noteSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true, // a note can never be moved to another user
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: LIMITS.title,
    },
    content: { type: String, trim: true, maxlength: LIMITS.content, default: '' },
    tags: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: LIMITS.tagLength }],
      default: [],
      validate: {
        validator: (tags) => tags.length <= LIMITS.tags,
        message: `A note can have at most ${LIMITS.tags} tags`,
      },
    },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

// Every query is scoped by owner, so lead the index with it.
noteSchema.index({ owner: 1, pinned: -1, updatedAt: -1 });
noteSchema.index({ owner: 1, tags: 1 });

module.exports = model('Note', noteSchema);
module.exports.LIMITS = LIMITS;
