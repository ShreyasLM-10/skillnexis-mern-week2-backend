const mongoose = require('mongoose');
const { matchedData } = require('express-validator');
const Note = require('../models/Note');
const HttpError = require('../utils/HttpError');

// Values used when a PUT request omits an optional field (full replacement).
const NOTE_DEFAULTS = Object.freeze({ content: '', tags: [], pinned: false });

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Validated body fields only, with duplicate tags removed. */
function noteData(req) {
  const data = matchedData(req, { locations: ['body'] });
  if (Array.isArray(data.tags)) data.tags = [...new Set(data.tags)];
  return data;
}

/**
 * Every query includes `owner: req.user._id`, so a user can only ever see or
 * change their own notes. Someone else's note id simply returns 404
 * (we don't even reveal that it exists) - this prevents IDOR attacks.
 */
const ownFilter = (req, extra = {}) => ({ ...extra, owner: req.user._id });

const parseSort = (sort = '-updatedAt') => {
  const direction = sort.startsWith('-') ? -1 : 1;
  const field = sort.replace(/^-/, '');
  return { pinned: -1, [field]: direction, _id: direction }; // pinned notes first
};

// GET /api/notes?page=&limit=&sort=&pinned=&tag=&search=
async function listNotes(req, res) {
  const q = matchedData(req, { locations: ['query'] });
  const page = Number(q.page) || 1;
  const limit = Number(q.limit) || 20;

  const filter = ownFilter(req);
  if (q.pinned !== undefined) filter.pinned = q.pinned === 'true';
  if (q.tag !== undefined) filter.tags = q.tag;
  if (q.search !== undefined) {
    // User input is escaped, so it is matched literally (no regex injection / ReDoS).
    // mongoose.trusted() marks this operator as ours so sanitizeFilter keeps it.
    const pattern = () => mongoose.trusted({ $regex: escapeRegex(q.search), $options: 'i' });
    filter.$or = [{ title: pattern() }, { content: pattern() }];
  }

  const [notes, total] = await Promise.all([
    Note.find(filter).sort(parseSort(q.sort)).skip((page - 1) * limit).limit(limit).lean(),
    Note.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: notes,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// GET /api/notes/:id
async function getNote(req, res) {
  const note = await Note.findOne(ownFilter(req, { _id: req.params.id })).lean();
  if (!note) throw new HttpError(404, 'Note not found');
  res.json({ success: true, data: note });
}

// POST /api/notes
async function createNote(req, res) {
  const note = await Note.create({ ...noteData(req), owner: req.user._id });
  res.status(201).location(`/api/notes/${note.id}`).json({ success: true, data: note });
}

// PATCH /api/notes/:id  - update only the fields that were sent
async function updateNote(req, res) {
  const updates = noteData(req);
  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'Provide at least one field to update: title, content, tags, pinned');
  }

  const note = await Note.findOneAndUpdate(
    ownFilter(req, { _id: req.params.id }),
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!note) throw new HttpError(404, 'Note not found');
  res.json({ success: true, data: note });
}

// PUT /api/notes/:id  - replace all editable fields (omitted ones reset to defaults)
async function replaceNote(req, res) {
  const note = await Note.findOneAndUpdate(
    ownFilter(req, { _id: req.params.id }),
    { $set: { ...NOTE_DEFAULTS, ...noteData(req) } },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!note) throw new HttpError(404, 'Note not found');
  res.json({ success: true, data: note });
}

// DELETE /api/notes/:id
async function deleteNote(req, res) {
  const note = await Note.findOneAndDelete(ownFilter(req, { _id: req.params.id })).lean();
  if (!note) throw new HttpError(404, 'Note not found');
  res.status(204).end();
}

module.exports = { listNotes, getNote, createNote, updateNote, replaceNote, deleteNote };
