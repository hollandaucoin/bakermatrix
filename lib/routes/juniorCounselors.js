import express from 'express';
import storage from '../storage/index.js';

const router = express.Router();

/**
 * Get all junior counselors
 */
router.get('/', async (req, res) => {
  try {
    const juniorCounselors = await storage.model('JuniorCounselor').find().populate('_associatedSchool _previousSchools _dorm');
    if (!juniorCounselors || juniorCounselors.length === 0) {
      return res.status(404).json({ error: 'No junior counselors found' });
    }
    juniorCounselors.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(juniorCounselors);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new juniorCounselor
 */
router.post('/', async (req, res) => {
  try {
    const response = await storage.model('JuniorCounselor').create(req.body);
    const juniorCounselor = await storage.model('JuniorCounselor').findById(response._id).populate('_associatedSchool _previousSchools');
    return res.status(200).json(juniorCounselor);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a junior counselor by id
 */
router.put('/:juniorCounselorId', async (req, res) => {
  try {
    const { juniorCounselorId } = req.params;
    if (!juniorCounselorId) { return res.status(400).json({ error: 'juniorCounselorId required' }); }

    const juniorCounselor = await storage.model('JuniorCounselor').findById(juniorCounselorId);
    if (!juniorCounselor) { return res.status(400).json({ error: 'juniorCounselor not found' }); }

    const response = await juniorCounselor.update(req.body);
    const updatedJuniorCounselor = await storage.model('JuniorCounselor').findById(response._id).populate('_associatedSchool _previousSchools _dorm');
    return res.status(200).json(updatedJuniorCounselor);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a junior counselor by id
 */
router.delete('/:juniorCounselorId', async (req, res) => {
  try {
    const { juniorCounselorId } = req.params;
    if (!juniorCounselorId) { return res.status(400).json({ error: 'juniorCounselorId required' }); }

    const deletedJuniorCounselor = await storage.model('JuniorCounselor').findByIdAndDelete(juniorCounselorId);
    if (!deletedJuniorCounselor) { return res.status(400).json({ error: 'juniorCounselor not found' }); }

    return res.status(200).json(deletedJuniorCounselor);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/juniorcounselors' };
