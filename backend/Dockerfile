# ===========================
# Backend (Node.js / Express) Dockerfile
# ===========================

# 1. Use the official Node.js image
FROM node:20-alpine

# 2. Set working directory
WORKDIR /app

# 3. Copy dependency files
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy the rest of the source code
COPY . .

# 6. Expose port 8000 for the API
EXPOSE 8000

# 7. Default command to start the server
CMD ["npm", "run", "dev"]
