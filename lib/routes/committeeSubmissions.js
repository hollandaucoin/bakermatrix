import express from 'express';
import storage from '../storage/index.js';
import { isAuthenticated, isAuthenticatedAdmin } from './_middleware.js';

const router = express.Router();

/**
 * Get committee submission - requested by senior counselor to view their own committee submission
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Find the committee submission for the authenticated senior counselor
    const committeeSubmission = await storage.model('CommitteeSubmission').findOne({ _seniorCounselor: req.session.userId }).populate('assignments.committee').populate('_seniorCounselor');
    if (!committeeSubmission) {
      return res.status(404).json({ error: 'Committee submission not found' });
    }
    return res.status(200).json(committeeSubmission);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new committee submission
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { assignments } = req.body;
    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'Assignments array is required and must not be empty' });
    }
    for (const assignment of assignments) {
      if (!assignment.name || !assignment.committee) {
        return res.status(400).json({ error: 'Each assignment must have a name and committee' });
      }
    }

    const existing = await storage.model('CommitteeSubmission').findOne({ _seniorCounselor: req.session.userId });
    if (existing) {
      const updatedCommitteeSubmission = await existing.update({ assignments });
      return res.status(200).json(updatedCommitteeSubmission);
    }

    const committeeSubmission = await storage.model('CommitteeSubmission').create({ _seniorCounselor: req.session.userId, assignments });
    return res.status(200).json(committeeSubmission);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a committee submission by id
 */
router.put('/:submissionId', isAuthenticated, async (req, res) => {
  try {
    const { submissionId } = req.params;
    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId required' });
    }
    const committeeSubmission = await storage.model('CommitteeSubmission').findById(submissionId);
    if (!committeeSubmission) {
      return res.status(404).json({ error: 'Committee submission not found' });
    }
    // Only allow the owner to update
    if (committeeSubmission._seniorCounselor.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'You can only update your own committee submissions' });
    }
    const updatedCommitteeSubmission = await committeeSubmission.update(req.body);
    return res.status(200).json(updatedCommitteeSubmission);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a committee submission by id
 */
router.delete('/:submissionId', isAuthenticated, async (req, res) => {
  try {
    const { submissionId } = req.params;
    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId required' });
    }

    const committeeSubmission = await storage.model('CommitteeSubmission').findById(submissionId);
    if (!committeeSubmission) {
      return res.status(404).json({ error: 'Committee submission not found' });
    }

    // Only allow the owner to delete
    if (committeeSubmission._seniorCounselor.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'You can only delete your own committee submissions' });
    }

    await committeeSubmission.deleteOne();
    return res.status(200).json({ success: true, message: 'Committee submission deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ------------------------- ADMIN ROUTES -------------------------

/**
 * Get all committee submissions
 */
router.get('/admin/all', isAuthenticatedAdmin, async (req, res) => {
  try {
    const committeeSubmissions = await storage.model('CommitteeSubmission')
      .find()
      .populate('assignments.committee')
      .populate('_seniorCounselor')
      .sort({ updatedAt: -1 });

    return res.status(200).json(committeeSubmissions);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a specific committee submission by ID (admin only)
 */
router.get('/admin/:submissionId', isAuthenticatedAdmin, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const committeeSubmission = await storage.model('CommitteeSubmission')
      .findById(submissionId)
      .populate('assignments.committee')
      .populate('_seniorCounselor');

    if (!committeeSubmission) {
      return res.status(404).json({ error: 'Committee submission not found' });
    }

    return res.status(200).json(committeeSubmission);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { path: '/committee-submissions', router };
