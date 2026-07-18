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

// Claude + Skills can take several minutes; Railway/proxies kill long HTTP
// requests. Kick off generation in the background and let the client poll.
const generateJobs = new Map();

const runGenerateJob = async (jobId, { fileId, csv, names }) => {
  const job = generateJobs.get(jobId);
  if (!job) return;

  try {
    const storyText = await generateRollCallStory({ csv, names });
    const story = await storage.model('RollCallStory').createStory({
      csvFileId: fileId,
      story: storyText,
      breakName: deriveBreakName(storyText),
    });

    generateJobs.set(jobId, {
      ...job,
      status: 'done',
      result: {
        story: story.story,
        breakName: story.breakName,
        storyId: story._id,
        csvFileId: fileId,
        names: parseParenthesisLines(story.story),
        updatedAt: story.updatedAt,
        createdAt: story.createdAt,
      },
      finishedAt: Date.now(),
    });
  } catch (err) {
    console.error(`[roll-call] generate job ${jobId} failed:`, err);
    generateJobs.set(jobId, {
      ...job,
      status: 'error',
      error: err.message || 'Failed to generate script',
      finishedAt: Date.now(),
    });
  }

  // Drop finished jobs after 30 minutes so the map doesn't grow forever.
  setTimeout(() => generateJobs.delete(jobId), 30 * 60 * 1000);
};

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

    const jobId = crypto.randomUUID();
    generateJobs.set(jobId, {
      status: 'running',
      fileId: file._id,
      startedAt: Date.now(),
    });

    // Do not await — return immediately so proxies don't time out.
    runGenerateJob(jobId, {
      fileId: file._id,
      csv: req.body?.csv ?? file.csvText,
      names,
    });

    return res.status(202).json({
      jobId,
      status: 'running',
      message: 'Script generation started. This usually takes 1–4 minutes.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to start script generation' });
  }
});

router.get('/stories/generate/:jobId', isSeniorCounselorNonAdmin, (req, res) => {
  const job = generateJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Generation job not found (it may have expired).' });
  }

  if (job.status === 'running') {
    return res.status(200).json({
      jobId: req.params.jobId,
      status: 'running',
      elapsedMs: Date.now() - job.startedAt,
    });
  }

  if (job.status === 'error') {
    return res.status(200).json({
      jobId: req.params.jobId,
      status: 'error',
      error: job.error,
    });
  }

  return res.status(200).json({
    jobId: req.params.jobId,
    status: 'done',
    ...job.result,
  });
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
