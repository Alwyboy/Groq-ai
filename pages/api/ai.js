import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Konfigurasi memory auto-clear (misal hapus chat > 6 jam)
const MEMORY_EXPIRY_HOURS = 6;

export default async function handler(req, res) {
  const user = req.query.user || "Guest";
  const message = (req.query.message || "").trim();

  if (!message) return res.status(400).send("Pesan kosong");

  // --- 1. Simpan chat ---
  await supabase.from("chat_global").insert([{ username: user, message }]);
  await supabase.from("chat_user_memory").insert([{ username: user, message }]);

  const expiryDate = new Date(Date.now() - MEMORY_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  // --- 2. Hapus memory lama ---
  await supabase.from("chat_global").delete().lt("created_at", expiryDate);
  await supabase.from("chat_user_memory").delete().lt("created_at", expiryDate);

  // --- 3. Ambil memory untuk AI ---
  // Global (10 pesan terakhir)
  const { data: globalMessages } = await supabase
    .from("chat_global")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  // Per user (5 pesan terakhir)
  const { data: userMessages } = await supabase
    .from("chat_user_memory")
    .select("*")
    .eq("username", user)
    .order("created_at", { ascending: false })
    .limit(5);

  // Susun context untuk AI
  const contextGlobal = globalMessages.reverse().map(m => `${m.username}: ${m.message}`).join("\n");
  const contextUser = userMessages.reverse().map(m => `${m.username}: ${m.message}`).join("\n");

  const finalPrompt = `
Kamu adalah Nightbot AI yang ramah dan sopan di live chat YouTube.
Kamu punya personality: lucu tapi tetap sopan.
Gunakan konteks berikut:

-- Memory global --
${contextGlobal}

-- Memory user (${user}) --
${contextUser}

Balas pertanyaan dengan super singkat maksimal 2 kalimat.
`;

  // --- 4. Minta respon ke OpenAI ---
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: finalPrompt },
      { role: "user", content: message }
    ]
  });

  const reply = completion.choices[0].message.content;
  res.status(200).send(reply);
}
