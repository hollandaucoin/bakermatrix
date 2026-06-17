import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for a committee
const Committee = new storage.schema({
  name: { type: String, required: true },
  _seniorCounselor: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor' },
});

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a committee
 * @param {Object} params - Parameters for the committee
 * @param {String} params.name - Name of the committee
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the committee
 * 
 * @returns {Committee} committee - New committee object
 */
Committee.statics.create = async function({ name, _seniorCounselor } = {}) {
  try {
    // Validate the parameters
    if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
    if (typeof _seniorCounselor !== 'string') { throw new HandledError('Valid seniorCounselor required', 400); }
    const seniorCounselor = await storage.model('SeniorCounselor').findById(_seniorCounselor);
    if (!seniorCounselor) { throw new HandledError('seniorCounselor provided is not valid', 400); }

    const committee = new storage.model('Committee')({ name, _seniorCounselor });
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
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the committee
 * 
 * @returns {Committee} committee - Updated committee object
 */
Committee.methods.update = async function({ name, _seniorCounselor } = {}) {
  try {
    // Validate the update parameters and set if valid
    if (name) {
      if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
      this.name = name;
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