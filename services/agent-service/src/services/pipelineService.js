/**
 * Orion IDE — Pipeline Service
 *
 * Full 6-step orchestration:
 *   Step 1: Planner   (goal -> plan)
 *   Step 2: Designer  (plan -> file structure)
 *   Step 3: Implementer + Reviewer + FileAgent (per file)
 *   Step 4: RunAgent  (determine execution command)
 *   Step 5: Execute   (run main file)
 */

const { createSession, getSession, updateSession, updateSessionMulti } = require('./sessionService');
const PlannerAgent = require('../agents/plannerAgent');
const DesignerAgent = require('../agents/designerAgent');
const ImplementerAgent = require('../agents/implementerAgent');
const ReviewerAgent = require('../agents/reviewerAgent');
const FileAgent = require('../agents/fileAgent');
const RunAgent = require('../agents/runAgent');
const BaseAgent = require('../agents/baseAgent');
const { pushEvent, streamSession } = require('./sseHub');
const { loadProjectRules, appendRules } = require('./projectRules');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const planner = new PlannerAgent();
const designer = new DesignerAgent();
const implementer = new ImplementerAgent();
const reviewer = new ReviewerAgent();
const fileAgent = new FileAgent();
const runAgent = new RunAgent();

const MAX_REJECTIONS = 2;
const MAX_REVIEW_RETRIES = 2;

const withSessionLlm = async (sessionId, fn) => {
  const session = await getSession(sessionId);
  return BaseAgent.withLlm(session?.llm || {}, fn);
};

const assertNotCancelled = async (sessionId) => {
  const session = await getSession(sessionId);
  if (!session || session.status === 'cancelled') {
    const err = new Error('Pipeline cancelled');
    err.code = 'PIPELINE_CANCELLED';
    throw err;
  }
  return session;
};

/**
 * Start a new pipeline.
 */
const startPipeline = async (userId, goal, options = {}) => {
  const session = await createSession(userId, goal, options);
  const { sessionId } = session;

  pushEvent(sessionId, { type: 'PIPELINE_STARTED', step: 1, agent: 'planner' });

  setImmediate(async () => {
    try {
      await assertNotCancelled(sessionId);
      pushEvent(sessionId, { type: 'AGENT_THINKING', step: 1, agent: 'planner' });
      const sess = await getSession(sessionId);
      const rules = await loadProjectRules(
        sess?.userId,
        sess?.fileAgent?.projectFolderId || options.projectFolderId,
        sess?.googleAccessToken || options.googleAccessToken,
      );
      const plannerOutput = await withSessionLlm(sessionId, () => planner.run(goal, sessionId, null, rules));
      await assertNotCancelled(sessionId);
      await updateSessionMulti(sessionId, {
        'planner.output': plannerOutput,
        'projectName': plannerOutput.projectName,
        'status': 'waiting_approval',
      });
      pushEvent(sessionId, { type: 'AGENT_COMPLETE', step: 1, agent: 'planner', output: plannerOutput });
      pushEvent(sessionId, { type: 'WAITING_APPROVAL', step: 1, agent: 'planner' });
    } catch (err) {
      if (err.code === 'PIPELINE_CANCELLED') {
        pushEvent(sessionId, { type: 'PIPELINE_CANCELLED', step: 1, agent: 'planner' });
        return;
      }
      await updateSession(sessionId, 'status', 'failed');
      pushEvent(sessionId, { type: 'AGENT_ERROR', step: 1, agent: 'planner', error: err.message });
    }
  });

  return { sessionId, session };
};

/**
 * Approve the current step and advance.
 */
