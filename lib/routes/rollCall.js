import express from 'express';
import storage from '../storage/index.js';
import { isSeniorCounselorNonAdmin } from './_middleware.js';
import { parseNamesFromCsv } from '../util/rollCall/parseCsv.js';
import { parseParenthesisLines, deriveBreakName } from '../util/rollCall/deckPlan.js';
import { generateRollCallPowerpointBuffer } from '../util/rollCall/pptx.js';
import { generateRollCallStory } from '../util/rollCall/story.js';

const router = express.Router();

const getNamesFromBody = (body) => {
  if (Array.isArray(body?.names)) {
    return body.names.map((name) => String(name).trim()).filter(Boolean);
  }
  if (typeof body?.csv === 'string') {
    return parseNamesFromCsv(body.csv);
  }
  return parseParenthesisLines(body?.text);
};

router.get('/capabilities', isSeniorCounselorNonAdmin, (req, res) => {
  return res.status(200).json({
    claudeStory: Boolean(process.env.ANTHROPIC_API_KEY),
    generateScript: process.env.GENERATE_SCRIPT_ENABLED === 'true',
  });
});

router.get('/files', isSeniorCounselorNonAdmin, async (req, res) => {
  try {
    const files = await storage.model('RollCallCsvFile').listAll();
    return res.status(200).json({ files });
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/files', isSeniorCounselorNonAdmin, async (req, res) => {
  try {
    const { fileName, csvText, sourceNames } = req.body;
    const file = await storage.model('RollCallCsvFile').createFile({
      fileName,
      csvText,
      sourceNames,
    });
    return res.status(201).json(file);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/files/:id', isSeniorCounselorNonAdmin, async (req, res) => {
  try {
    const file = await storage.model('RollCallCsvFile').getById(req.params.id);
    return res.status(200).json(file);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/files/:id/stories', isSeniorCounselorNonAdmin, async (req, res) => {
  try {
    const stories = await storage.model('RollCallStory').listForFile(req.params.id);
    return res.status(200).json({ stories });
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/files/:id/stories/generate', isSeniorCounselorNonAdmin, async (req, res) => {
  try {
    const file = await storage.model('RollCallCsvFile').getById(req.params.id);
    const names = getNamesFromBody({
      names: req.body?.names || file.sourceNames,
      csv: req.body?.csv ?? file.csvText,
    });

    if (names.length === 0) {
      return res.status(400).json({ error: 'No names provided' });
    }

    const storyText = await generateRollCallStory({
      csv: req.body?.csv ?? file.csvText,
      names,
    });

    const story = await storage.model('RollCallStory').createStory({
      csvFileId: file._id,
      story: storyText,
      // Auto-set the deck break to the delegate right before the in-script
      // "ROLL CALL, MT. BAKER 2026" reveal.
      breakName: deriveBreakName(storyText),
    });

    return res.status(201).json({
      story: story.story,
      breakName: story.breakName,
      storyId: story._id,
      csvFileId: file._id,
      names: parseParenthesisLines(story.story),
      updatedAt: story.updatedAt,
      createdAt: story.createdAt,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to generate script' });
  }
});

router.put('/stories/:id', isSeniorCounselorNonAdmin, async (req, res) => {
  try {
    const { story, breakName } = req.body;
    const saved = await storage.model('RollCallStory').updateStory(req.params.id, {
      story,
      breakName,
    });
    return res.status(200).json(saved);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/powerpoint', isSeniorCounselorNonAdmin, async (req, res) => {
  try {
    const names = getNamesFromBody(req.body);
    const breakName = (typeof req.body?.breakName === 'string' && req.body.breakName.trim())
      || deriveBreakName(req.body?.text);
    if (!breakName) {
      return res.status(400).json({ error: 'No break point found. Add a "ROLL CALL, MT. BAKER 2026" line to the script, or choose a break name.' });
    }

    const buffer = await generateRollCallPowerpointBuffer({ names, breakName, text: req.body?.text });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="roll-call.pptx"');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to generate PowerPoint' });
  }
});

export default { router, path: '/roll-call' };
