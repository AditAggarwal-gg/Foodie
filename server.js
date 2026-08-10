import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/voice-order.html'));

// LLM_PROVIDER=ollama (default, free, local, no signup) or groq (free hosted tier, works when deployed)
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are the voice-order parser for an Indian food delivery app. You'll get the full menu catalog and a raw speech-to-text transcript from a customer speaking to a voice assistant. Figure out what they want added to or removed from their cart, and reply with ONLY valid JSON — no markdown fences, no prose, nothing but the JSON object — matching exactly this shape:

{"actions":[{"type":"add"|"remove"|"clear_cart","quantity":number,"size":"S"|"M"|"L"|null,"candidates":[{"item_id":"string","restaurant_id":"string"}]}]}

Rules:
- "candidates" lists every catalog item that plausibly matches the dish the customer said. If the dish name is unique to one restaurant, include exactly one candidate. If several restaurants serve a dish with the same or a very similar name, include ALL of them as separate candidate entries — do not guess which restaurant the customer meant; the app will ask them.
- Only pick a single restaurant's item as the sole candidate if the customer explicitly named that restaurant, or if only one restaurant on the menu actually serves that dish.
- Correct obvious speech-to-text mishearings using context — e.g. "kadai paneer" or "karahi paneer" -> Kadhai Paneer, "batter chicken" -> Butter Chicken, "daal makhni" -> Dal Makhani.
- Understand quantity homophones from speech recognition: "to"/"too" -> 2, "for"/"fore" -> 4, "won" -> 1, "ate" -> 8, "tree" -> 3.
- Understand self-corrections within one sentence — e.g. "add two burgers, no wait three" should produce quantity 3 for that item, not both 2 and 3.
- If no quantity is stated for an item, default to 1.
- Ignore filler words, greetings, and unrelated chatter that isn't about ordering food.
- "clear_cart" actions don't need quantity, size, or candidates — omit or leave them null/empty.
- If nothing in the transcript matches any catalog item and there's no cart/remove intent, return {"actions":[]}.
- Never invent an item_id or restaurant_id that isn't in the provided catalog.
- Output ONLY the JSON object. No other text before or after it.`;

function buildUserPrompt(transcript, catalog, activeRestaurantId){
  return `Catalog (JSON array of items):\n${JSON.stringify(catalog)}\n\nCustomer's cart is currently tied to restaurant_id: ${activeRestaurantId || 'none (no restaurant selected yet)'}\n\nTranscript: "${transcript}"`;
}

function cleanJson(text){
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
}

async function parseWithOllama(transcript, catalog, activeRestaurantId){
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(transcript, catalog, activeRestaurantId) },
      ],
      format: 'json',
      stream: false,
      options: { temperature: 0.1 },
    }),
  });
  if(!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(cleanJson(data.message?.content || ''));
}

async function parseWithGroq(transcript, catalog, activeRestaurantId){
  if(!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(transcript, catalog, activeRestaurantId) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });
  if(!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return JSON.parse(cleanJson(text));
}

app.post('/api/parse-voice', async (req, res) => {
  const { transcript, catalog, activeRestaurantId } = req.body || {};
  if(!transcript || !Array.isArray(catalog)){
    return res.status(400).json({ error: 'transcript and catalog are required' });
  }
  try{
    const parsed = LLM_PROVIDER === 'groq'
      ? await parseWithGroq(transcript, catalog, activeRestaurantId)
      : await parseWithOllama(transcript, catalog, activeRestaurantId);
    res.json(parsed);
  } catch(err){
    console.error('Voice parse error:', err.message);
    res.status(500).json({ error: 'Failed to parse voice command', detail: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, provider: LLM_PROVIDER, model: LLM_PROVIDER === 'groq' ? GROQ_MODEL : OLLAMA_MODEL });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🍽️  foodie server running → http://localhost:${PORT}/voice-order.html`);
  console.log(`   LLM provider: ${LLM_PROVIDER}${LLM_PROVIDER === 'groq' ? ` (model: ${GROQ_MODEL})` : ` (model: ${OLLAMA_MODEL} at ${OLLAMA_URL})`}\n`);
});
