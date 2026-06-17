import express from 'express';
import storage from '../storage/index.js';

const router = express.Router();

/**
 * Get all dorms
 */
router.get('/', async (req, res) => {
  try {
    const dorms = await storage.model('Dorm').find();
    if (!dorms || dorms.length === 0) {
      return res.status(404).json({ error: 'No dorms found' });
    }
    dorms.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(dorms);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Updates all dorms
 */
router.put('/updateAll', async (req, res) => {
  try {
    const { updateArray } = req.body;
    if (!Array.isArray(updateArray) || updateArray.length === 0) {
      return res.status(400).json({ error: 'Invalid updates array' });
    }

    const bulkOps = updateArray.map(({ dormId, type }) => ({
      updateOne: { filter: { _id: dormId }, update: { $set: { type } }},
    }));

    const result = await storage.model('Dorm').bulkWrite(bulkOps);
    return res.status(200).json({ message: 'Dorm types updated', result });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a dorm by id
 */
router.put('/:dormId', async (req, res) => {
  try {
    const { dormId } = req.params;
    if (!dormId) { return res.status(400).json({ error: 'dormId required' }); }

    const dorm = await storage.model('Dorm').findById(dormId);
    if (!dorm) { return res.status(404).json({ error: 'Dorm not found' }); }

    const updatedDorm = await dorm.update(req.body);
    return res.status(200).json(updatedDorm);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/dorms' };
