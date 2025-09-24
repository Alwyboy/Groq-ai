import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateReply(prompt, history) {
  const emojis = ["😎","😂","👍","💡","🚀","😉","😏","🤖"];
  const context = history.map(h => h.prompt).join(" | ").toLowerCase();
  let reply = "";

  if (/halo|hi|hei/.test(prompt.toLowerCase())) {
    reply = `Halo juga! ${emojis[Math.floor(Math.random()*emojis.length)]}`;
  } else if (/kamu|siapa/.test(prompt.toLowerCase())) {
    reply = `Aku Groq AI, teman ngobrolmu! ${emojis[Math.floor(Math.random()*emojis.length)]}`;
  } else if (context.includes(prompt.toLowerCase())) {
    reply = `Kamu nanya ini lagi ya 😏 ${emojis[Math.floor(Math.random()*emojis.length)]}`;
  } else {
    reply = `Sip, dicatet! ${emojis[Math.floor(Math.random()*emojis.length)]}`;
  }

  const sentences = reply.split(/[.!?]/).filter(s => s.trim());
  return sentences.slice(0,2).join(". ") + ".";
}

export default async function handler(req, res) {
  try {
    const { prompt, user_id } = req.body;
    if (!prompt || !user_id) return res.status(400).json({ error: "Isi prompt & user_id dulu 😅" });

    const { data: history } = await supabase
      .from("chat_history")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: true });

    const reply = generateReply(prompt, history || []);

    await supabase.from("chat_history").insert([
      { user_id, prompt, reply, created_at: new Date() },
    ]);

    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ups, ada error 😬" });
  }
}
