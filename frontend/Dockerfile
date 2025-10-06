# ===========================
# Frontend (Next.js) Dockerfile
# ===========================

# 1. Use the official lightweight Node.js image
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy dependency files
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy the rest of the project files into the container
COPY . .

# 6. Expose port 3000 for the Next.js app
EXPOSE 3000

# 7. Default command to run the development server
CMD ["npm", "run", "dev"]
