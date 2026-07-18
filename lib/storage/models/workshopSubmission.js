import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for a workshop submission
const WorkshopSubmission = new storage.schema({
  _seniorCounselor: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor' },
  assignments: [{
    name: { type: String, required: true },
    workshop1: { type: storage.schema.Types.ObjectId, ref: 'Workshop' },
    workshop2: { type: storage.schema.Types.ObjectId, ref: 'Workshop' },
  }],
}, { timestamps: true });

const validateAssignments = async (assignments) => {
  if (!Array.isArray(assignments)) {
    throw new HandledError('assignments must be an array', 400);
  }

  const normalized = [];
  for (const assignment of assignments) {
    const name = typeof assignment?.name === 'string' ? assignment.name.trim() : '';
    if (!name) {
      throw new HandledError('Valid name required', 400);
    }
    if (assignment.workshop1 && assignment.workshop1 === assignment.workshop2) {
      throw new HandledError('Workshop 1 and Workshop 2 must be different', 400);
    }

    const normalizedAssignment = { name };
    for (const field of ['workshop1', 'workshop2']) {
      const workshopId = assignment[field];
      if (!workshopId) continue;
      if (typeof workshopId !== 'string') {
        throw new HandledError(`Valid ${field} required`, 400);
      }
      const workshop = await storage.model('Workshop').findById(workshopId);
      if (!workshop) {
        throw new HandledError(`${field} provided is not valid`, 400);
      }
      normalizedAssignment[field] = workshop._id;
    }
    normalized.push(normalizedAssignment);
  }

  return normalized;
};

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a new workshop submission
 * @param {Object} params - Parameters for the workshop submission
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the workshop submission
 * @param {Array<Object>} params.assignments - Array of objects containing the name and workshop for each delegate
 * 
 * @returns {WorkshopSubmission} workshopSubmission - New workshop submission object
 */
WorkshopSubmission.statics.create = async function({ _seniorCounselor, assignments } = {}) {
  try {
    // Validate the parameters
    if (typeof _seniorCounselor !== 'string') { throw new HandledError('Valid seniorCounselor required', 400); }
    const seniorCounselor = await storage.model('SeniorCounselor').findById(_seniorCounselor);
    if (!seniorCounselor) { throw new HandledError('seniorCounselor provided is not valid', 400); }

    const normalizedAssignments = await validateAssignments(assignments);

    const workshopSubmission = new storage.model('WorkshopSubmission')({
      _seniorCounselor,
      assignments: normalizedAssignments,
    });
    await workshopSubmission.save();

    return workshopSubmission;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating workshop submission: ${err.message}`);
      throw err;
    }
    logger.error('Error creating workshop submission', err);
    throw new HandledError('Error creating workshop submission', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------

/**
 * Method to update a workshop submission
 * @param {Object} params - Parameters to update on the workshop submission
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the workshop submission
 * @param {Array<Object>} params.assignments - Array of objects containing the name and workshop for each delegate
 * 
 * @returns {WorkshopSubmission} workshopSubmission - Updated workshop submission object
 */
WorkshopSubmission.methods.update = async function({ _seniorCounselor, assignments } = {}) {
  try {
    // Validate the update parameters and set if valid
    if (_seniorCounselor) {
      if (typeof _seniorCounselor !== 'string') { throw new HandledError('Valid seniorCounselor required', 400); }
      const seniorCounselor = await storage.model('SeniorCounselor').findById(_seniorCounselor);
      if (!seniorCounselor) { throw new HandledError('seniorCounselor provided is not valid', 400); }
      this._seniorCounselor = seniorCounselor._id;
    }
    if (assignments) {
      this.assignments = await validateAssignments(assignments);
    }

   await this.save();
   return this;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error updating workshop submission: ${err.message}`);
      throw err;
    }
   logger.error('Error updating workshop submission', err, { workshopSubmissionId: this._id });
   throw new HandledError('Error updating workshop submission', 500);
  }
};

export default storage.model('WorkshopSubmission', WorkshopSubmission);