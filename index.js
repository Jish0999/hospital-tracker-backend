import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();

app.get("/", (req, res) => {
  res.json({ ok: true, service: "hospital-tracker-api" });
});

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
  console.log("AI server running at http://localhost:3001");
});

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

// GET all hospitals
app.get("/api/hospitals", (req, res) => {
  const data = readDB();
  res.json(data);
});

// ADD hospital
app.post("/api/hospitals", (req, res) => {
  const hospitals = readDB();
  const newHospital = { id: Date.now(), ...req.body };
  hospitals.push(newHospital);
  writeDB(hospitals);
  res.json(newHospital);
});

// UPDATE hospital
app.put("/api/hospitals/:id", (req, res) => {
  const hospitals = readDB();
  const id = Number(req.params.id);
  const idx = hospitals.findIndex(h => h.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  hospitals[idx] = { ...hospitals[idx], ...req.body };
  writeDB(hospitals);
  res.json(hospitals[idx]);
});

// DELETE hospital
app.delete("/api/hospitals/:id", (req, res) => {
  const hospitals = readDB().filter(h => h.id !== Number(req.params.id));
  writeDB(hospitals);
  res.json({ ok: true });
});
