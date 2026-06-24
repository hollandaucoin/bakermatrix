import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for a JC
const JuniorCounselor = new storage.schema({
  name: { type: String, required: true },
  year: { type: Number, enum: [1, 2, 3], required: true },
  _dorm: { type: storage.schema.Types.ObjectId, ref: 'Dorm' },
  _associatedSchool: { type: storage.schema.Types.ObjectId, ref: 'School' },
  _previousSchools: { type: [storage.schema.Types.ObjectId], ref: 'School' }
});

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a new JC
 * @param {Object} params - Parameters for the JC
 * @param {String} params.name - Name of the JC
 * @param {Number} params.year - Year of the JC (1, 2, or 3)
 * @param {String} params._dorm - Dorm assignment of the JC
 * @param {ObjectId} params._associatedSchool - School that the JC attended
 * @param {Array<ObjectId>} params._previousSchools - Any schools that the JC was paired with previously (up to 3)
 * 
 * @returns {JuniorCounselor} juniorCounselor - New juniorCounselor object
 */
JuniorCounselor.statics.create = async function({ name, year, _dorm, _associatedSchool, _previousSchools } = {}) {
  try {
    // Validate the parameters
    if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
    if (typeof year !== 'number' || ![1, 2, 3].includes(year)) { throw new HandledError('Valid year required (1, 2, or 3)', 400); }
    
    // Ensure associated IDs passed in are valid
    if (_dorm) {
      if (typeof _dorm !== 'string') { throw new HandledError('_dorm required as a string', 400); }
      const dorm = await storage.model('Dorm').findById(_dorm);
      if (!dorm) { throw new HandledError('_dorm provided is not valid', 400); }
    }
    if (_associatedSchool) {
      if (typeof _associatedSchool !== 'string') { throw new HandledError('_associatedSchool required as a string', 400); }
      const associatedSchool = await storage.model('School').findById(_associatedSchool);
      if (!associatedSchool) { throw new HandledError('_associatedSchool provided is not valid', 400); }
    }
    if (_previousSchools) {
      if (!Array.isArray(_previousSchools)) { throw new HandledError('_previousSchools must be an array', 400); }
      const previousSchools = await storage.model('School').find({ _id: { $in: _previousSchools }});
      if (!previousSchools || previousSchools.length !== _previousSchools.length) { throw new HandledError('school(s) in _previousSchools are not valid', 400)}
    }

    const juniorCounselor = new storage.model('JuniorCounselor')({ name, year, _dorm, _associatedSchool, _previousSchools });
    await juniorCounselor.save();

    return juniorCounselor;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating juniorCounselor: ${err.message}`);
      throw err;
    }
    logger.error('Error creating juniorCounselor', err);
    throw new HandledError('Error creating juniorCounselor', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------

/**
 * Method to update a juniorCounselor
 * @param {Object} params - Parameters to update on the juniorCounselor
 * @param {String} params.name - Name of the JC
 * @param {Number} params.year - Year of the JC (1, 2, or 3)
 * @param {String} params._dorm - Dorm assignment of the JC
 * @param {ObjectId} params._associatedSchool - School that the JC attended
 * @param {Array<ObjectId>} params._previousSchools - Any schools that the JC was paired with previously (up to 3)
 * 
 * @returns {JuniorCounselor} juniorCounselor - Updated juniorCounselor object
 */
JuniorCounselor.methods.update = async function({ name, year, _dorm, _associatedSchool, _previousSchools } = {}) {
  try {
    // Validate the update parameters and set if valid
    if (name) {
      if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
      this.name = name;
    }
    if (year) {
      if (typeof year !== 'number' || ![1, 2, 3].includes(year)) { throw new HandledError('Valid year required (1, 2, or 3)', 400); }
      this.year = year;
    }
    if (_dorm) {
      if (typeof _dorm !== 'string') { throw new HandledError('_dorm required as a string', 400); }
      const dorm = await storage.model('Dorm').findById(_dorm);
      if (!dorm) { throw new HandledError('_dorm provided is not valid', 400); }
      this._dorm = _dorm;
    }
    if (_associatedSchool) {
      if (typeof _associatedSchool !== 'string') { throw new HandledError('_associatedSchool required as a string', 400); }
      const associatedSchool = await storage.model('School').findById(_associatedSchool);
      if (!associatedSchool) { throw new HandledError('_associatedSchool provided is not valid', 400); }
      this._associatedSchool = _associatedSchool;
    }
    if (_previousSchools) {
      if (!Array.isArray(_previousSchools)) { throw new HandledError('_previousSchools must be an array', 400); }
      const previousSchools = await storage.model('School').find({ _id: { $in: _previousSchools }});
      if (!previousSchools || previousSchools.length !== _previousSchools.length) { throw new HandledError('school(s) in _previousSchools are not valid', 400)}
      this._previousSchools = previousSchools.map(school => school._id);
    }

   await this.save();
   return this;
  } catch (err) {
   logger.error('Error updating junior counselor', err, { juniorCounselorId: this._id });
   throw new HandledError('Error updating junior counselor', 500);
  }
};

export default storage.model('JuniorCounselor', JuniorCounselor);
