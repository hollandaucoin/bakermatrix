import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for a SC
const SeniorCounselor = new storage.schema({
  name: { type: String, required: true },
  username: { type: String, unique: true, required: true },
  admin: { type: Boolean, default: false, required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  startingYear: { type: Number, required: true },
  committee: { type: String, enum: ['knowledge', 'compassion', 'humor', 'other'], required: true },
  committeeLead: { type: Boolean, default: false, required: true },
  _jcPairing: { type: storage.schema.Types.ObjectId, ref: 'JuniorCounselor' }, // First JC
  _jcPairing2: { type: storage.schema.Types.ObjectId, ref: 'JuniorCounselor' }, // Second JC
  _associatedSchool: { type: storage.schema.Types.ObjectId, ref: 'School' },
  _previousSchools: { type: [storage.schema.Types.ObjectId], ref: 'School' },
  _previousPostingPartner: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor' },
  federalWay: { type: Boolean, default: false }
});

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a new SC
 * @param {Object} params - Parameters for the SC
 * @param {String} params.name - Name of the SC
 * @param {String} params.username - Username of the SC
 * @param {Boolean} params.admin - Whether the SC is an admin
 * @param {String} params.gender - Gender of the SC
 * @param {Number} params.startingYear - Starting year of the SC
 * @param {String} params.committee - Committee the SC is on
 * @param {Boolean} params.committeeLead - Whether or not the SC is a lead of their commitee
 * @param {ObjectId} params.jcPairing - JC the SC is paired with
 * @param {ObjectId} params.jcPairing2 - Other JC the SC is paired with (optional)
 * @param {ObjectId} params.associatedSchool - School that the SC works at
 * @param {Array<ObjectId>} params.previousSchools - Any schools that the SC was paired with previously (up to 3)
 * @param {ObjectId} params.previousPostingPartner - SC that this SC was paired with for posting previously
 * 
 * @returns {SeniorCounselor} seniorCounselor - New seniorCounselor object
 */
SeniorCounselor.statics.create = async function({ name, username, gender, startingYear, committee, committeeLead, _jcPairing, _jcPairing2, _associatedSchool, _previousSchools, _previousPostingPartner } = {}) {
  try {
    // Validate the parameters
    if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
    if (typeof username !== 'string') { throw new HandledError('Valid username required', 400); }
    if (typeof gender !== 'string') { throw new HandledError('Valid gender required', 400); }
    if (typeof startingYear !== 'number') { throw new HandledError('Valid startingYear required as a number', 400); }
    if (typeof committee !== 'string') { throw new HandledError('Valid committee required (knowledge/compassion)', 400); }
    if (typeof committeeLead !== 'boolean') { throw new HandledError('committeeLead required as a boolean', 400); }
    // Ensure associated IDs passed in are valid
    if (_jcPairing) {
      if (typeof _jcPairing !== 'string') { throw new HandledError('_jcPairing required as a string', 400); }
      const jcPairing = await storage.model('JuniorCounselor').findById(_jcPairing);
      if (!jcPairing) { throw new HandledError('jcPairing provided is not valid', 400); }
    }

    if (_jcPairing2) {
      if (typeof _jcPairing2 !== 'string') { throw new HandledError('_jcPairing2 required as a string', 400); }
      const jcPairing2 = await storage.model('JuniorCounselor').findById(_jcPairing2);
      if (!jcPairing2) { throw new HandledError('jcPairing2 provided is not valid', 400); }
    }

    if (_associatedSchool) {
      if (typeof _associatedSchool !== 'string') { throw new HandledError('_associatedSchool required as a string', 400); }
      const associatedSchool = await storage.model('School').findById(_associatedSchool);
      if (!associatedSchool) { throw new HandledError('associatedSchool provided is not valid', 400); }
    }
    if (_previousSchools) {
      if (!Array.isArray(_previousSchools)) { throw new HandledError('_previousSchools must be an array', 400); }
      const previousSchools = await storage.model('School').find({ _id: { $in: _previousSchools }});
      if (!previousSchools || previousSchools.length !== _previousSchools.length) { throw new HandledError('school(s) in _previousSchools are not valid', 400)}
    }
    // likely needs to be separated into an update endpoint ------------------------------------------------
    if (_previousPostingPartner) {
      if (typeof _previousPostingPartner !== 'string') { throw new HandledError('_previousPostingPartner required as a string', 400); }
      const previousPostingPartner = await storage.model('SeniorCounselor').findById(_previousPostingPartner);
      if (!previousPostingPartner) { throw new HandledError('previousPostingPartner provided is not valid', 400); }
    }

    const seniorCounselor = new storage.model('SeniorCounselor')({ name, username, admin: false, gender, startingYear, committee, committeeLead, _jcPairing, _jcPairing2, _associatedSchool, _previousSchools, _previousPostingPartner });
    await seniorCounselor.save();

    return seniorCounselor;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating seniorCounselor: ${err.message}`);
      throw err;
    }
    logger.error('Error creating seniorCounselor', err);
    throw new HandledError('Error creating seniorCounselor', 500);
  }
};

SeniorCounselor.statics.updateJcs = async function({ updates }) {
  try {
    // Validate all inputs upfront before making any changes
    for (const update of updates) {
      const { seniorCounselorId, _jcPairing, _jcPairing2 } = update;
      
      // Check if senior counselor exists
      const seniorCounselor = await storage.model('SeniorCounselor').findById(seniorCounselorId);
      if (!seniorCounselor) {
        throw new HandledError(`Senior counselor with ID ${seniorCounselorId} not found`, 400);
      }
      
      // Check if JC assignments exist if provided
      if (_jcPairing) {
        const jcPairing = await storage.model('JuniorCounselor').findById(_jcPairing);
        if (!jcPairing) {
          throw new HandledError(`Junior counselor with ID ${_jcPairing} not found`, 400);
        }
      }
      
      if (_jcPairing2) {
        const jcPairing2 = await storage.model('JuniorCounselor').findById(_jcPairing2);
        if (!jcPairing2) {
          throw new HandledError(`Junior counselor with ID ${_jcPairing2} not found`, 400);
        }
      }
    }
    
    // Now update all senior counselors
    const updatedSeniorCounselors = [];
    for (const update of updates) {
      const { seniorCounselorId, _jcPairing, _jcPairing2 } = update;
      
      const seniorCounselor = await storage.model('SeniorCounselor').findById(seniorCounselorId);
      seniorCounselor._jcPairing = _jcPairing || null;
      seniorCounselor._jcPairing2 = _jcPairing2 || null;
      await seniorCounselor.save();
      
      const populatedSeniorCounselor = await storage.model('SeniorCounselor').findById(seniorCounselor._id).populate('_jcPairing _jcPairing2 _associatedSchool _previousSchools _previousPostingPartner');
      updatedSeniorCounselors.push(populatedSeniorCounselor);
    }
  
    return updatedSeniorCounselors;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error updating seniorCounselor JCs: ${err.message}`);
      throw err;
    }
    logger.error('Error updating seniorCounselor JCs', err);
    throw new HandledError('Error updating seniorCounselor JCs', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------

/**
 * Method to update a seniorCounselor
 * @param {Object} params - Parameters to update on the seniorCounselor
 * @param {String} params.name - Name of the SC
 * @param {String} params.username - Username of the SC
 * @param {Boolean} params.admin - Whether the SC is an admin
 * @param {String} params.gender - Gender of the SC
 * @param {Number} params.startingYear - Starting year of the SC
 * @param {String} params.committee - Committee the SC is on
 * @param {Boolean} params.committeeLead - Whether or not the SC is a lead of their commitee
 * @param {ObjectId} params.jcPairing - JC the SC is paired with
 * @param {ObjectId} params.jcPairing2 - Other JC the SC is paired with (optional)
 * @param {ObjectId} params.associatedSchool - School that the SC works at
 * @param {Array<ObjectId>} params.previousSchools - Any schools that the SC was paired with previously (up to 3)
 * @param {ObjectId} params.previousPostingPartner - SC that this SC was paired with for posting previously
 * 
 * @returns {SeniorCounselor} seniorCounselor - Updated seniorCounselor object
 */
SeniorCounselor.methods.update = async function({ name, username, gender, startingYear, committee, committeeLead, _jcPairing, _jcPairing2, _associatedSchool, _previousSchools, _previousPostingPartner, federalWay } = {}) {
  try {
    // Validate the update parameters and set if valid
    if (name) {
      if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
      this.name = name;
    }
    if (username) {
      if (typeof username !== 'string') { throw new HandledError('Valid username required', 400); }
      this.username = username;
    }
    if (gender) {
      if (typeof gender !== 'string') { throw new HandledError('Valid gender required', 400); }
      this.gender = gender;
    }
    if (startingYear) {
      if (typeof startingYear !== 'number') { throw new HandledError('Valid startingYear required as a number', 400); }
      this.startingYear = startingYear;
    }
    if (committee) {
      if (typeof committee !== 'string') { throw new HandledError('Valid committee required (knowledge/compassion)', 400); }
      this.committee = committee;
    }
    if (typeof committeeLead !== 'undefined') {
      if (typeof committeeLead !== 'boolean') { throw new HandledError('committeeLead required as a boolean', 400); }
      this.committeeLead = committeeLead;
    }
    if (_jcPairing) {
      if (typeof _jcPairing !== 'string') { throw new HandledError('_jcPairing required as a string', 400); }
      const jcPairing = await storage.model('JuniorCounselor').findById(_jcPairing);
      if (!jcPairing) { throw new HandledError('_jcPairing provided is not valid', 400); }
      this._jcPairing = jcPairing._id;
    }
    if (_jcPairing2) {
      if (typeof _jcPairing2 !== 'string') { throw new HandledError('_jcPairing2 required as a string', 400); }
      const jcPairing2 = await storage.model('JuniorCounselor').findById(_jcPairing2);
      if (!jcPairing2) { throw new HandledError('_jcPairing2 provided is not valid', 400); }
      this._jcPairing2 = jcPairing2._id;
    }
    if (_associatedSchool) {
      if (typeof _associatedSchool !== 'string') { throw new HandledError('_associatedSchool required as a string', 400); }
      const associatedSchool = await storage.model('School').findById(_associatedSchool);
      if (!associatedSchool) { throw new HandledError('_associatedSchool provided is not valid', 400); }
      this._associatedSchool = associatedSchool._id;
    }
    if (_previousSchools) {
      if (!Array.isArray(_previousSchools)) { throw new HandledError('_previousSchools must be an array', 400); }
      const previousSchools = await storage.model('School').find({ _id: { $in: _previousSchools }});
      if (!previousSchools || previousSchools.length !== _previousSchools.length) { throw new HandledError('school(s) in _previousSchools are not valid', 400)}
      this._previousSchools = previousSchools.map(school => school._id);
    }
    if (_previousPostingPartner) {
      if (typeof _previousPostingPartner !== 'string') { throw new HandledError('_previousPostingPartner required as a string', 400); }
      const previousPostingPartner = await storage.model('SeniorCounselor').findById(_previousPostingPartner);
      if (!previousPostingPartner) { throw new HandledError('_previousPostingPartner provided is not valid', 400); }
      this._previousPostingPartner = previousPostingPartner._id;
    }

    if (typeof federalWay === 'boolean') {
      if (federalWay) {
        await this.save();
        return await this.assignFederalWay();
      }
      return await this.unassignFederalWay();
    }

   await this.save();
   return this;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error updating senior counselor: ${err.message}`);
      throw err;
    }
   logger.error('Error updating senior counselor', err, { seniorCounselorId: this._id });
   throw new HandledError('Error updating senior counselor', 500);
  }
};

SeniorCounselor.methods.unassignFederalWay = async function() {
  this.federalWay = false;
  await this.save();
  return this;
};

SeniorCounselor.methods.assignFederalWay = async function() {
  try {
    const federalWay = await storage.model('School').findOne({ name: 'Federal Way High School' });
    if (!federalWay) { throw new HandledError('Federal Way High School not found', 400); }

    const existingFW = await storage.model('SeniorCounselor').find({ federalWay: true });
    if (existingFW.length > 1) { logger.error('More than 1 senior counselor assigned to federal way', { seniorCounselors: existingFW }); }
    for (const sc of existingFW) {
      sc.federalWay = false;
      await sc.save();
    }

    this.federalWay = true;
    await this.save();
    return this;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error assigning federal way: ${err.message}`);
      throw err;
    }
    logger.error('Error assigning federal way', err);
    throw new HandledError('Error assigning federal way', 500);
  }
}

export default storage.model('SeniorCounselor', SeniorCounselor);