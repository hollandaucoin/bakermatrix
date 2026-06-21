import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for notes — owned by either a senior counselor or a generic user
const Notes = new storage.schema({
  _seniorCounselor: { type: storage.schema.Types.ObjectId, ref: 'SeniorCounselor', sparse: true, unique: true },
  _user: { type: storage.schema.Types.ObjectId, ref: 'User', sparse: true, unique: true },
  day0: { type: String, default: '' },
  day1: { type: String, default: '' },
  day2: { type: String, default: '' },
  day3: { type: String, default: '' },
  day4: { type: String, default: '' },
  day5: { type: String, default: '' },
}, { timestamps: true });

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create or update notes
 * @param {Object} params - Parameters for the notes
 * @param {String} [params._seniorCounselor] - Senior counselor ID
 * @param {String} [params._user] - User ID
 * @param {String} params.day0 - Notes for day 0
 * @param {String} params.day1 - Notes for day 1
 * @param {String} params.day2 - Notes for day 2
 * @param {String} params.day3 - Notes for day 3
 * @param {String} params.day4 - Notes for day 4
 * @param {String} params.day5 - Notes for day 5
 *
 * @returns {Notes} notes - Notes object
 */
Notes.statics.createOrUpdate = async function({ _seniorCounselor, _user, day0, day1, day2, day3, day4, day5 } = {}) {
  try {
    const hasSeniorCounselor = typeof _seniorCounselor === 'string';
    const hasUser = typeof _user === 'string';

    if (hasSeniorCounselor === hasUser) {
      throw new HandledError('Notes must belong to either a senior counselor or a user', 400);
    }

    let ownerQuery;
    if (hasSeniorCounselor) {
      const seniorCounselor = await storage.model('SeniorCounselor').findById(_seniorCounselor);
      if (!seniorCounselor) { throw new HandledError('seniorCounselor provided is not valid', 400); }
      ownerQuery = { _seniorCounselor };
    } else {
      const user = await storage.model('User').findById(_user);
      if (!user) { throw new HandledError('user provided is not valid', 400); }
      ownerQuery = { _user };
    }

    let notes = await storage.model('Notes').findOne(ownerQuery);

    if (notes) {
      if (day0 !== undefined) notes.day0 = day0;
      if (day1 !== undefined) notes.day1 = day1;
      if (day2 !== undefined) notes.day2 = day2;
      if (day3 !== undefined) notes.day3 = day3;
      if (day4 !== undefined) notes.day4 = day4;
      if (day5 !== undefined) notes.day5 = day5;
      await notes.save();
    } else {
      notes = new storage.model('Notes')({
        ...ownerQuery,
        day0: day0 || '',
        day1: day1 || '',
        day2: day2 || '',
        day3: day3 || '',
        day4: day4 || '',
        day5: day5 || '',
      });
      await notes.save();
    }

    return notes;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating/updating notes: ${err.message}`);
      throw err;
    }
    logger.error('Error creating/updating notes', err);
    throw new HandledError('Error creating/updating notes', 500);
  }
};

export default storage.model('Notes', Notes);
