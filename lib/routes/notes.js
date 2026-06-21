import express from 'express';
import storage from '../storage/index.js';
import { isAuthenticated } from './_middleware.js';

const router = express.Router();

const emptyNotesPayload = (req) => ({
  ...(req.session.userType === 'seniorCounselor'
    ? { _seniorCounselor: req.session.userId }
    : { _user: req.session.userId }),
  day0: '',
  day1: '',
  day2: '',
  day3: '',
  day4: '',
  day5: '',
});

const notesOwnerPayload = (req) => (
  req.session.userType === 'seniorCounselor'
    ? { _seniorCounselor: req.session.userId }
    : { _user: req.session.userId }
);

/**
 * Get notes for the authenticated user
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const notes = await storage.model('Notes').findOne(notesOwnerPayload(req));

    if (!notes) {
      return res.status(200).json(emptyNotesPayload(req));
    }

    return res.status(200).json(notes);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create or update notes for the authenticated user
 */
router.put('/', isAuthenticated, async (req, res) => {
  try {
    const { day0, day1, day2, day3, day4, day5 } = req.body;

    const notes = await storage.model('Notes').createOrUpdate({
      ...notesOwnerPayload(req),
      day0,
      day1,
      day2,
      day3,
      day4,
      day5,
    });

    return res.status(200).json(notes);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/notes' };
