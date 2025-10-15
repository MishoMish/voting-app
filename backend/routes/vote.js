import express from 'express';
import { getDatabase, runTransaction } from '../db.js';
import { requireAuth, getUserId, getUsername } from '../utils/sessionUtils.js';

const router = express.Router();

/**
 * GET /api/current-vote
 * Get the current active vote
 */
router.get('/current-vote', (req, res) => {
  try {
    const db = getDatabase();
    const vote = db.prepare('SELECT * FROM votes WHERE active = 1 ORDER BY created_at DESC LIMIT 1').get();
    
    if (!vote) {
      return res.json({ vote: null });
    }
    
    // Parse options from JSON
    const voteData = {
      ...vote,
      options: JSON.parse(vote.options_json)
    };
    delete voteData.options_json;
    
    res.json({ vote: voteData });
    
  } catch (error) {
    console.error('Error fetching current vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/submit-vote
 * Submit user's vote choices
 */
router.post('/submit-vote', requireAuth, (req, res) => {
  try {
    const { choices } = req.body;
    const userId = getUserId(req);
    const username = getUsername(req);
    
    if (!choices || !Array.isArray(choices)) {
      return res.status(400).json({ error: 'Valid choices array is required' });
    }
    
    const db = getDatabase();
    
    // Get current active vote
    const vote = db.prepare('SELECT * FROM votes WHERE active = 1 ORDER BY created_at DESC LIMIT 1').get();
    
    if (!vote) {
      return res.status(400).json({ error: 'No active vote found' });
    }
    
    // Check if user already voted
    const existingSubmission = db.prepare('SELECT * FROM submissions WHERE user_id = ? AND vote_id = ?').get(userId, vote.id);
    
    if (existingSubmission) {
      return res.status(400).json({ error: 'You have already voted' });
    }
    
    // Validate choices
    const voteOptions = JSON.parse(vote.options_json);
    
    if (choices.length > vote.max_selections) {
      return res.status(400).json({ error: `Maximum ${vote.max_selections} selections allowed` });
    }
    
    // Validate that all choices are valid options
    const invalidChoices = choices.filter(choice => !voteOptions.includes(choice));
    if (invalidChoices.length > 0) {
      return res.status(400).json({ error: 'Invalid vote options selected' });
    }
    
    // Submit vote in transaction
    const result = runTransaction((database) => {
      // Always use the actual user_id - the anonymity is handled in the vote settings
      // not in the database structure
      const submissionResult = database.prepare(`
        INSERT INTO submissions (user_id, vote_id, choices_json)
        VALUES (?, ?, ?)
      `).run(userId, vote.id, JSON.stringify(choices));
      
      // Mark user as voted
      database.prepare('UPDATE users SET voted = 1 WHERE id = ?').run(userId);
      
      return submissionResult;
    });
    
    // Get voting progress for admin panel
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const votedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE voted = 1').get().count;
    
    // Emit socket event for admin panel
    req.app.get('io').emit('vote_submitted', { 
      username,
      totalVoted: votedUsers,
      totalUsers: totalUsers
    });
    
    res.json({ 
      success: true, 
      message: 'Vote submitted successfully',
      submissionId: result.lastInsertRowid
    });
    
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user-vote-status
 * Check if current user has voted
 */
router.get('/user-vote-status', requireAuth, (req, res) => {
  try {
    const userId = getUserId(req);
    const db = getDatabase();
    
    // Get current active vote
    const vote = db.prepare('SELECT * FROM votes WHERE active = 1 ORDER BY created_at DESC LIMIT 1').get();
    
    if (!vote) {
      return res.json({ hasVoted: false, voteExists: false });
    }
    
    // Check if user has submitted for current vote
    const submission = db.prepare('SELECT * FROM submissions WHERE user_id = ? AND vote_id = ?').get(userId, vote.id);
    
    res.json({ 
      hasVoted: !!submission, 
      voteExists: true,
      voteId: vote.id,
      submission: submission ? JSON.parse(submission.choices_json) : null
    });
    
  } catch (error) {
    console.error('Error checking vote status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
