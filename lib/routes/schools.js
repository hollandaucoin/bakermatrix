import express from 'express';
import storage from '../storage/index.js';

const router = express.Router();

/**
 * Get all schools
 */
router.get('/', async (req, res) => {
  try {
    const schools = await storage.model('School').find();
    if (!schools || schools.length === 0) {
      return res.status(404).json({ error: 'No schools found' });
    }
    schools.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(schools);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new school
 */
router.post('/', async (req, res) => {
  try {
    const school = await storage.model('School').create(req.body);
    return res.status(200).json(school);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/updateAll', async (req, res) => {
  try {
    const { updateArray } = req.body;
    if (!Array.isArray(updateArray) || updateArray.length === 0) {
      return res.status(400).json({ error: 'Invalid updates array' });
    }

    const bulkOps = updateArray.map(({ schoolId, delegateCount }) => ({
      updateOne: { filter: { _id: schoolId }, update: { $set: { delegateCount } }},
    }));

    const result = await storage.model('School').bulkWrite(bulkOps);
    return res.status(200).json({ message: 'Delegate counts updated', result });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a school by id
 */
router.put('/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (!schoolId) { return res.status(400).json({ error: 'schoolId required' }); }

    const school = await storage.model('School').findById(schoolId);
    if (!school) { return res.status(404).json({ error: 'School not found' }); }

    const updatedSchool = await school.update(req.body);
    return res.status(200).json(updatedSchool);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a school by id
 */
router.delete('/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (!schoolId) { return res.status(400).json({ error: 'schoolId required' }); }

    const deletedSchool = await storage.model('School').findByIdAndDelete(schoolId);
    if (!deletedSchool) { return res.status(404).json({ error: 'School not found' }); }

    return res.status(200).json(deletedSchool);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/schools' };
