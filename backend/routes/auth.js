import express from 'express';
import bcrypt from 'bcrypt';
import { getDatabase } from '../db.js';
import { createUserSession, destroyUserSession, getUserId, getUsername } from '../utils/sessionUtils.js';

const router = express.Router();

/**
 * POST /api/login
 * Authenticate user and create session
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, isAdmin } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const db = getDatabase();
    
    // Handle admin login
    if (isAdmin) {
      const adminUser = process.env.ADMIN_USER;
      const adminPass = process.env.ADMIN_PASS;
      
      if (username !== adminUser || password !== adminPass) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }
      
      createUserSession(req, 'admin', username, true);
      return res.json({ 
        success: true, 
        user: { username, isAdmin: true },
        message: 'Admin login successful'
      });
    }
    
    // Handle regular user login
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user is already logged in
    if (user.logged_in) {
      return res.status(409).json({ error: 'This account is already logged in from another device' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Mark user as logged in
    db.prepare('UPDATE users SET logged_in = 1 WHERE id = ?').run(user.id);
    
    // Create session
    createUserSession(req, user.id, user.username, false);
    
    // Emit socket event for admin panel
    req.app.get('io').emit('user_logged_in', { username: user.username });
    
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        voted: user.voted,
        isAdmin: false 
      },
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/logout
 * Logout user and destroy session
 */
router.post('/logout', async (req, res) => {
  try {
    const userId = getUserId(req);
    const username = getUsername(req);
    
    if (userId && userId !== 'admin') {
      const db = getDatabase();
      db.prepare('UPDATE users SET logged_in = 0 WHERE id = ?').run(userId);
      
      // Emit socket event for admin panel
      req.app.get('io').emit('user_logged_out', { username });
    }
    
    await destroyUserSession(req);
    
    res.json({ success: true, message: 'Logout successful' });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/session
 * Check current session status
 */
router.get('/session', (req, res) => {
  try {
    if (req.session && req.session.userId) {
      const db = getDatabase();
      
      if (req.session.isAdmin) {
        return res.json({ 
          authenticated: true, 
          user: { 
            username: req.session.username, 
            isAdmin: true 
          } 
        });
      }
      
      // Get updated user info from database
      const user = db.prepare('SELECT id, username, voted FROM users WHERE id = ?').get(req.session.userId);
      
      if (!user) {
        return res.json({ authenticated: false });
      }
      
      res.json({ 
        authenticated: true, 
        user: { 
          id: user.id,
          username: user.username, 
          voted: user.voted,
          isAdmin: false 
        } 
      });
    } else {
      res.json({ authenticated: false });
    }
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
