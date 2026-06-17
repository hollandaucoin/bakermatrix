import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

const RollCallStory = new storage.schema({
  _csvFile: { type: storage.schema.Types.ObjectId, ref: 'RollCallCsvFile', required: true },
  story: { type: String, default: '' },
  breakName: { type: String, default: '' },
}, { timestamps: true });

RollCallStory.statics.listForFile = async function(csvFileId) {
  await storage.model('RollCallCsvFile').getById(csvFileId);
  return this.find({ _csvFile: csvFileId }).sort({ createdAt: -1 }).lean();
};

RollCallStory.statics.createStory = async function({ csvFileId, story = '', breakName = '' } = {}) {
  try {
    await storage.model('RollCallCsvFile').getById(csvFileId);

    if (typeof story !== 'string') {
      throw new HandledError('story must be a string', 400);
    }
    if (typeof breakName !== 'string') {
      throw new HandledError('breakName must be a string', 400);
    }

    const record = new this({
      _csvFile: csvFileId,
      story,
      breakName,
    });
    await record.save();
    return record;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating roll call story: ${err.message}`);
      throw err;
    }
    logger.error('Error creating roll call story', err);
    throw new HandledError('Error creating roll call story', 500);
  }
};

RollCallStory.statics.updateStory = async function(id, { story, breakName } = {}) {
  try {
    const record = await this.findById(id);
    if (!record) {
      throw new HandledError('Story not found', 404);
    }

    if (story !== undefined) {
      if (typeof story !== 'string') {
        throw new HandledError('story must be a string', 400);
      }
      record.story = story;
    }

    if (breakName !== undefined) {
      if (typeof breakName !== 'string') {
        throw new HandledError('breakName must be a string', 400);
      }
      record.breakName = breakName;
    }

    await record.save();
    return record;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error updating roll call story: ${err.message}`);
      throw err;
    }
    logger.error('Error updating roll call story', err);
    throw new HandledError('Error updating roll call story', 500);
  }
};

RollCallStory.statics.getById = async function(id) {
  const record = await this.findById(id);
  if (!record) {
    throw new HandledError('Story not found', 404);
  }
  return record;
};

export default storage.model('RollCallStory', RollCallStory);
