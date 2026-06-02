# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY src/ ./src/

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "src/server.js"]
