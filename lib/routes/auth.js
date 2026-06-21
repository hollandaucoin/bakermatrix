import express from 'express';
import logger from '../util/logger.js';
import storage from '../storage/index.js';
import { resolveSessionUserType } from './_middleware.js';

const router = express.Router();

/**
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    let currentUser;
    if (username && password) {
      const normalizedUsername = username.trim().toLowerCase();
      currentUser = await storage.model('SeniorCounselor').findOne({ username: normalizedUsername });
      if (!currentUser) {
        currentUser = await storage.model('User').findOne({ username: normalizedUsername });
        if (!currentUser) { return res.status(401).json({ error: 'Invalid username or password' }); }
        currentUser.userType = 'user';
      } else {
        currentUser.userType = 'seniorCounselor';
      }

      if (password !== (currentUser.admin ? process.env.ADMIN_PASSWORD : process.env.USER_PASSWORD)) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Set session data
      req.session.userId = currentUser._id;
      req.session.username = currentUser.username;
      req.session.admin = currentUser.admin;
      req.session.userType = currentUser.userType;

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        user: {
          _id: currentUser._id,
          username: currentUser.username,
          admin: Boolean(currentUser.admin),
          userType: currentUser.userType,
        },
      });
    } else {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
  } catch (error) {
    logger.error('Login error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Logout user
 */
router.post('/logout', async (req, res) => {
  try {
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        logger.error('Logout error', { error: err.message });
        return res.status(500).json({
          success: false,
          message: 'Error during logout'
        });
      }
      
      return res.status(200).json({ success: true, message: 'Logout successful' });
    });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Check authentication status
 */
router.get('/status', async (req, res) => {
  try {
    if (req.session.userId) {
      const userType = await resolveSessionUserType(req);

      return res.status(200).json({
        success: true,
        authenticated: true,
        admin: Boolean(req.session.admin),
        user: {
          username: req.session.username,
          admin: Boolean(req.session.admin),
          userType,
        },
      });
    } else {
      return res.status(200).json({ success: true, authenticated: false, admin: false });
    }
  } catch (error) {
    logger.error('Auth status error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default { path: '/auth', router }; 