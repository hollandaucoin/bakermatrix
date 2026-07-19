import express from 'express';
import storage from '../storage/index.js';
import { isAuthenticatedAdmin, isSeniorCounselor } from './_middleware.js';

const router = express.Router();

/**
 * Get all workshops
 */
router.get('/', async (req, res) => {
  try {
    const workshops = await storage.model('Workshop').find().populate('_seniorCounselor');
    if (!workshops || workshops.length === 0) {
      return res.status(404).json({ error: 'No workshops found' });
    }
    workshops.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(workshops);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get enrollment lists for workshops owned by the authenticated SC.
 */
router.get('/mine', isSeniorCounselor, async (req, res) => {
  try {
    const workshops = await storage.model('Workshop')
      .find({ _seniorCounselor: req.session.userId })
      .populate('_seniorCounselor')
      .sort({ name: 1 });

    const workshopIds = workshops.map((workshop) => workshop._id);
    const submissions = workshopIds.length > 0
      ? await storage.model('WorkshopSubmission')
        .find({
          $or: [
            { 'assignments.workshop1': { $in: workshopIds } },
            { 'assignments.workshop2': { $in: workshopIds } },
          ],
        })
        .populate('assignments.workshop1')
        .populate('assignments.workshop2')
        .populate('_seniorCounselor')
      : [];

    const enrollments = workshops.map((workshop) => {
      const session1 = [];
      const session2 = [];

      submissions.forEach((submission) => {
        const seniorCounselor = submission._seniorCounselor
          ? {
            _id: submission._seniorCounselor._id,
            name: submission._seniorCounselor.name || submission._seniorCounselor.username,
          }
          : null;

        submission.assignments.forEach((assignment) => {
          if (assignment.workshop1?._id?.toString() === workshop._id.toString()) {
            session1.push({ name: assignment.name, seniorCounselor });
          }
          if (assignment.workshop2?._id?.toString() === workshop._id.toString()) {
            session2.push({ name: assignment.name, seniorCounselor });
          }
        });
      });

      session1.sort((a, b) => a.name.localeCompare(b.name));
      session2.sort((a, b) => a.name.localeCompare(b.name));

      return {
        workshop,
        session1,
        session2,
        session1Count: session1.length,
        session2Count: session2.length,
        totalCount: session1.length + session2.length,
      };
    });

    return res.status(200).json(enrollments);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new workshop
 */
router.post('/', async (req, res) => {
  try {
    const response = await storage.model('Workshop').create(req.body);
    const workshop = await storage.model('Workshop').findById(response._id).populate('_seniorCounselor');
    return res.status(200).json(workshop);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a workshop by id
 */
router.put('/:workshopId', async (req, res) => {
  try {
    const { workshopId } = req.params;
    if (!workshopId) { return res.status(400).json({ error: 'workshopId required' }); }

    const workshop = await storage.model('Workshop').findById(workshopId);
    if (!workshop) { return res.status(400).json({ error: 'workshop not found' }); }

    const response = await workshop.update(req.body);
    const updatedWorkshop = await storage.model('Workshop').findById(response._id).populate('_seniorCounselor');
    return res.status(200).json(updatedWorkshop);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a workshop by id
 */
router.delete('/:workshopId', async (req, res) => {
  try {
    const { workshopId } = req.params;
    if (!workshopId) { return res.status(400).json({ error: 'workshopId required' }); }

    await storage.model('Workshop').findByIdAndDelete(workshopId);

    return res.status(200).json({ message: 'Workshop deleted successfully' });
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all workshops with detailed enrollment info (admin only)
 * Shows who signed up for each workshop in session 1 and session 2
 */
router.get('/admin/enrollments', isAuthenticatedAdmin, async (req, res) => {
  try {
    // Get all workshops
    const workshops = await storage.model('Workshop').find().populate('_seniorCounselor').sort({ name: 1 });

    // Get all submissions
    const submissions = await storage.model('WorkshopSubmission')
      .find()
      .populate('assignments.workshop1')
      .populate('assignments.workshop2')
      .populate('_seniorCounselor');

    // Build enrollment data
    const enrollments = workshops.map(workshop => {
      const session1 = []; // Workshop 1 enrollments
      const session2 = []; // Workshop 2 enrollments

      submissions.forEach(submission => {
        submission.assignments.forEach(assignment => {
          // Check if this assignment has this workshop as workshop1
          if (assignment.workshop1 && assignment.workshop1._id.toString() === workshop._id.toString()) {
            session1.push({
              name: assignment.name,
              seniorCounselor: submission._seniorCounselor ? {
                name: submission._seniorCounselor.name || submission._seniorCounselor.username,
                id: submission._seniorCounselor._id
              } : null
            });
          }
          // Check if this assignment has this workshop as workshop2
          if (assignment.workshop2 && assignment.workshop2._id.toString() === workshop._id.toString()) {
            session2.push({
              name: assignment.name,
              seniorCounselor: submission._seniorCounselor ? {
                name: submission._seniorCounselor.name || submission._seniorCounselor.username,
                id: submission._seniorCounselor._id
              } : null
            });
          }
        });
      });

      return {
        workshop: {
          _id: workshop._id,
          name: workshop.name,
          _seniorCounselor: workshop._seniorCounselor,
        },
        session1,
        session2,
        session1Count: session1.length,
        session2Count: session2.length,
        totalCount: session1.length + session2.length
      };
    });

    return res.status(200).json(enrollments);
  } catch (err) {
    console.error('Error getting workshop enrollments:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/workshops' };
