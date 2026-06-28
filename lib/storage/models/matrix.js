import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';
import { ROOMS_BY_SIZE } from '../../util/constants.js';
import { validateMatrixCouncils, computeMatrixBalance, computePostingDormIssues } from '../../util/matrixValidation.js';

// Schema for a matrix
const Matrix = new storage.schema({
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  councils: [{
    number: { type: Number, required: true },
    room: { type: String, enum: [...Object.keys(ROOMS_BY_SIZE), 'Pavilion'], required: true },
    delegateCount: { type: Number, required: true },
    schools: { type: [String], required: true },
    seniorCounselor: { type: String, required: true },
    seniorCounselorId: { type: String },
    juniorCounselors: { type: [{ name: String, dorm: String }], required: true },
    scPostingDorm: { type: { name: String, jcs: String, partner: String }, required: true },
    hasConflicts: { type: Boolean, default: false },
    hasPostingSeparationViolation: { type: Boolean, default: false },
    // Formatted school strings ("Name - count") in this council that conflict
    // with the SC/JCs by associated or previous schools. Used to flag them red.
    conflictingSchools: { type: [String], default: [] }
  }],
  saved: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  // Per-half committee / lead / gender counts and a list of balance issues,
  // computed at generation time so the UI can flag uneven distribution.
  balance: { type: storage.schema.Types.Mixed },
});

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a new matrix
 * @param {Object} params - Parameters for the matrix
 * @param {String} params.name - Name of the matrix
 * @param {Array<Object>} params.councils - Councils to be created
 * @param {Boolean} params.saved - Whether the matrix is saved to be viewable again
 * 
 * @returns {Matrix} matrix - New matrix object
 */
Matrix.statics.create = async function({ name, councils, saved = false, balance } = {}) {
  try {
    // Validate the parameters
    if (typeof name !== 'string') {
      const date = new Date().toISOString().split('T')[0];
      const time = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles' });
      const matrixCount = await storage.model('Matrix').countDocuments();
      name = `Matrix ${matrixCount + 1} (${date} ${time})`;
    }
    if (!Array.isArray(councils)) { throw new HandledError('councils must be an array', 400); }

    // Ensure all information side of the councils is valid
    for (const council of councils) {
      if (typeof council.number !== 'number') { throw new HandledError('number must be a number', 400); }
      if (typeof council.room !== 'string') { throw new HandledError('room must be a string', 400); }

      if (!Array.isArray(council.schools)) { throw new HandledError('schools must be an array', 400); }
      for (const school of council.schools) {
        if (typeof school !== 'string') { throw new HandledError('contents inside of schools must be strings', 400); }
      }

      if (typeof council.seniorCounselor !== 'string') { throw new HandledError('seniorCounselor must be a string', 400); }
      if (!Array.isArray(council.juniorCounselors)) { throw new HandledError('juniorCounselors must be an array', 400); }
      for (const juniorCounselor of council.juniorCounselors) {
        if (typeof juniorCounselor.name !== 'string') { throw new HandledError('name inside of juniorCounselors must be a string', 400); }
        if (typeof juniorCounselor.dorm !== 'string') { throw new HandledError('dorm inside of juniorCounselors must be a string', 400); }
      }

      if (council.scPostingDorm) {
        if (typeof council.scPostingDorm.name !== 'string') { throw new HandledError('name inside of scPostingDorm must be a string', 400); }
        if (typeof council.scPostingDorm.jcs !== 'string') { throw new HandledError('jcs inside of scPostingDorm must be a string', 400); }
      }

      if (typeof council.hasConflicts !== 'boolean') { throw new HandledError('hasConflicts must be a boolean', 400); }
      if (council.hasPostingSeparationViolation !== undefined
        && typeof council.hasPostingSeparationViolation !== 'boolean') {
        throw new HandledError('hasPostingSeparationViolation must be a boolean', 400);
      }
    }

    const matrix = new storage.model('Matrix')({ name, councils, saved, balance });
    await matrix.save();

    return matrix;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating matrix: ${err.message}`);
      throw err;
    }
    logger.error('Error creating matrix', err);
    throw new HandledError('Error creating matrix', 500);
  }
};

/**
 * Method to update a matrix
 * @param {String} id - The id of the matrix
 * @param {Boolean} [saved] - The saved status of the matrix
 * @param {String} [name] - The name of the matrix
 * @param {Boolean} [selected] - Whether this is the final/selected matrix
 *
 * @returns {Matrix} matrix - The updated matrix object
 */
Matrix.statics.update = async function(id, { saved, name, selected, councils, balance } = {}) {
  try {
    if (typeof id !== 'string') { throw new HandledError('id must be a string', 400); }

    const update = {};
    if (saved !== undefined) {
      if (typeof saved !== 'boolean') { throw new HandledError('saved must be a boolean', 400); }
      update.saved = saved;
    }
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) { throw new HandledError('name must be a non-empty string', 400); }
      update.name = name.trim();
    }
    if (selected !== undefined) {
      if (typeof selected !== 'boolean') { throw new HandledError('selected must be a boolean', 400); }
      if (selected) {
        await storage.model('Matrix').updateMany({}, { $set: { selected: false } });
        update.selected = true;
      } else {
        update.selected = false;
      }
    }
    if (councils !== undefined) {
      if (!Array.isArray(councils)) { throw new HandledError('councils must be an array', 400); }
      const seniorCounselors = await storage.model('SeniorCounselor').find()
        .populate('_jcPairing _jcPairing2 _associatedSchool _previousSchools');
      const schools = await storage.model('School').find();
      const dorms = await storage.model('Dorm').find({ type: { $ne: 'staff' } });
      update.councils = validateMatrixCouncils(councils, seniorCounselors, schools);

      const postingDormIssues = computePostingDormIssues(update.councils, dorms, seniorCounselors);
      if (postingDormIssues.length > 0) {
        throw new HandledError(postingDormIssues.join('; '), 400);
      }

      const existing = await storage.model('Matrix').findById(id);
      const group1Size = existing?.balance?.group1?.size ?? Math.ceil(update.councils.length / 2);
      update.balance = computeMatrixBalance(update.councils, group1Size);
    }
    if (balance !== undefined) {
      update.balance = balance;
    }

    if (Object.keys(update).length === 0) {
      throw new HandledError('No valid update fields provided', 400);
    }

    const matrix = await storage.model('Matrix').findByIdAndUpdate(id, update, { new: true });
    if (!matrix) { throw new HandledError('Matrix not found', 404); }
    return matrix;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error updating matrix: ${err.message}`);
      throw err;
    }
    logger.error('Error updating matrix', err);
    throw new HandledError('Error updating matrix', 500);
  }
};

export default storage.model('Matrix', Matrix);