import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for a workshop
const Workshop = new storage.schema({
  name: { type: String, required: true },
  leaders: [{
    account: {
      type: storage.schema.Types.ObjectId,
      required: true,
      refPath: 'leaders.accountModel',
    },
    accountModel: {
      type: String,
      required: true,
      enum: ['SeniorCounselor', 'User'],
    },
  }],
  // Legacy fields retained so existing workshop records keep working.
  _seniorCounselor: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor' },
  _seniorCounselor2: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor', default: null },
});

const validateLeaders = async (leaders) => {
  if (!Array.isArray(leaders) || leaders.length < 1 || leaders.length > 2) {
    throw new HandledError('Workshops require one or two leaders', 400);
  }

  const normalized = [];
  const seen = new Set();
  for (const leader of leaders) {
    const account = typeof leader?.account === 'string' ? leader.account : '';
    const accountModel = leader?.accountModel;
    if (!account || !['SeniorCounselor', 'User'].includes(accountModel)) {
      throw new HandledError('Each workshop leader must be a valid account', 400);
    }
    const key = `${accountModel}:${account}`;
    if (seen.has(key)) {
      throw new HandledError('The two workshop leaders must be different', 400);
    }
    const existing = await storage.model(accountModel).findById(account);
    if (!existing) {
      throw new HandledError('Workshop leader account was not found', 400);
    }
    seen.add(key);
    normalized.push({ account: existing._id, accountModel });
  }
  return normalized;
};

const legacyLeaders = (_seniorCounselor, _seniorCounselor2) => [
  _seniorCounselor && { account: _seniorCounselor, accountModel: 'SeniorCounselor' },
  _seniorCounselor2 && { account: _seniorCounselor2, accountModel: 'SeniorCounselor' },
].filter(Boolean);

const applyLeaders = (workshop, leaders) => {
  workshop.leaders = leaders;
  const seniorCounselors = leaders
    .filter((leader) => leader.accountModel === 'SeniorCounselor')
    .map((leader) => leader.account);
  workshop._seniorCounselor = seniorCounselors[0] || null;
  workshop._seniorCounselor2 = seniorCounselors[1] || null;
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
Workshop.statics.create = async function({
  name,
  leaders,
  _seniorCounselor,
  _seniorCounselor2,
} = {}) {
  try {
    // Validate the parameters
    if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
    const normalizedLeaders = await validateLeaders(
      leaders || legacyLeaders(_seniorCounselor, _seniorCounselor2)
    );
    const workshop = new storage.model('Workshop')({ name });
    applyLeaders(workshop, normalizedLeaders);
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
Workshop.methods.update = async function({
  name,
  leaders,
  _seniorCounselor,
  _seniorCounselor2,
} = {}) {
  try {
    // Validate the update parameters and set if valid
    if (name) {
      if (typeof name !== 'string') { throw new HandledError('Valid name required', 400); }
      this.name = name;
    } 
    if (leaders) {
      applyLeaders(this, await validateLeaders(leaders));
    } else if (_seniorCounselor) {
      applyLeaders(
        this,
        await validateLeaders(legacyLeaders(_seniorCounselor, _seniorCounselor2))
      );
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