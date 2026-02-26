import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import jwt from "jsonwebtoken";

app.post("/admin/login", (req, res) => {
  const { password } = req.body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = jwt.sign(
    { role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({ token });
});

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = auth.split(" ")[1];

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(cors({ origin: "*" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/ai/parse", async (req, res) => {
  try {
    const { message } = req.body;

    const systemPrompt = `
You are an intent parser for a hospital search app.
If the user mentions "near", "near me", "closest", or "nearest", set "nearest": true.
Extract structured filters as JSON with fields:
{
  "nearest": boolean,
  "type": "Private" | "Government" | null,
  "specialty": "cardiac" | "cancer" | "maternity" | "orthopedic" | "general" | null,
  "emergency24x7": boolean | null,
  "district": string | null,
  "city": string | null,
  "limit": number | null
}
Return ONLY valid JSON.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0
    });

    const text = completion.choices[0].message.content;
    const parsed = JSON.parse(text);

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI parsing failed" });
  }
});

app.listen(3001, () => {
  console.log("AI server running at https://localhost:3000");
});

app.use(express.json())

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "hospitals.json");

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

app.get("/api/hospitals", (req, res) => {
  try {
    res.json(readDB());
  } catch (e) {
    res.status(500).json({ error: "Failed to read DB" });
  }
});

app.post("/api/hospitals", requireAdmin, (req, res) => {
  try {
    const hospitals = readDB();
    const newHospital = { id: Date.now(), ...req.body };
    hospitals.push(newHospital);
    writeDB(hospitals);
    res.json(newHospital);
  } catch (e) {
    res.status(500).json({ error: "Failed to write DB" });
  }
});

app.delete("/api/hospitals/:id", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const hospitals = readDB().filter(h => h.id !== id);
    writeDB(hospitals);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

app.get("/", (req, res) => {
  res.json({ ok: true, service: "hospital-tracker-api" });
});
