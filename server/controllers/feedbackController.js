const pool = require('../db/pool');
const FeedbackQueries = require('../db/queries/feedback');

/**
 * Helper: verify the authenticated user owns the tournament.
 * Returns the tournament row or sends an error response.
 */
async function verifyOwnership(req, res) {
  const tournamentId = req.params.id;
  const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
  if (!t.rows[0]) {
    res.status(404).json({ error: 'Tournament not found' });
    return null;
  }
  if (t.rows[0].created_by !== req.user.id) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  return t.rows[0];
}

// ── CSV Helpers ──────────────────────────────────────────────────────────────

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCSV(headers, rows) {
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map(row => row.map(csvEscape).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

/**
 * PUT /api/tournaments/:id/feedback-form
 * Create or update feedback form configuration.
 */
async function configureForm(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const { questions, recipients, delay_hours, enabled } = req.body;

    // Validate recipients
    const validRecipients = ['competitors', 'parents', 'coaches', 'all'];
    if (recipients && !validRecipients.includes(recipients)) {
      return res.status(400).json({ error: `Invalid recipients. Must be one of: ${validRecipients.join(', ')}` });
    }

    // Validate questions structure
    if (questions && Array.isArray(questions)) {
      for (const q of questions) {
        if (!q.id || !q.text || !q.type) {
          return res.status(400).json({ error: 'Each question must have id, text, and type' });
        }
        if (!['rating', 'text'].includes(q.type)) {
          return res.status(400).json({ error: 'Question type must be "rating" or "text"' });
        }
      }
    }

    const form = await FeedbackQueries.upsertForm(req.params.id, {
      questions,
      recipients,
      delay_hours,
      enabled,
    });

    // TODO: If enabled, schedule feedback email sending after delay_hours.
    // This would integrate with a cron job or background task that checks
    // for forms where enabled=true, sent_at IS NULL, and the tournament
    // end time + delay_hours has passed.

    res.json({ form });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/feedback-form
 * Get feedback form configuration for a tournament.
 */
async function getFormConfig(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const form = await FeedbackQueries.getForm(req.params.id);
    res.json({ form: form || null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/feedback/:formId
 * Get form questions for the public response page (no auth).
 */
async function getPublicForm(req, res, next) {
  try {
    const form = await FeedbackQueries.getFormById(req.params.formId);
    if (!form) {
      return res.status(404).json({ error: 'Feedback form not found' });
    }
    if (!form.enabled) {
      return res.status(404).json({ error: 'This feedback form is not currently active' });
    }

    // Return only the public-facing data
    res.json({
      form: {
        id: form.id,
        tournament_name: form.tournament_name,
        questions: form.questions,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/feedback/:formId/respond
 * Submit a feedback response (no auth — accessed via email link).
 */
async function submitResponse(req, res, next) {
  try {
    const form = await FeedbackQueries.getFormById(req.params.formId);
    if (!form) {
      return res.status(404).json({ error: 'Feedback form not found' });
    }
    if (!form.enabled) {
      return res.status(400).json({ error: 'This feedback form is not currently accepting responses' });
    }

    const { answers, respondent_name, respondent_email } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers array is required' });
    }

    // Validate answers against form questions
    const questionIds = new Set((form.questions || []).map(q => q.id));
    for (const ans of answers) {
      if (!ans.questionId) {
        return res.status(400).json({ error: 'Each answer must have a questionId' });
      }
      if (!questionIds.has(ans.questionId)) {
        return res.status(400).json({ error: `Unknown questionId: ${ans.questionId}` });
      }
      // Validate rating range
      if (ans.rating != null && (ans.rating < 1 || ans.rating > 5)) {
        return res.status(400).json({ error: 'Ratings must be between 1 and 5' });
      }
    }

    // Check required questions
    const requiredIds = (form.questions || [])
      .filter(q => q.required)
      .map(q => q.id);
    for (const reqId of requiredIds) {
      const ans = answers.find(a => a.questionId === reqId);
      const question = form.questions.find(q => q.id === reqId);
      if (!ans) {
        return res.status(400).json({ error: `Missing answer for required question: ${question.text}` });
      }
      if (question.type === 'rating' && ans.rating == null) {
        return res.status(400).json({ error: `Rating required for: ${question.text}` });
      }
      if (question.type === 'text' && (!ans.text || !ans.text.trim())) {
        return res.status(400).json({ error: `Text response required for: ${question.text}` });
      }
    }

    const response = await FeedbackQueries.submitResponse(req.params.formId, {
      user_id: null, // Public endpoint, no auth
      respondent_name,
      respondent_email,
      answers,
    });

    res.status(201).json({ response });
  } catch (err) {
    // Handle unique constraint violation for logged-in users
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already submitted feedback for this form' });
    }
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/feedback-form/responses
 * Get all responses for a tournament's feedback form (auth + event_director).
 */
async function getResponses(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const form = await FeedbackQueries.getForm(req.params.id);
    if (!form) {
      return res.status(404).json({ error: 'No feedback form configured for this tournament' });
    }

    const responses = await FeedbackQueries.getResponses(form.id);
    res.json({ responses });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/feedback-form/stats
 * Get aggregated stats for a tournament's feedback form (auth + event_director).
 */
async function getStats(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const form = await FeedbackQueries.getForm(req.params.id);
    if (!form) {
      return res.status(404).json({ error: 'No feedback form configured for this tournament' });
    }

    const stats = await FeedbackQueries.getAggregatedStats(form.id);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/feedback-form/export.csv
 * Export feedback responses as CSV (auth + event_director).
 */
async function exportResponses(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const form = await FeedbackQueries.getForm(req.params.id);
    if (!form) {
      return res.status(404).json({ error: 'No feedback form configured for this tournament' });
    }

    const responses = await FeedbackQueries.getResponses(form.id);
    const questions = form.questions || [];

    // Build CSV: columns = Respondent Name, Respondent Email, <question texts>, Submitted At
    const headers = ['Respondent Name', 'Respondent Email'];
    for (const q of questions) {
      headers.push(q.text);
    }
    headers.push('Submitted At');

    const rows = responses.map(resp => {
      const row = [
        resp.respondent_name || resp.user_email || '',
        resp.respondent_email || resp.user_email || '',
      ];
      for (const q of questions) {
        const ans = (resp.answers || []).find(a => a.questionId === q.id);
        if (!ans) {
          row.push('');
        } else if (q.type === 'rating') {
          row.push(ans.rating != null ? String(ans.rating) : '');
        } else {
          row.push(ans.text || '');
        }
      }
      row.push(resp.created_at ? new Date(resp.created_at).toISOString() : '');
      return row;
    });

    const csv = buildCSV(headers, rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="feedback-responses.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  configureForm,
  getFormConfig,
  getPublicForm,
  submitResponse,
  getResponses,
  getStats,
  exportResponses,
};
