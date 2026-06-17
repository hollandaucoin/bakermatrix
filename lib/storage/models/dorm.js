import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

const DORM_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2']; 
const DORM_TYPES = ['male', 'female', 'staff'];

// Schema for a dorm
const Dorm = new storage.schema({
  name: { type: String, enum: DORM_OPTIONS, required: true },
  type: { type: String, enum: DORM_TYPES, required: true }
});

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a dorm
 * @param {Object} params - Parameters for the dorm
 * @param {String} params.name - Name of the dorm
 * @param {String} params.type - Type of the dorm
 * 
 * @returns {Dorm} dorm - New dorm object
 */
Dorm.statics.create = async ({ name, type } = {}) => {
  try {
    // Validate the parameters
    if (typeof name !== 'string' || !DORM_OPTIONS.includes(name)) { throw new HandledError('Valid name required', 400); }
    if (typeof type !== 'string' || !DORM_TYPES.includes(type)) { throw new HandledError('Valid type required', 400); }

    const dorm = new storage.model('Dorm')({ name, type });
    await dorm.save();

    return dorm;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating dorm: ${err.message}`);
      throw err;
    }
    logger.error('Error creating dorm', err);
    throw new HandledError('Error creating dorm', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------

/**
 * Method to update a dorm
 * @param {Object} params - Parameters to update on the dorm
 * @param {String} params.name - Name to update the dorm to
 * @param {String} params.type - Type to update the dorm with
 * 
 * @returns {Dorm} dorm - Updated dorm object
 */
Dorm.methods.update = async function({ name, type } = {}) {
   try {
    // Validate the update parameters and set if valid
    if (name){
      if (typeof name !== 'string' || !DORM_OPTIONS.includes(name)) { throw new HandledError('Parameter name must be a string', 400); }
      this.name = name;
    }
    if (type) {
      if (typeof type !== 'string' || !DORM_TYPES.includes(type)) { throw new HandledError('Parameter type must be a string', 400); }
      this.type = type;
    }
    await this.save();
    return this;
   } catch (err) {
    logger.error('Error updating dorm', err, { dormId: this._id });
    throw new HandledError('Error updating dorm', 500);
   }
};

export default storage.model('Dorm', Dorm);