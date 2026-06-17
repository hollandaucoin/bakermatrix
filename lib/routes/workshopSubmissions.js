import express from 'express';
import storage from '../storage/index.js';
import { isAuthenticated, isAuthenticatedAdmin } from './_middleware.js';

const router = express.Router();

/**
 * Get workshop submission - requested by senior counselor to view their own workshop submission
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Find the workshop submission for the authenticated senior counselor
    const workshopSubmission = await storage.model('WorkshopSubmission').findOne({ _seniorCounselor: req.session.userId }).populate('assignments.workshop1').populate('assignments.workshop2').populate('_seniorCounselor');
    if (!workshopSubmission) {
      return res.status(404).json({ error: 'Workshop submission not found' });
    }
    return res.status(200).json(workshopSubmission);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new workshop submission
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { assignments } = req.body;
    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'Assignments array is required and must not be empty' });
    }
    for (const assignment of assignments) {
      if (!assignment.name || !assignment.workshop1 || !assignment.workshop2) {
        return res.status(400).json({ error: 'Each assignment must have a name, workshop1, and workshop2' });
      }
    }

    const existing = await storage.model('WorkshopSubmission').findOne({ _seniorCounselor: req.session.userId });
    if (existing) {
      const updatedWorkshopSubmission = await existing.update({ assignments });
      return res.status(200).json(updatedWorkshopSubmission);
    }

    const workshopSubmission = await storage.model('WorkshopSubmission').create({ _seniorCounselor: req.session.userId, assignments });
    return res.status(200).json(workshopSubmission);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a workshop submission by id
 */
router.put('/:submissionId', isAuthenticated, async (req, res) => {
  try {
    const { submissionId } = req.params;
    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId required' });
    }
    const workshopSubmission = await storage.model('WorkshopSubmission').findById(submissionId);
    if (!workshopSubmission) {
      return res.status(404).json({ error: 'Workshop submission not found' });
    }
    // Only allow the owner to update
    if (workshopSubmission._seniorCounselor.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'You can only update your own workshop submissions' });
    }
    const updatedWorkshopSubmission = await workshopSubmission.update(req.body);
    return res.status(200).json(updatedWorkshopSubmission);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a workshop submission by id
 */
router.delete('/:submissionId', isAuthenticated, async (req, res) => {
try {
    const { submissionId } = req.params;
    if (!submissionId) {
    return res.status(400).json({ error: 'submissionId required' });
    }

    const workshopSubmission = await storage.model('WorkshopSubmission').findById(submissionId);
    if (!workshopSubmission) {
    return res.status(404).json({ error: 'Workshop submission not found' });
    }

    // Only allow the owner to delete
    if (workshopSubmission._seniorCounselor.toString() !== req.session.userId) {
    return res.status(403).json({ error: 'You can only delete your own workshop submissions' });
    }

    await workshopSubmission.deleteOne();
    return res.status(200).json({ success: true, message: 'Workshop submission deleted' });
} catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
}
});

// ------------------------- ADMIN ROUTES -------------------------

/**
 * Get all workshop submissions
 */
router.get('/admin/all', isAuthenticatedAdmin, async (req, res) => {
  try {
    const workshopSubmissions = await storage.model('WorkshopSubmission')
      .find()
      .populate('assignments.workshop1')
      .populate('assignments.workshop2')
      .populate('_seniorCounselor')
      .sort({ updatedAt: -1 });

    return res.status(200).json(workshopSubmissions);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a specific workshop submission by ID (admin only)
 */
router.get('/admin/:submissionId', isAuthenticatedAdmin, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const workshopSubmission = await storage.model('WorkshopSubmission')
      .findById(submissionId)
      .populate('assignments.workshop1')
      .populate('assignments.workshop2')
      .populate('_seniorCounselor');

    if (!workshopSubmission) {
      return res.status(404).json({ error: 'Workshop submission not found' });
    }

    return res.status(200).json(workshopSubmission);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});


export default { path: '/workshop-submissions', router };