const approveStep = async (sessionId, step) => {
  const session = await getSession(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { code: 'PIPELINE_NOT_FOUND' });

  const stepMap = { 1: 'planner', 2: 'designer', 3: 'implementer', 4: 'runAgent', 5: 'execute' };
  const stepName = stepMap[step];
  if (!stepName) throw Object.assign(new Error('Invalid step'), { code: 'PIPELINE_INVALID_STEP' });

  if (step <= 2) {
    await updateSessionMulti(sessionId, {
      [`${stepName}.approved`]: true,
      'currentStep': step + 1,
      'status': 'running',
    });
  }

  pushEvent(sessionId, { type: 'STEP_APPROVED', step, agent: stepName });

  // Dispatch next step
  if (step === 1) {
    runDesigner(sessionId);
  } else if (step === 2) {
    runImplementationLoop(sessionId);
  } else if (step === 3) {
    // Approve current file implementation (from reviewer)
    await approveCurrentFile(sessionId);
  } else if (step === 4) {
    runExecution(sessionId);
  }

  return await getSession(sessionId);
};

/**
 * Reject the current step.
 */
const rejectStep = async (sessionId, step, reason) => {
  const session = await getSession(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { code: 'PIPELINE_NOT_FOUND' });

  const stepMap = { 1: 'planner', 2: 'designer', 3: 'implementer', 4: 'runAgent' };
  const stepName = stepMap[step];
  if (!stepName) throw Object.assign(new Error('Invalid step for rejection'), { code: 'PIPELINE_INVALID_STEP' });

  const rejections = session[stepName]?.rejections || [];
  rejections.push({ reason, timestamp: new Date().toISOString() });

  if (rejections.length >= MAX_REJECTIONS) {
    await updateSessionMulti(sessionId, {
      [`${stepName}.rejections`]: rejections,
      'status': 'manual_override',
    });
    pushEvent(sessionId, { type: 'MAX_REJECTIONS', step, agent: stepName, message: `Max rejections (${MAX_REJECTIONS}) reached.` });
    return await getSession(sessionId);
  }

  await updateSessionMulti(sessionId, {
    [`${stepName}.rejections`]: rejections,
    'status': 'running',
  });
  pushEvent(sessionId, { type: 'STEP_REJECTED', step, agent: stepName, reason, attempt: rejections.length });

  // Re-run agent with feedback
  setImmediate(async () => {
    try {
      pushEvent(sessionId, { type: 'AGENT_THINKING', step, agent: stepName });
      const s = await getSession(sessionId);

      if (step === 1) {
        const output = await withSessionLlm(sessionId, () => planner.run(s.goal, sessionId, reason));
        await updateSessionMulti(sessionId, { 'planner.output': output, 'status': 'waiting_approval', 'projectName': output.projectName });
        pushEvent(sessionId, { type: 'AGENT_COMPLETE', step, agent: stepName, output });
      } else if (step === 2) {
        const output = await withSessionLlm(sessionId, () => designer.run(s.planner.output, sessionId, reason));
        await updateSessionMulti(sessionId, { 'designer.output': output, 'status': 'waiting_approval' });
        pushEvent(sessionId, { type: 'AGENT_COMPLETE', step, agent: stepName, output });
      } else if (step === 3) {
        // Re-implement current file with feedback
        const idx = s.implementer.currentIndex;
        const output = await withSessionLlm(sessionId, () => implementer.runFile(s.designer.output, idx, s.implementer.files, sessionId, reason));
        const files = [...s.implementer.files];
        files[idx] = { path: output.filePath, code: output.code, language: output.language };
        await updateSessionMulti(sessionId, { 'implementer.files': files, 'status': 'waiting_approval' });
        pushEvent(sessionId, { type: 'AGENT_COMPLETE', step: 3, agent: 'implementer', output: { filePath: output.filePath } });
      }

      pushEvent(sessionId, { type: 'WAITING_APPROVAL', step, agent: stepName });
    } catch (err) {
      await updateSession(sessionId, 'status', 'failed');
      pushEvent(sessionId, { type: 'AGENT_ERROR', step, agent: stepName, error: err.message });
    }
  });

  return await getSession(sessionId);
};

// ── Internal pipeline steps ────────────────────────────────────────────

