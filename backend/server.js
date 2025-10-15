import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import database and routes
import { initDatabase } from './db.js';
import initializeDatabase from './init/initDb.js';
import authRoutes from './routes/auth.js';
import voteRoutes from './routes/vote.js';
import adminRoutes from './routes/admin.js';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  }
});

// Store io instance in app for access in routes
app.set('io', io);

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'voting-app-secret-change-in-production';

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false
}));

app.use(cors({
  origin: true, // Allow all origins for LAN access
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Allow HTTP for LAN access
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // More permissive for LAN access
  }
}));

// Initialize database
async function initializeApp() {
  try {
    const dbPath = path.join(__dirname, 'data', 'votes.db');
    
    // Check if database exists, if not create it
    if (!fs.existsSync(dbPath)) {
      console.log('Database not found, initializing...');
      initializeDatabase();
    } else {
      console.log('Database found, connecting...');
      initDatabase();
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// API Routes
app.use('/api', authRoutes);
app.use('/api', voteRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files from React build (in production)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'public');
  app.use(express.static(buildPath));
  
  // Handle React routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  // Development mode - just serve a simple message
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Voting App API Server',
      status: 'running',
      environment: 'development',
      frontend: 'Run the frontend separately with npm run dev in the frontend folder'
    });
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
  
  socket.on('admin_connect', () => {
    socket.join('admin');
    console.log(`Admin connected: ${socket.id}`);
  });
  
  socket.on('user_connect', (data) => {
    socket.join('users');
    console.log(`User connected to room: ${socket.id}, data:`, data);
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\nReceived SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
async function startServer() {
  try {
    await initializeApp();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\\n🚀 Voting App Server running on port ${PORT}`);
      console.log(`🌐 Local: http://localhost:${PORT}`);
      console.log(`🌐 Network: http://0.0.0.0:${PORT}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('\\n📝 Admin credentials:');
      console.log(`   Username: ${process.env.ADMIN_USER || 'admin'}`);
      console.log(`   Password: ${process.env.ADMIN_PASS || 'admin123'}`);
      console.log('\\n📚 Test user accounts created with passwords: password1, password2, etc.');
      console.log('   Users: student1, student2, student3, student4, student5, teacher1, teacher2, alice, bob, charlie');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
