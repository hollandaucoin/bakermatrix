import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';

// Schema for a user (not a senior counselor but needs access to the system)
const User = new storage.schema({
  username: { type: String, unique: true, required: true },
  admin: { type: Boolean, default: false, required: true },
});

export default storage.model('User', User);