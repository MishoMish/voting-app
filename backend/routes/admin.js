import express from 'express';
import bcrypt from 'bcrypt';
import { getDatabase, runTransaction } from '../db.js';
import { requireAdmin, destroyUserSession } from '../utils/sessionUtils.js';

const router = express.Router();

/**
 * POST /api/admin/start-vote
 * Create and start a new vote
 */
router.post('/start-vote', requireAdmin, (req, res) => {
  try {
    const { title, description, options, maxSelections, anonymous } = req.body;
    
    if (!title || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'Title and at least 2 options are required' });
    }
    
    if (!maxSelections || maxSelections < 1 || maxSelections > options.length) {
      return res.status(400).json({ error: 'Invalid maxSelections value' });
    }
    
    const result = runTransaction((db) => {
      // First try to add anonymous column if it doesn't exist
      try {
        db.prepare('SELECT anonymous FROM votes LIMIT 1').get();
      } catch (error) {
        if (error.code === 'SQLITE_ERROR') {
          console.log('Adding anonymous column to votes table...');
          db.exec('ALTER TABLE votes ADD COLUMN anonymous BOOLEAN DEFAULT 0');
        }
      }
      
      // End any existing active votes
      db.prepare('UPDATE votes SET active = 0, ended_at = CURRENT_TIMESTAMP WHERE active = 1').run();
      
      // Reset all users' voted status for new vote
      db.prepare('UPDATE users SET voted = 0').run();
      
      // Create new vote
      const voteResult = db.prepare(`
        INSERT INTO votes (title, description, options_json, max_selections, anonymous, active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(title, description || '', JSON.stringify(options), maxSelections, anonymous ? 1 : 0);
      
      return voteResult;
    });
    
    // Get the created vote
    const db = getDatabase();
    const vote = db.prepare('SELECT * FROM votes WHERE id = ?').get(result.lastInsertRowid);
    const voteData = {
      ...vote,
      options: JSON.parse(vote.options_json)
    };
    delete voteData.options_json;
    
    // Emit socket event to all clients
    req.app.get('io').emit('vote_started', voteData);
    
    res.json({ success: true, vote: voteData, message: 'Vote started successfully' });
    
  } catch (error) {
    console.error('Error starting vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/end-vote
 * End the current active vote
 */
router.post('/end-vote', requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    
    const result = db.prepare(`
      UPDATE votes SET active = 0, ended_at = CURRENT_TIMESTAMP 
      WHERE active = 1
    `).run();
    
    if (result.changes === 0) {
      return res.status(400).json({ error: 'No active vote to end' });
    }
    
    // Emit socket event to all clients
    req.app.get('io').emit('vote_ended', {});
    
    res.json({ success: true, message: 'Vote ended successfully' });
    
  } catch (error) {
    console.error('Error ending vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/users
 * Get list of all users with their status
 */
router.get('/users', requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    const users = db.prepare(`
      SELECT id, username, logged_in, voted, created_at
      FROM users
      ORDER BY username
    `).all();
    
    res.json({ users });
    
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/logout-user
 * Force logout a specific user
 */
router.post('/logout-user', requireAdmin, (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Mark user as logged out
    db.prepare('UPDATE users SET logged_in = 0 WHERE id = ?').run(userId);
    
    // Emit socket event to force logout the specific user
    req.app.get('io').emit('force_logout', { userId: userId, username: user.username });
    
    res.json({ success: true, message: `User ${user.username} logged out successfully` });
    
  } catch (error) {
    console.error('Error logging out user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/all-votes
 * Get all historical votes
 */
router.get('/all-votes', requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    
    const votes = db.prepare(`
      SELECT 
        v.id,
        v.title,
        v.description,
        v.created_at,
        v.ended_at,
        v.anonymous,
        v.active as status,
        COUNT(s.id) as total_submissions
      FROM votes v
      LEFT JOIN submissions s ON v.id = s.vote_id
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `).all();

    res.json(votes);
  } catch (error) {
    console.error('Error fetching all votes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/vote-details/:id
 * Get detailed results for a specific vote
 */
router.get('/vote-details/:id', requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    const voteId = parseInt(req.params.id);
    
    if (!voteId) {
      return res.status(400).json({ error: 'Invalid vote ID' });
    }

    // Get vote info
    const vote = db.prepare(`
      SELECT id, title, description, created_at, ended_at, anonymous, active as status
      FROM votes 
      WHERE id = ?
    `).get(voteId);

    if (!vote) {
      return res.status(404).json({ error: 'Vote not found' });
    }

    // Get options from vote
    const options = JSON.parse(vote.options_json || '[]');

    // Get results by counting choices in submissions
    const submissions = db.prepare(`
      SELECT choices_json FROM submissions WHERE vote_id = ?
    `).all(voteId);

    // Count votes for each option
    const results = {};
    options.forEach(option => {
      results[option] = 0;
    });

    submissions.forEach(submission => {
      const choices = JSON.parse(submission.choices_json);
      choices.forEach(choice => {
        if (results.hasOwnProperty(choice)) {
          results[choice]++;
        }
      });
    });

    // Convert to array format
    const resultsArray = options.map(option => ({
      name: option,
      vote_count: results[option]
    })).sort((a, b) => b.vote_count - a.vote_count);

    // Get voter details if not anonymous
    let voterDetails = [];
    if (!vote.anonymous) {
      const voterSubmissions = db.prepare(`
        SELECT 
          u.username,
          s.choices_json,
          s.submitted_at
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        WHERE s.vote_id = ?
        ORDER BY s.submitted_at DESC
      `).all(voteId);
      
      voterDetails = voterSubmissions.map(submission => ({
        username: submission.username,
        voted_for: JSON.parse(submission.choices_json).join(', '),
        timestamp: submission.submitted_at
      }));
    }

    // Get total participation
    const totalVoters = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as total
      FROM submissions 
      WHERE vote_id = ?
    `).get(voteId);

    res.json({
      vote,
      options,
      results: resultsArray,
      voterDetails,
      totalParticipation: totalVoters.total || 0
    });
  } catch (error) {
    console.error('Error fetching vote details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/add-user
 * Add new user
 */
router.post('/add-user', requireAdmin, async (req, res) => {
  try {
    const { username, password, role = 'user' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const db = getDatabase();
    
    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // First try to add role column if it doesn't exist
    try {
      db.prepare('SELECT role FROM users LIMIT 1').get();
    } catch (error) {
      if (error.code === 'SQLITE_ERROR') {
        console.log('Adding role column to users table...');
        db.exec('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"');
      }
    }
    
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, role, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(username, hashedPassword, role);

    res.json({ 
      success: true, 
      userId: result.lastInsertRowid,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/delete-user/:id
 * Delete user
 */
router.delete('/delete-user/:id', requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    const userId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user exists
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user and handle related data
    try {
      // First, delete all submissions by this user
      // Note: This will remove their voting history completely
      const submissionsDeleted = db.prepare('DELETE FROM submissions WHERE user_id = ?').run(userId);
      console.log(`Deleted ${submissionsDeleted.changes} submissions for user ${userId}`);
      
      // Note: We can't destroy their session from here as we don't have access to their session
      // The session will expire naturally or be invalidated when they try to access protected routes
      
      // Now delete the user
      const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ 
        success: true,
        message: `User "${user.username}" deleted successfully (${submissionsDeleted.changes} vote records removed)`
      });
    } catch (deleteError) {
      console.error('Error in delete operation:', deleteError);
      throw deleteError;
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/results
 * Get current vote results
 */
router.get('/results', requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    
    // Get current or most recent vote
    const vote = db.prepare(`
      SELECT * FROM votes 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get();
    
    if (!vote) {
      return res.json({ results: null, message: 'No votes found' });
    }
    
    // Get all submissions for this vote
    const submissions = db.prepare(`
      SELECT s.choices_json, u.username
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.vote_id = ?
    `).all(vote.id);
    
    // Process results with detailed voter information
    const options = JSON.parse(vote.options_json);
    const results = {};
    const detailedResults = {};
    
    // Initialize all options with 0 votes and empty voter lists
    options.forEach(option => {
      results[option] = 0;
      detailedResults[option] = {
        count: 0,
        voters: []
      };
    });
    
    // Count votes and collect voter information
    submissions.forEach(submission => {
      const choices = JSON.parse(submission.choices_json);
      choices.forEach(choice => {
        if (results.hasOwnProperty(choice)) {
          results[choice]++;
          detailedResults[choice].count++;
          
          // Add voter name only if vote is not anonymous
          if (!vote.anonymous) {
            detailedResults[choice].voters.push(submission.username);
          }
        }
      });
    });
    
    // Sort voter names alphabetically for each option
    if (!vote.anonymous) {
      Object.keys(detailedResults).forEach(option => {
        detailedResults[option].voters.sort();
      });
    }
    
    // Get total stats
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalVoted = submissions.length;
    
    res.json({
      vote: {
        ...vote,
        options: options
      },
      results,
      detailedResults,
      stats: {
        totalUsers,
        totalVoted,
        participationRate: totalUsers > 0 ? (totalVoted / totalUsers * 100).toFixed(1) : 0
      },
      submissions: submissions.map(s => ({
        username: s.username,
        choices: JSON.parse(s.choices_json)
      }))
    });
    
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/export
 * Export results as JSON or CSV
 */
router.get('/export', requireAdmin, (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const db = getDatabase();
    
    // Get current or most recent vote
    const vote = db.prepare(`
      SELECT * FROM votes 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get();
    
    if (!vote) {
      return res.status(404).json({ error: 'No votes found' });
    }
    
    // Get detailed results
    const submissions = db.prepare(`
      SELECT s.choices_json, s.submitted_at, u.username
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.vote_id = ?
      ORDER BY s.submitted_at
    `).all(vote.id);
    
    const options = JSON.parse(vote.options_json);
    const results = {};
    options.forEach(option => { results[option] = 0; });
    
    submissions.forEach(submission => {
      const choices = JSON.parse(submission.choices_json);
      choices.forEach(choice => {
        if (results.hasOwnProperty(choice)) {
          results[choice]++;
        }
      });
    });
    
    const exportData = {
      vote: {
        id: vote.id,
        title: vote.title,
        description: vote.description,
        options: options,
        maxSelections: vote.max_selections,
        createdAt: vote.created_at,
        endedAt: vote.ended_at
      },
      results,
      submissions: submissions.map(s => ({
        username: s.username,
        choices: JSON.parse(s.choices_json),
        submittedAt: s.submitted_at
      })),
      exportedAt: new Date().toISOString()
    };
    
    if (format === 'csv') {
      // Generate CSV
      let csv = 'Username,Choices,Submitted At\\n';
      submissions.forEach(s => {
        const choices = JSON.parse(s.choices_json).join('; ');
        csv += `"${s.username}","${choices}","${s.submitted_at}"\\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="vote-results-${vote.id}.csv"`);
      res.send(csv);
    } else {
      // Return JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="vote-results-${vote.id}.json"`);
      res.json(exportData);
    }
    
  } catch (error) {
    console.error('Error exporting results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/all-votes
 * Get all votes (including historical ones)
 */
router.get('/all-votes', requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    
    const votes = db.prepare(`
      SELECT v.*, 
             COUNT(DISTINCT s.id) as total_submissions
      FROM votes v
      LEFT JOIN submissions s ON v.id = s.vote_id
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `).all();
    
    // Add parsed options and format data
    const formattedVotes = votes.map(vote => ({
      ...vote,
      options: JSON.parse(vote.options_json),
      active: !!vote.active,
      anonymous: !!vote.anonymous
    }));
    
    res.json({ votes: formattedVotes });
    
  } catch (error) {
    console.error('Error fetching all votes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/vote-details/:id
 * Get detailed results for a specific vote
 */
router.get('/vote-details/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const vote = db.prepare('SELECT * FROM votes WHERE id = ?').get(id);
    
    if (!vote) {
      return res.status(404).json({ error: 'Vote not found' });
    }
    
    // Get submissions for this vote
    const submissions = db.prepare(`
      SELECT s.choices_json, s.submitted_at, u.username
      FROM submissions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.vote_id = ?
      ORDER BY s.submitted_at
    `).all(id);
    
    // Process results
    const options = JSON.parse(vote.options_json);
    const results = {};
    options.forEach(option => { results[option] = 0; });
    
    submissions.forEach(submission => {
      const choices = JSON.parse(submission.choices_json);
      choices.forEach(choice => {
        if (results.hasOwnProperty(choice)) {
          results[choice]++;
        }
      });
    });
    
    // Format response based on anonymous flag
    const formattedSubmissions = submissions.map(s => ({
      choices: JSON.parse(s.choices_json),
      submittedAt: s.submitted_at,
      username: vote.anonymous ? 'Anonymous' : s.username
    }));
    
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    
    res.json({
      vote: {
        ...vote,
        options: options,
        anonymous: !!vote.anonymous,
        active: !!vote.active
      },
      results,
      submissions: formattedSubmissions,
      stats: {
        totalUsers,
        totalVoted: submissions.length,
        participationRate: totalUsers > 0 ? (submissions.length / totalUsers * 100).toFixed(1) : 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching vote details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/add-user
 * Add a new user
 */
router.post('/add-user', requireAdmin, (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    const db = getDatabase();
    
    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Hash password and create user
    const bcrypt = require('bcrypt');
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = db.prepare(`
      INSERT INTO users (username, password_hash)
      VALUES (?, ?)
    `).run(username, hashedPassword);
    
    res.json({ 
      success: true, 
      message: 'User created successfully',
      userId: result.lastInsertRowid 
    });
    
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/delete-user
 * Delete a user
 */
router.delete('/delete-user', requireAdmin, (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const db = getDatabase();
    
    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has voted (to warn about data integrity)
    const hasVoted = db.prepare('SELECT COUNT(*) as count FROM submissions WHERE user_id = ?').get(userId);
    
    // Delete user (submissions will remain due to foreign key constraints)
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    if (result.changes > 0) {
      res.json({ 
        success: true, 
        message: `User ${user.username} deleted successfully`,
        hadVotes: hasVoted.count > 0
      });
    } else {
      res.status(400).json({ error: 'Failed to delete user' });
    }
    
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/dashboard
 * Get dashboard data for admin panel
 */
router.get('/dashboard', requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    
    // Get current active vote
    const currentVote = db.prepare('SELECT * FROM votes WHERE active = 1 ORDER BY created_at DESC LIMIT 1').get();
    
    // Get user statistics
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const loggedInUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE logged_in = 1').get().count;
    const votedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE voted = 1').get().count;
    
    // Get recent votes
    const recentVotes = db.prepare(`
      SELECT id, title, active, created_at, ended_at,
             (SELECT COUNT(*) FROM submissions WHERE vote_id = votes.id) as submission_count
      FROM votes 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();
    
    res.json({
      currentVote: currentVote ? {
        ...currentVote,
        options: JSON.parse(currentVote.options_json)
      } : null,
      stats: {
        totalUsers,
        loggedInUsers,
        votedUsers,
        participationRate: totalUsers > 0 ? (votedUsers / totalUsers * 100).toFixed(1) : 0
      },
      recentVotes
    });
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
