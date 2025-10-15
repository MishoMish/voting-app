# Use standard Node.js image for better compatibility
FROM node:20 AS builder

# Set working directory
WORKDIR /app

# Copy package files for both frontend and backend
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd frontend && npm ci --only=production && npm cache clean --force
RUN cd backend && npm ci --only=production && npm cache clean --force

# Copy source code
COPY frontend ./frontend
COPY backend ./backend

# Build frontend
RUN cd frontend && npm run build

# Production stage
FROM node:20 AS production

# Set working directory
WORKDIR /app

# Copy backend files and dependencies
COPY --from=builder /app/backend ./backend

# Copy frontend build to backend's public directory
COPY --from=builder /app/backend/public ./backend/public

# Create data directory for SQLite database with proper permissions
RUN mkdir -p ./backend/data

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Set proper ownership and permissions for the data directory
RUN chown -R nodejs:nodejs /app
RUN chmod -R 755 /app/backend/data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "backend/server.js"]
