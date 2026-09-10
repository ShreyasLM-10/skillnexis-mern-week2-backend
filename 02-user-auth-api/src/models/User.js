const { Schema, model } = require('mongoose');
const bcrypt = require('bcrypt');
const config = require('../config/env');

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true, // enforced by a unique index in MongoDB
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // never returned by queries unless explicitly requested
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      // Extra safety: strip the hash even if it was selected.
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  },
);

// Hash the password whenever it is created or changed.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, config.bcryptSaltRounds);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = model('User', userSchema);
