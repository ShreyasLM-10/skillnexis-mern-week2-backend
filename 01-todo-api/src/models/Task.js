const { Schema, model } = require('mongoose');

const PRIORITIES = Object.freeze(['low', 'medium', 'high']);

const taskSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title must be at most 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description must be at most 2000 characters'],
      default: '',
    },
    completed: { type: Boolean, default: false },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

taskSchema.index({ completed: 1, createdAt: -1 });

module.exports = model('Task', taskSchema);
module.exports.PRIORITIES = PRIORITIES;