function runDesigner(sessionId) {
  setImmediate(async () => {
    try {
      await assertNotCancelled(sessionId);
      pushEvent(sessionId, { type: 'AGENT_THINKING', step: 2, agent: 'designer' });
      const s = await getSession(sessionId);
      const output = await withSessionLlm(sessionId, () => designer.run(s.planner.output, sessionId));
      await assertNotCancelled(sessionId);
      await updateSessionMulti(sessionId, { 'designer.output': output, 'status': 'waiting_approval' });
      pushEvent(sessionId, { type: 'AGENT_COMPLETE', step: 2, agent: 'designer', output });
      pushEvent(sessionId, { type: 'WAITING_APPROVAL', step: 2, agent: 'designer' });
    } catch (err) {
      if (err.code === 'PIPELINE_CANCELLED') {
        pushEvent(sessionId, { type: 'PIPELINE_CANCELLED', step: 2, agent: 'designer' });
        return;
      }
      await updateSession(sessionId, 'status', 'failed');
      pushEvent(sessionId, { type: 'AGENT_ERROR', step: 2, agent: 'designer', error: err.message });
    }
  });
}

async function runImplementationLoop(sessionId) {
  await assertNotCancelled(sessionId);
  const s = await getSession(sessionId);
  const designerOutput = s.designer.output;
  const totalFiles = designerOutput.files.length;

  // Create (or reuse) the Drive project folder before writing any files
  try {
    if (!s.fileAgent?.projectFolderId) {
      const folderId = await fileAgent.ensureProjectFolder(
        s.userId,
        s.projectName || designerOutput.projectName || 'Orion Project',
        s.googleAccessToken
      );
      await updateSession(sessionId, 'fileAgent.projectFolderId', folderId);
      pushEvent(sessionId, { type: 'PROJECT_FOLDER_READY', projectFolderId: folderId });
    }
  } catch (err) {
    await updateSession(sessionId, 'status', 'failed');
    pushEvent(sessionId, {
      type: 'AGENT_ERROR',
      step: 3,
      agent: 'fileAgent',
      error: err.message,
    });
    return;
  }

  await updateSessionMulti(sessionId, {
    'currentStep': 3,
    'implementer.totalFiles': totalFiles,
    'implementer.currentIndex': 0,
    'status': 'running',
  });

  pushEvent(sessionId, { type: 'IMPLEMENTATION_STARTED', totalFiles });

  implementNextFile(sessionId);
}

