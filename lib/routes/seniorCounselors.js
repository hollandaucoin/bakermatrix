import express from 'express';
import storage from '../storage/index.js';

const router = express.Router();

/**
 * Get all senior counselors
 */
router.get('/', async (req, res) => {
  try {
    const seniorCounselors = await storage.model('SeniorCounselor').find().populate('_jcPairing _jcPairing2 _associatedSchool _previousSchools _previousPostingPartner');
    if (!seniorCounselors || seniorCounselors.length === 0) {
      return res.status(404).json({ error: 'No senior counselors found' });
    }
    seniorCounselors.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(seniorCounselors);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new senior counselor
 */
router.post('/', async (req, res) => {
  try {
    const response = await storage.model('SeniorCounselor').create(req.body);
    const seniorCounselor = await storage.model('SeniorCounselor').findById(response._id).populate('_jcPairing _jcPairing2 _associatedSchool _previousSchools _previousPostingPartner');
    return res.status(200).json(seniorCounselor);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update JC pairings for a senior counselor
 */
router.put('/jcs', async (req, res) => {
  try {
    const { updates } = req.body;
    if (!updates) { return res.status(400).json({ error: 'updates required' }); }

    const updatedSeniorCounselors = await storage.model('SeniorCounselor').updateJcs({ updates });
    return res.status(200).json(updatedSeniorCounselors);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Remove federal way assignment from a senior counselor
 */
router.delete('/federalway/:seniorCounselorId', async (req, res) => {
  try {
    const { seniorCounselorId } = req.params;
    if (!seniorCounselorId) { return res.status(400).json({ error: 'seniorCounselorId required' }); }

    const seniorCounselor = await storage.model('SeniorCounselor').findById(seniorCounselorId);
    if (!seniorCounselor) { return res.status(400).json({ error: 'seniorCounselor not found' }); }

    const updatedSeniorCounselor = await seniorCounselor.unassignFederalWay();
    return res.status(200).json(updatedSeniorCounselor);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Assign federal way to a senior counselor
 */
router.put('/federalway/:seniorCounselorId', async (req, res) => {
  try {
    const { seniorCounselorId } = req.params;
    if (!seniorCounselorId) { return res.status(400).json({ error: 'seniorCounselorId required' }); }

    const seniorCounselor = await storage.model('SeniorCounselor').findById(seniorCounselorId);
    if (!seniorCounselor) { return res.status(400).json({ error: 'seniorCounselor not found' }); }

    const updatedSeniorCounselor = await seniorCounselor.assignFederalWay();
    return res.status(200).json(updatedSeniorCounselor);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a senior counselor by id
 */
router.put('/:seniorCounselorId', async (req, res) => {
  try {
    const { seniorCounselorId } = req.params;
    if (!seniorCounselorId) { return res.status(400).json({ error: 'seniorCounselorId required' }); }

    const seniorCounselor = await storage.model('SeniorCounselor').findById(seniorCounselorId);
    if (!seniorCounselor) { return res.status(400).json({ error: 'seniorCounselor not found' }); }

    const response = await seniorCounselor.update(req.body);
    const updatedSeniorCounselor = await storage.model('SeniorCounselor').findById(response._id).populate('_jcPairing _jcPairing2 _associatedSchool _previousSchools _previousPostingPartner');
    return res.status(200).json(updatedSeniorCounselor);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a senior counselor by id
 */
router.delete('/:seniorCounselorId', async (req, res) => {
  try {
    const { seniorCounselorId } = req.params;
    if (!seniorCounselorId) { return res.status(400).json({ error: 'seniorCounselorId required' }); }

    const deletedSeniorCounselor = await storage.model('SeniorCounselor').findByIdAndDelete(seniorCounselorId);
    if (!deletedSeniorCounselor) { return res.status(400).json({ error: 'seniorCounselor not found' }); }

    return res.status(200).json(deletedSeniorCounselor);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/seniorcounselors' };
