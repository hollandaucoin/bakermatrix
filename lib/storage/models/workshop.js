import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for a workshop
const Workshop = new storage.schema({
  name: { type: String, required: true },
  _seniorCounselor: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor' },
});

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a workshop
 * @param {Object} params - Parameters for the workshop
 * @param {String} params.name - Name of the workshop
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the workshop
 * 
 * @returns {Workshop} workshop - New workshop object
 */
Workshop.statics.create = async function({ name, _seniorCounselor } = {}) {
  try {
    // Validate the parameters
    if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
    if (typeof _seniorCounselor !== 'string') { throw new HandledError('Valid seniorCounselor required', 400); }
    const seniorCounselor = await storage.model('SeniorCounselor').findById(_seniorCounselor);
    if (!seniorCounselor) { throw new HandledError('seniorCounselor provided is not valid', 400); }

    const workshop = new storage.model('Workshop')({ name, _seniorCounselor });
    await workshop.save();

    return workshop;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating workshop: ${err.message}`);
      throw err;
    }
    logger.error('Error creating workshop', err);
    throw new HandledError('Error creating workshop', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------

/**
 * Method to update a workshop
 * @param {Object} params - Parameters to update on the workshop
 * @param {String} params.name - Name of the workshop
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the workshop
 * 
 * @returns {Workshop} workshop - Updated workshop object
 */
Workshop.methods.update = async function({ name, _seniorCounselor } = {}) {
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
      logger.info(`Error updating workshop: ${err.message}`);
      throw err;
    }
   logger.error('Error updating workshop', err, { workshopId: this._id });
   throw new HandledError('Error updating workshop', 500);
  }
};

export default storage.model('Workshop', Workshop);