async function implementNextFile(sessionId) {
  const s = await getSession(sessionId);
  const idx = s.implementer.currentIndex;
  const designerOutput = s.designer.output;
  const totalFiles = designerOutput.files.length;

  if (idx >= totalFiles) {
    // All files implemented -> move to RunAgent
    await updateSessionMulti(sessionId, { 'currentStep': 4, 'status': 'running' });
    pushEvent(sessionId, { type: 'ALL_FILES_COMPLETE', filesCompleted: totalFiles });
    runRunAgent(sessionId);
    return;
  }

  pushEvent(sessionId, {
    type: 'FILE_PROGRESS',
    currentFile: idx + 1,
    totalFiles,
    filePath: designerOutput.files[idx].path,
  });

  setImmediate(async () => {
    try {
      // Step 3a: Implement
      pushEvent(sessionId, { type: 'AGENT_THINKING', step: 3, agent: 'implementer', file: designerOutput.files[idx].path });
      const previousFiles = s.implementer.files || [];
      const implResult = await withSessionLlm(sessionId, () => implementer.runFile(designerOutput, idx, previousFiles, sessionId));

      const files = [...(s.implementer.files || [])];
      files[idx] = { path: implResult.filePath, code: implResult.code, language: implResult.language };

      await updateSessionMulti(sessionId, { 'implementer.files': files });
      pushEvent(sessionId, { type: 'AGENT_COMPLETE', step: 3, agent: 'implementer', output: { filePath: implResult.filePath } });

      // Step 3b: Review
      pushEvent(sessionId, { type: 'AGENT_THINKING', step: 3, agent: 'reviewer', file: implResult.filePath });
      let reviewResult = await withSessionLlm(sessionId, () => reviewer.review(
        implResult.filePath, implResult.code, implResult.language,
        designerOutput.files[idx].purpose, sessionId,
      ));

      let retries = 0;
      while (!reviewResult.approved && retries < MAX_REVIEW_RETRIES) {
        retries++;
        pushEvent(sessionId, {
          type: 'REVIEW_RETRY',
          file: implResult.filePath,
          attempt: retries,
          score: reviewResult.score,
          issues: reviewResult.issues.length,
        });

        // Re-implement with review feedback
        const feedback = reviewResult.issues.map((i) => `${i.severity}: ${i.description}`).join('; ');
        const reImpl = await withSessionLlm(sessionId, () => implementer.runFile(designerOutput, idx, previousFiles, sessionId, feedback));
        files[idx] = { path: reImpl.filePath, code: reImpl.code, language: reImpl.language };
        await updateSessionMulti(sessionId, { 'implementer.files': files });

        // Re-review
        reviewResult = await withSessionLlm(sessionId, () => reviewer.review(
          reImpl.filePath, reImpl.code, reImpl.language,
          designerOutput.files[idx].purpose, sessionId,
        ));
      }

      // Store review
      const updatedSession = await getSession(sessionId);
      const reviews = [...(updatedSession.reviewer.reviews || [])];
      reviews.push({ filePath: implResult.filePath, ...reviewResult });
      await updateSession(sessionId, 'reviewer.reviews', reviews);

      pushEvent(sessionId, {
        type: 'REVIEW_COMPLETE',
        file: implResult.filePath,
        approved: reviewResult.approved,
        score: reviewResult.score,
      });

      if (!reviewResult.approved) {
        pushEvent(sessionId, {
          type: 'FILE_WRITE_SKIPPED',
          file: implResult.filePath,
          reason: 'review_rejected',
          score: reviewResult.score,
        });
        await updateSession(sessionId, 'implementer.currentIndex', idx + 1);
        implementNextFile(sessionId);
        return;
      }

      // Step 3c: Write to Google Drive (only after review approval)
      pushEvent(sessionId, { type: 'AGENT_THINKING', step: 3, agent: 'fileAgent', file: implResult.filePath });
      const currentSession = await getSession(sessionId);
      const writeResult = await fileAgent.writeFile(
        currentSession.userId,
        implResult.filePath,
        files[idx].code,
        sessionId,
        currentSession.fileAgent.projectFolderId,
        currentSession.googleAccessToken,
      );

      if (!writeResult.success) {
        await updateSession(sessionId, 'status', 'failed');
        pushEvent(sessionId, {
          type: 'AGENT_ERROR',
          step: 3,
          agent: 'fileAgent',
          error: writeResult.error || `Failed to write ${implResult.filePath} to Drive`,
        });
        return;
      }

      const written = [...(currentSession.fileAgent.written || [])];
      written.push({ filePath: implResult.filePath, fileId: writeResult.fileId });
      await updateSession(sessionId, 'fileAgent.written', written);

      pushEvent(sessionId, {
        type: 'FILE_WRITTEN',
        file: implResult.filePath,
        fileId: writeResult.fileId,
        success: true,
        currentFile: idx + 1,
        totalFiles,
      });

      // Move to next file
      await updateSession(sessionId, 'implementer.currentIndex', idx + 1);
      implementNextFile(sessionId);
    } catch (err) {
      await updateSession(sessionId, 'status', 'failed');
      pushEvent(sessionId, { type: 'AGENT_ERROR', step: 3, agent: 'implementer', error: err.message });
    }
  });
}

async function approveCurrentFile(sessionId) {
  // When user manually approves a file during implementation
  const s = await getSession(sessionId);
  await updateSession(sessionId, 'implementer.currentIndex', s.implementer.currentIndex + 1);
  await updateSession(sessionId, 'status', 'running');
  implementNextFile(sessionId);
}

