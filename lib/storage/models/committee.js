import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';
import { ADDITIONAL_ROOMS_SESSIONS } from '../../util/constants.js';

const normalizeLocation = (location) => {
  if (location === null || location === undefined || location === '') {
    return null;
  }
  if (typeof location !== 'string' || !ADDITIONAL_ROOMS_SESSIONS.includes(location)) {
    throw new HandledError('Valid location required', 400);
  }
  return location;
};

// Schema for a committee
const Committee = new storage.schema({
  name: { type: String, required: true },
  location: { type: String, default: null },
  _seniorCounselor: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor' },
});

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a committee
 * @param {Object} params - Parameters for the committee
 * @param {String} params.name - Name of the committee
 * @param {String} [params.location] - Room/location from ADDITIONAL_ROOMS_SESSIONS
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the committee
 *
 * @returns {Committee} committee - New committee object
 */
Committee.statics.create = async function({ name, location, _seniorCounselor } = {}) {
  try {
    // Validate the parameters
    if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
    if (typeof _seniorCounselor !== 'string') { throw new HandledError('Valid seniorCounselor required', 400); }
    const seniorCounselor = await storage.model('SeniorCounselor').findById(_seniorCounselor);
    if (!seniorCounselor) { throw new HandledError('seniorCounselor provided is not valid', 400); }

    const committee = new storage.model('Committee')({
      name,
      location: normalizeLocation(location),
      _seniorCounselor,
    });
    await committee.save();

    return committee;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating committee: ${err.message}`);
      throw err;
    }
    logger.error('Error creating committee', err);
    throw new HandledError('Error creating committee', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------

/**
 * Method to update a committee
 * @param {Object} params - Parameters to update on the committee
 * @param {String} params.name - Name of the committee
 * @param {String|null} [params.location] - Room/location from ADDITIONAL_ROOMS_SESSIONS
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the committee
 *
 * @returns {Committee} committee - Updated committee object
 */
Committee.methods.update = async function({ name, location, _seniorCounselor } = {}) {
  try {
    // Validate the update parameters and set if valid
    if (name) {
      if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
      this.name = name;
    }
    if (location !== undefined) {
      this.location = normalizeLocation(location);
    }
    if (_seniorCounselor) {
      if (typeof _seniorCounselor !== 'string') { throw new HandledError('Valid seniorCounselor required', 400); }
      const seniorCounselor = await storage.model('SeniorCounselor').findById(_seniorCounselor);
      if (!seniorCounselor) { throw new HandledError('seniorCounselor provided is not valid', 400); }
      this._seniorCounselor = seniorCounselor._id;
    }

   await this.save();
   return this;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error updating committee: ${err.message}`);
      throw err;
    }
   logger.error('Error updating committee', err, { committeeId: this._id });
   throw new HandledError('Error updating committee', 500);
  }
};

export default storage.model('Committee', Committee);
