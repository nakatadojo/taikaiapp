const pool = require('../pool');

const FeedbackQueries = {
  /**
   * Create or update the feedback form for a tournament.
   * Uses INSERT ... ON CONFLICT (tournament_id) DO UPDATE.
   */
  async upsertForm(tournamentId, data) {
    const { rows } = await pool.query(
      `INSERT INTO feedback_forms (tournament_id, questions, recipients, delay_hours, enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tournament_id) DO UPDATE SET
         questions = EXCLUDED.questions,
         recipients = EXCLUDED.recipients,
         delay_hours = EXCLUDED.delay_hours,
         enabled = EXCLUDED.enabled,
         updated_at = NOW()
       RETURNING *`,
      [
        tournamentId,
        JSON.stringify(data.questions || []),
        data.recipients || 'competitors',
        data.delay_hours ?? 24,
        data.enabled ?? false,
      ]
    );
    return rows[0];
  },

  /**
   * Get the feedback form config for a tournament.
   */
  async getForm(tournamentId) {
    const { rows } = await pool.query(
      'SELECT * FROM feedback_forms WHERE tournament_id = $1',
      [tournamentId]
    );
    return rows[0] || null;
  },

  /**
   * Get a feedback form by its own ID (used for public response page).
   */
  async getFormById(formId) {
    const { rows } = await pool.query(
      `SELECT ff.*, t.name AS tournament_name
       FROM feedback_forms ff
       JOIN tournaments t ON t.id = ff.tournament_id
       WHERE ff.id = $1`,
      [formId]
    );
    return rows[0] || null;
  },

  /**
   * Submit a feedback response.
   * On conflict (form_id, user_id) — update answers for logged-in users.
   * Anonymous responses (user_id IS NULL) are always inserted.
   */
  async submitResponse(formId, data) {
    if (data.user_id) {
      // Logged-in user: upsert on (form_id, user_id)
      const { rows } = await pool.query(
        `INSERT INTO feedback_responses (form_id, user_id, respondent_name, respondent_email, answers)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (form_id, user_id) DO UPDATE SET
           answers = EXCLUDED.answers,
           respondent_name = EXCLUDED.respondent_name,
           respondent_email = EXCLUDED.respondent_email
         RETURNING *`,
        [
          formId,
          data.user_id,
          data.respondent_name || null,
          data.respondent_email || null,
          JSON.stringify(data.answers || []),
        ]
      );
      return rows[0];
    }

    // Anonymous submission
    const { rows } = await pool.query(
      `INSERT INTO feedback_responses (form_id, respondent_name, respondent_email, answers)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        formId,
        data.respondent_name || null,
        data.respondent_email || null,
        JSON.stringify(data.answers || []),
      ]
    );
    return rows[0];
  },

  /**
   * Get all responses for a feedback form.
   */
  async getResponses(formId) {
    const { rows } = await pool.query(
      `SELECT fr.*, u.email AS user_email
       FROM feedback_responses fr
       LEFT JOIN users u ON u.id = fr.user_id
       WHERE fr.form_id = $1
       ORDER BY fr.created_at DESC`,
      [formId]
    );
    return rows;
  },

  /**
   * Get aggregated stats: average rating per question, total response count.
   */
  async getAggregatedStats(formId) {
    // Get the form to access questions
    const form = await FeedbackQueries.getFormById(formId);
    if (!form) return null;

    const { rows: responses } = await pool.query(
      'SELECT answers FROM feedback_responses WHERE form_id = $1',
      [formId]
    );

    const totalResponses = responses.length;
    const questions = form.questions || [];

    // Build stats per question
    const questionStats = questions.map(q => {
      const stat = {
        questionId: q.id,
        text: q.text,
        type: q.type,
        totalAnswers: 0,
      };

      if (q.type === 'rating') {
        let sum = 0;
        let count = 0;
        for (const resp of responses) {
          const ans = (resp.answers || []).find(a => a.questionId === q.id);
          if (ans && ans.rating != null) {
            sum += Number(ans.rating);
            count++;
          }
        }
        stat.totalAnswers = count;
        stat.averageRating = count > 0 ? Math.round((sum / count) * 100) / 100 : null;
      } else if (q.type === 'text') {
        const texts = [];
        for (const resp of responses) {
          const ans = (resp.answers || []).find(a => a.questionId === q.id);
          if (ans && ans.text && ans.text.trim()) {
            texts.push(ans.text.trim());
          }
        }
        stat.totalAnswers = texts.length;
        stat.textResponses = texts;
      }

      return stat;
    });

    return {
      formId,
      totalResponses,
      questionStats,
    };
  },

  /**
   * Mark a form as sent (set sent_at timestamp).
   */
  async markSent(formId) {
    const { rows } = await pool.query(
      `UPDATE feedback_forms SET sent_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [formId]
    );
    return rows[0] || null;
  },
};

module.exports = FeedbackQueries;
