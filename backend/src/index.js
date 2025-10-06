import express from "express";
import axios from "axios";
import pkg from "pg";

const { Pool } = pkg;
const app = express();
const port = 8000;

// Connect to PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(express.json());

// Simple health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "backend" });
});

// Example route that fetches from LLM
app.post("/api/ask", async (req, res) => {
  try {
    const { prompt } = req.body;
    const llmUrl = process.env.LLM_SERVICE_URL || "http://llm:5000";
    const response = await axios.post(`${llmUrl}/completion`, { prompt });
    res.json({ answer: response.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "LLM request failed" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`✅ Backend running on port ${port}`);
});
