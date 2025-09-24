import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  try {
    const prompt = (req.query.prompt || "").trim();
    const usernameRaw = req.query.user || "anon";
    const username = String(usernameRaw).toLowerCase();

    if (!prompt) return res.status(200).send("Apa yang mau kamu tanyakan?");

    const API_KEY = process.env.GROQ_API_KEY;
    if (!API_KEY) return res.status(500).send("⚠️ API key belum diatur.");

    // Hapus chat >30 hari
    const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString();
    await supabase.from("chat_history").delete().lt("created_at", thirtyDaysAgo);

    // Ambil 10 chat terakhir user
    const { data: historyData } = await supabase
      .from("chat_history")
      .select("*")
      .eq("username", username)
      .order("created_at", { ascending: true })
      .limit(10);

    const messages = [
      {
        role: "system",
        content: "Kamu adalah chatbot humoris dan ramah di live chat YouTube. Jawab super singkat, <200 karakter, kayak manusia ngobrol santai. Boleh pakai emoji."
      },
      ...(historyData?.map(h => ({ role: h.role, content: h.message })) || [])
    ];

    messages.push({ role: "user", content: prompt });

    // Panggil AI
    const payload = { model: "meta-llama/llama-4-scout-17b-16e-instruct", messages, max_tokens: 250, temperature: 0.7 };
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) return res.status(502).send("⚠️ AI provider error.");

    const data = await resp.json().catch(() => null);
    let answer = data?.choices?.[0]?.message?.content?.trim() || "Hmm... aku agak bingung 😅";
    if (answer.length > 200) answer = answer.slice(0, 197).trim() + "...";

    // Simpan ke Supabase
    await supabase.from("chat_history").insert([
      { username, role: "user", message: prompt },
      { username, role: "assistant", message: answer }
    ]);

    res.status(200).send(answer);

  } catch (err) {
    console.error(err);
    res.status(500).send("⚠️ Internal server error.");
  }
}
