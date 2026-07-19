import express from 'express';
import storage from '../storage/index.js';
import { isAuthenticatedAdmin, isSeniorCounselor } from './_middleware.js';

const router = express.Router();

/**
 * Get all committees
 */
router.get('/', async (req, res) => {
  try {
    const committees = await storage.model('Committee').find().populate('_seniorCounselor');
    if (!committees || committees.length === 0) {
      return res.status(404).json({ error: 'No committees found' });
    }
    committees.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(committees);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get enrollment lists for committees owned by the authenticated SC.
 */
router.get('/mine', isSeniorCounselor, async (req, res) => {
  try {
    const committees = await storage.model('Committee')
      .find({ _seniorCounselor: req.session.userId })
      .populate('_seniorCounselor')
      .sort({ name: 1 });

    const committeeIds = committees.map((committee) => committee._id);
    const submissions = committeeIds.length > 0
      ? await storage.model('CommitteeSubmission')
        .find({ 'assignments.committee': { $in: committeeIds } })
        .populate('assignments.committee')
        .populate('_seniorCounselor')
      : [];

    const enrollments = committees.map((committee) => {
      const names = [];
      submissions.forEach((submission) => {
        submission.assignments.forEach((assignment) => {
          if (assignment.committee?._id?.toString() === committee._id.toString()) {
            names.push({
              name: assignment.name,
              seniorCounselor: submission._seniorCounselor
                ? {
                  _id: submission._seniorCounselor._id,
                  name: submission._seniorCounselor.name || submission._seniorCounselor.username,
                }
                : null,
            });
          }
        });
      });

      return {
        committee,
        names: names.sort((a, b) => a.name.localeCompare(b.name)),
        count: names.length,
      };
    });

    return res.status(200).json(enrollments);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new committee
 */
router.post('/', async (req, res) => {
  try {
    const response = await storage.model('Committee').create(req.body);
    const committee = await storage.model('Committee').findById(response._id).populate('_seniorCounselor');
    return res.status(200).json(committee);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a committee by id
 */
router.put('/:committeeId', async (req, res) => {
  try {
    const { committeeId } = req.params;
    if (!committeeId) { return res.status(400).json({ error: 'committeeId required' }); }

    const committee = await storage.model('Committee').findById(committeeId);
    if (!committee) { return res.status(400).json({ error: 'committee not found' }); }

    const response = await committee.update(req.body);
    const updatedCommittee = await storage.model('Committee').findById(response._id).populate('_seniorCounselor');
    return res.status(200).json(updatedCommittee);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a committee by id
 */
router.delete('/:committeeId', async (req, res) => {
  try {
    const { committeeId } = req.params;
    if (!committeeId) { return res.status(400).json({ error: 'committeeId required' }); }

    await storage.model('Committee').findByIdAndDelete(committeeId);

    return res.status(200).json({ message: 'Committee deleted successfully' });
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all committees with detailed enrollment info (admin only)
 * Shows who signed up for each committee
 */
router.get('/admin/enrollments', isAuthenticatedAdmin, async (req, res) => {
  try {
    // Get all committees
    const committees = await storage.model('Committee').find().populate('_seniorCounselor').sort({ name: 1 });

    // Get all submissions
    const submissions = await storage.model('CommitteeSubmission')
      .find()
      .populate('assignments.committee')
      .populate('_seniorCounselor');

    // Build enrollment data
    const enrollments = committees.map(committee => {
      const names = [];

      submissions.forEach(submission => {
        submission.assignments.forEach(assignment => {
          // Check if this assignment has this committee
          if (assignment.committee && assignment.committee._id.toString() === committee._id.toString()) {
            names.push({
              name: assignment.name,
              seniorCounselor: submission._seniorCounselor ? {
                name: submission._seniorCounselor.name || submission._seniorCounselor.username,
                _id: submission._seniorCounselor._id
              } : null
            });
          }
        });
      });

      return {
        committee: committee,
        names: names.sort((a, b) => a.name.localeCompare(b.name)),
        count: names.length
      };
    });

    return res.status(200).json(enrollments);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/committees' };
