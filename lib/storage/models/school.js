import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for a school
const School = new storage.schema({
  name: { type: String, required: true },
  delegateCount: { type: Number, required: true }
});

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a school
 * @param {Object} params - Parameters for the school
 * @param {String} params.name - Name of the school
 * @param {Number} params.delegateCount - Number of delegates in the school
 * 
 * @returns {School} school - New school object
 */
School.statics.create = async ({ name, delegateCount } = {}) => {
  try {
    // Validate the parameters
    if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
    if (typeof delegateCount !== 'number') { throw new HandledError('Valid delegateCount is required', 400); }

    const school = new storage.model('School')({ name, delegateCount });
    await school.save();

    return school;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating school: ${err.message}`);
      throw err;
    }
    logger.error('Error creating school', err);
    throw new HandledError('Error creating school', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------

/**
 * Method to update a school
 * @param {Object} params - Parameters to update on the school
 * @param {String} params.name - Name to update the school to
 * @param {Number} params.delegateCount - Number of delegate to update the school with
 * 
 * @returns {School} school - Updated school object
 */
School.methods.update = async function({ name, delegateCount } = {}) {
   try {
    // Validate the update parameters and set if valid
    if (name){
      if (typeof name !== 'string') { throw new HandledError('Parameter name must be a string', 400); }
      this.name = name;
    }
    if (delegateCount) {
      if (typeof delegateCount !== 'number') { throw new HandledError('Parameter delegateCount must be a number', 400); }
      this.delegateCount = delegateCount;
    }
    await this.save();
    return this;
   } catch (err) {
    logger.error('Error updating school', err, { schoolId: this._id });
    throw new HandledError('Error updating school', 500);
   }
};

export default storage.model('School', School);