import 'dotenv/config';
import http from 'http';
import { existsSync } from 'fs';
import express from 'express';
import session from 'express-session';
import storage from './storage/index.js';
import routes from './routes/_index.js';
import logger from './util/logger.js';

// Intialize app and define the server port
const app = express();
const PORT = process.env.PORT || 8000;
const isProduction = process.env.NODE_ENV === 'production';

// Railway and other reverse proxies sit in front of the app
app.set('trust proxy', 1);

// Middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  },
}));
// Parse the request
app.use(express.urlencoded({ extended: false }));
// Takes care of JSON data
app.use(express.json());

// Define the rules of the API
app.use((req, res, next) => {
  // Set the CORS policy
  res.header('Access-Control-Allow-Origin', '*');
  // Set the CORS headers
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  // Set the CORS method headers
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, POST, PUT');
    return res.status(200).json({});
  }
  return next();
});

// Load all routes and add to server
await routes.loadRoutes();
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true });
});
app.use('/api', routes.router);

const staticDir = existsSync('build/index.html') ? 'build' : 'public';

// Serve static files from the React build
app.use(express.static(staticDir));

// Catch-all handler for React Router (serve React app for all non-API routes)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile('index.html', { root: staticDir });
});

// Start the server before Mongo so Railway healthchecks can pass quickly
const httpServer = http.createServer(app);
httpServer.listen(PORT, () => {
  logger.info('Server is running', { port: PORT });
});

storage.connect().catch((err) => {
  logger.error('MongoDB connection failed', err);
});
