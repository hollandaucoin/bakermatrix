import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for a committee submission
const CommitteeSubmission = new storage.schema({
  _seniorCounselor: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor' },
  assignments: [{
    name: { type: String, required: true },
    committee: { type: storage.schema.Types.ObjectId, ref: 'Committee' },
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

    const normalizedAssignment = { name };
    if (assignment.committee) {
      if (typeof assignment.committee !== 'string') {
        throw new HandledError('Valid committee required', 400);
      }
      const committee = await storage.model('Committee').findById(assignment.committee);
      if (!committee) {
        throw new HandledError('committee provided is not valid', 400);
      }
      normalizedAssignment.committee = committee._id;
    }
    normalized.push(normalizedAssignment);
  }

  return normalized;
};

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a new committee submission
 * @param {Object} params - Parameters for the committee submission
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the committee submission
 * @param {Array<Object>} params.assignments - Array of objects containing the name and committee for each delegate
 * 
 * @returns {CommitteeSubmission} committeeSubmission - New committee submission object
 */
CommitteeSubmission.statics.create = async function({ _seniorCounselor, assignments } = {}) {
  try {
    // Validate the parameters
    if (typeof _seniorCounselor !== 'string') { throw new HandledError('Valid seniorCounselor required', 400); }
    const seniorCounselor = await storage.model('SeniorCounselor').findById(_seniorCounselor);
    if (!seniorCounselor) { throw new HandledError('seniorCounselor provided is not valid', 400); }

    const normalizedAssignments = await validateAssignments(assignments);

    const committeeSubmission = new storage.model('CommitteeSubmission')({
      _seniorCounselor,
      assignments: normalizedAssignments,
    });
    await committeeSubmission.save();

    return committeeSubmission;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating committee submission: ${err.message}`);
      throw err;
    }
    logger.error('Error creating committee submission', err);
    throw new HandledError('Error creating committee submission', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------

/**
 * Method to update a committee submission
 * @param {Object} params - Parameters to update on the committee submission
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the committee submission
 * @param {Array<Object>} params.assignments - Array of objects containing the name and committee for each delegate
 * 
 * @returns {CommitteeSubmission} committeeSubmission - Updated committee submission object
 */
CommitteeSubmission.methods.update = async function({ _seniorCounselor, assignments } = {}) {
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
      logger.info(`Error updating committee submission: ${err.message}`);
      throw err;
    }
   logger.error('Error updating committee submission', err, { committeeSubmissionId: this._id });
   throw new HandledError('Error updating committee submission', 500);
  }
};

export default storage.model('CommitteeSubmission', CommitteeSubmission);