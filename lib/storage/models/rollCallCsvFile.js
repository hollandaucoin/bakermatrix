import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';
import { parseNamesFromCsv } from '../../util/rollCall/parseCsv.js';

const RollCallCsvFile = new storage.schema({
  fileName: { type: String, required: true },
  csvText: { type: String, default: '' },
  sourceNames: { type: [String], default: [] },
}, { timestamps: true });

RollCallCsvFile.statics.listAll = async function() {
  const files = await this.find().sort({ updatedAt: -1 }).lean();
  const Story = storage.model('RollCallStory');

  return Promise.all(files.map(async (file) => ({
    ...file,
    nameCount: file.sourceNames?.length || 0,
    storyCount: await Story.countDocuments({ _csvFile: file._id }),
  })));
};

RollCallCsvFile.statics.createFile = async function({ fileName, csvText, sourceNames } = {}) {
  try {
    const trimmedName = String(fileName || '').trim();
    if (!trimmedName) {
      throw new HandledError('fileName is required', 400);
    }
    if (typeof csvText !== 'string') {
      throw new HandledError('csvText must be a string', 400);
    }

    let normalizedNames;
    try {
      normalizedNames = parseNamesFromCsv(csvText);
    } catch (err) {
      throw new HandledError(err.message || 'Invalid CSV', 400);
    }

    if (normalizedNames.length === 0) {
      throw new HandledError('No names found in CSV', 400);
    }

    const file = new this({
      fileName: trimmedName,
      csvText,
      sourceNames: normalizedNames,
    });
    await file.save();
    return file;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating roll call CSV file: ${err.message}`);
      throw err;
    }
    logger.error('Error creating roll call CSV file', err);
    throw new HandledError('Error creating roll call CSV file', 500);
  }
};

RollCallCsvFile.statics.getById = async function(id) {
  const file = await this.findById(id);
  if (!file) {
    throw new HandledError('CSV file not found', 404);
  }
  return file;
};

export default storage.model('RollCallCsvFile', RollCallCsvFile);