function runRunAgent(sessionId) {
  setImmediate(async () => {
    try {
      pushEvent(sessionId, { type: 'AGENT_THINKING', step: 4, agent: 'runAgent' });
      const s = await getSession(sessionId);
      const runConfig = await withSessionLlm(sessionId, () => runAgent.determineCommand(
        s.goal, s.designer.output, s.implementer.files, sessionId,
      ));
      await updateSessionMulti(sessionId, {
        'runAgent.command': runConfig,
        'status': 'waiting_approval',
      });
      pushEvent(sessionId, { type: 'AGENT_COMPLETE', step: 4, agent: 'runAgent', output: runConfig });
      pushEvent(sessionId, { type: 'WAITING_APPROVAL', step: 4, agent: 'runAgent' });
    } catch (err) {
      await updateSession(sessionId, 'status', 'failed');
      pushEvent(sessionId, { type: 'AGENT_ERROR', step: 4, agent: 'runAgent', error: err.message });
    }
  });
}

function runExecution(sessionId) {
  setImmediate(async () => {
    try {
      await assertNotCancelled(sessionId);
      pushEvent(sessionId, { type: 'AGENT_THINKING', step: 5, agent: 'execute' });
      const s = await getSession(sessionId);
      const runConfig = s.runAgent.command;
      const wanted = String(runConfig.mainFile || '').replace(/\\/g, '/');
      const mainFile = (s.implementer?.files || []).find((f) => {
        const p = String(f.path || '').replace(/\\/g, '/');
        return p === wanted || p.endsWith(`/${wanted}`) || p.split('/').pop() === wanted.split('/').pop();
      });
      const code = mainFile?.code || '';
      if (!code) {
        throw new Error(`No code found for main file "${wanted}"`);
      }

      const result = await runAgent.execute(s.userId, runConfig, code, sessionId);

      const executionNotFinished =
        !result
        || result.status === 'timeout'
        || result.exitCode === undefined
        || result.exitCode === null;

      if (executionNotFinished) {
        await updateSessionMulti(sessionId, {
          'runAgent.result': result,
          'currentStep': 6,
          'status': 'failed',
        });
        pushEvent(sessionId, {
          type: 'PIPELINE_COMPLETE',
          executionResult: result,
          error: 'Execution did not finish within polling window',
          totalFiles: s.implementer.files.length,
          projectName: s.projectName,
        });
        return;
      }

      await updateSessionMulti(sessionId, {
        'runAgent.result': result,
        'currentStep': 6,
        'status': 'completed',
      });

      pushEvent(sessionId, {
        type: 'PIPELINE_COMPLETE',
        executionResult: result,
        totalFiles: s.implementer.files.length,
        projectName: s.projectName,
      });
    } catch (err) {
      if (err.code === 'PIPELINE_CANCELLED') {
        pushEvent(sessionId, { type: 'PIPELINE_CANCELLED', step: 5, agent: 'execute' });
        return;
      }
      await updateSessionMulti(sessionId, {
        'status': 'failed',
        'currentStep': 6,
        'runAgent.result': { error: err.message },
      });
      pushEvent(sessionId, { type: 'PIPELINE_FAILED', error: err.message });
    }
  });
}

/**
 * Cancel a running / waiting pipeline. In-flight LLM steps check status and bail.
 */
const cancelPipeline = async (sessionId) => {
  const session = await getSession(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { code: 'PIPELINE_NOT_FOUND', status: 404 });
  if (['completed', 'complete', 'cancelled', 'failed', 'rejected'].includes(session.status)) {
    return session;
  }
  const updated = await updateSessionMulti(sessionId, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  });
  pushEvent(sessionId, { type: 'PIPELINE_CANCELLED', step: session.currentStep, agent: 'pipeline' });
  return updated;
};

/**
 * Stream SSE events to a response.
 */
const streamSessionExport = streamSession;

module.exports = { startPipeline, approveStep, rejectStep, cancelPipeline, streamSession: streamSessionExport };
