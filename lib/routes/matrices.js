import express from 'express';
import storage from '../storage/index.js';
import matrixUtil from '../util/matrix.js';
import { validateMatrixCouncils } from '../util/matrixValidation.js';

const router = express.Router();

const loadMatrixValidationContext = async () => {
  const seniorCounselors = await storage.model('SeniorCounselor').find()
    .populate('_jcPairing _jcPairing2 _associatedSchool _previousSchools');
  const schools = await storage.model('School').find();
  return { seniorCounselors, schools };
};

/**
 * Get all saved matrices
 */
router.get('/', async (req, res) => {
  try {
    const matrices = await storage.model('Matrix').find().sort({ _id: -1});
    if (!matrices || matrices.length === 0) {
      return res.status(404).json({ error: 'No saved matrices found' });
    }
    matrices.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(matrices);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recent', async (req, res) => {
  try {
    const matrix = await storage.model('Matrix').findOne({ saved: true }).sort({ _id: -1});
    if (!matrix) {
      return res.status(404).json({ error: 'No recent matrix found' });
    }
    return res.status(200).json(matrix);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/selected', async (req, res) => {
  try {
    const matrix = await storage.model('Matrix').findOne({ selected: true });
    if (!matrix) {
      return res.status(404).json({ error: 'No selected matrix found' });
    }
    return res.status(200).json(matrix);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
/**
 * Creates a new matrix
 */
router.get('/generate', async (req, res) => {
  try {
    const contents = await matrixUtil.generateContents();
    const matrix = await storage.model('Matrix').create(contents);

    return res.status(200).json(matrix);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/validate-councils', async (req, res) => {
  try {
    const { councils } = req.body;
    if (!Array.isArray(councils)) {
      return res.status(400).json({ error: 'councils must be an array' });
    }
    const { seniorCounselors, schools } = await loadMatrixValidationContext();
    const validated = validateMatrixCouncils(councils, seniorCounselors, schools);
    return res.status(200).json({ councils: validated });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to validate councils' });
  }
});

/**
 * Updates a matrix
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const matrix = await storage.model('Matrix').update(id, req.body);

    return res.status(200).json(matrix);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/matrices' };
