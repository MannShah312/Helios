# Use node 20 Alpine as the base image for a lightweight container
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package configurations
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the rest of the backend source files
COPY . .

# Expose the backend port
EXPOSE 5000

# Set environment variable defaults
ENV PORT=5000
ENV NODE_ENV=production

# Command to run the application
CMD ["node", "server.js"]
