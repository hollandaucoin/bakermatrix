import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for a workshop
const Workshop = new storage.schema({
  name: { type: String, required: true },
  _seniorCounselor: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor' },
  _seniorCounselor2: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor', default: null },
});

const validateSeniorCounselor = async (value, fieldName) => {
  if (typeof value !== 'string') {
    throw new HandledError(`Valid ${fieldName} required`, 400);
  }
  const seniorCounselor = await storage.model('SeniorCounselor').findById(value);
  if (!seniorCounselor) {
    throw new HandledError(`${fieldName} provided is not valid`, 400);
  }
  return seniorCounselor;
};

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a workshop
 * @param {Object} params - Parameters for the workshop
 * @param {String} params.name - Name of the workshop
 * @param {ObjectId} params._seniorCounselor - Senior counselor assigned to the workshop
 * 
 * @returns {Workshop} workshop - New workshop object
 */
Workshop.statics.create = async function({ name, _seniorCounselor, _seniorCounselor2 } = {}) {
  try {
    // Validate the parameters
    if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
    const seniorCounselor = await validateSeniorCounselor(_seniorCounselor, 'seniorCounselor');
    let seniorCounselor2 = null;
    if (_seniorCounselor2) {
      seniorCounselor2 = await validateSeniorCounselor(_seniorCounselor2, 'seniorCounselor2');
      if (seniorCounselor._id.equals(seniorCounselor2._id)) {
        throw new HandledError('The two senior counselors must be different', 400);
      }
    }

    const workshop = new storage.model('Workshop')({
      name,
      _seniorCounselor: seniorCounselor._id,
      _seniorCounselor2: seniorCounselor2?._id || null,
    });
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
Workshop.methods.update = async function({ name, _seniorCounselor, _seniorCounselor2 } = {}) {
  try {
    // Validate the update parameters and set if valid
    if (name) {
      if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
      this.name = name;
    } 
    if (_seniorCounselor) {
      const seniorCounselor = await validateSeniorCounselor(_seniorCounselor, 'seniorCounselor');
      this._seniorCounselor = seniorCounselor._id;
    }
    if (typeof _seniorCounselor2 !== 'undefined') {
      if (_seniorCounselor2 === null || _seniorCounselor2 === '') {
        this._seniorCounselor2 = null;
      } else {
        const seniorCounselor2 = await validateSeniorCounselor(_seniorCounselor2, 'seniorCounselor2');
        this._seniorCounselor2 = seniorCounselor2._id;
      }
    }
    if (
      this._seniorCounselor
      && this._seniorCounselor2
      && this._seniorCounselor.equals(this._seniorCounselor2)
    ) {
      throw new HandledError('The two senior counselors must be different', 400);
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