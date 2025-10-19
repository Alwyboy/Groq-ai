import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Konfigurasi memory auto-clear (jam)
const MEMORY_EXPIRY_HOURS = parseInt(process.env.MEMORY_EXPIRY_HOURS || "24");
const CHAT_CHAR_LIMIT = 200;

export default async function handler(req, res) {
  try {
    const user = req.query.user || "Guest";
    let message = (req.query.message || "").trim();

    if (!message) return res.status(200).send(`iya kenapa ${user} sayang?`);

    const msgLower = message.toLowerCase();
    if (msgLower === "nightbot" || msgLower === "@nightbot")
      return res.status(200).send(`${user}, iya kenapa sayang`);

    // --- Simpan chat global & user ---
    try {
      await supabase.from("chat_global").insert([{ username: user, message }]);
      await supabase.from("chat_user_memory").insert([{ username: user, message }]);
    } catch (err) {
      console.error("Supabase insert failed:", err.message);
    }

    // --- Hapus memory lama ---
    const expiryDate = new Date(Date.now() - MEMORY_EXPIRY_HOURS * 3600000).toISOString();
    try {
      await supabase.from("chat_global").delete().lt("created_at", expiryDate);
      await supabase.from("chat_user_memory").delete().lt("created_at", expiryDate);
    } catch (err) {
      console.error("Supabase delete old memory failed:", err.message);
    }

    // --- Ambil konteks memory ---
    const { data: globalMessages } = await supabase
      .from("chat_global")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    const { data: userMessages } = await supabase
      .from("chat_user_memory")
      .select("*")
      .eq("username", user)
      .order("created_at", { ascending: false })
      .limit(5);

    const contextGlobal = (globalMessages || []).reverse().map(m => `${m.username}: ${m.message}`).join("\n");
    const contextUser = (userMessages || []).reverse().map(m => `${m.username}: ${m.message}`).join("\n");

    const finalPrompt = `
Kamu adalah Nightbot AI seperti manusia yang ramah dan sedikit humoris di live chat YouTube.
Kepribadian: asyik diajak ngobrol, jangan kaku, gunakan emoji seperlunya, jawab super singkat maksimal 3 kalimat.
Gunakan konteks berikut:

-- Memory global --
${contextGlobal}

-- Memory user (${user}) --
${contextUser}

Balas pertanyaan dengan santai dan jelas.
`;

    // --- Request ke GROQ API ---
    let reply = "Maaf, saya tidak bisa membalas sekarang.";
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: finalPrompt },
            { role: "user", content: message }
          ]
        })
      });

      const data = await response.json();
      reply = data.choices?.[0]?.message?.content || reply;
    } catch (err) {
      console.error("GROQ API request failed:", err.message);
      reply = `Server AI error: ${err.message}`;
    }

    // ✅ Tambahkan nama user di depan
    reply = `${user}, ${reply}`.trim();

    // ✅ Pecah jika terlalu panjang
    const splitReply = [];
    for (let i = 0; i < reply.length; i += CHAT_CHAR_LIMIT) {
      let part = reply.slice(i, i + CHAT_CHAR_LIMIT).trim();
      if (i > 0) part = `↳ ${part}`;
      splitReply.push(part);
    }

    // ✅ Kirim satu per satu (delay antar pesan 2 detik)
    const SEND_URL = process.env.BOT_SEND_URL; // endpoint bot kamu
    if (SEND_URL) {
      for (let i = 0; i < splitReply.length; i++) {
        const msg = splitReply[i];
        try {
          await fetch(SEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user, message: msg })
          });
          if (i < splitReply.length - 1) await new Promise(r => setTimeout(r, 2000)); // jeda 2 detik
        } catch (err) {
          console.error("Gagal kirim pesan ke bot:", err.message);
        }
      }
    }

    // ✅ Balasan ke requester
    if (splitReply.length === 1) return res.status(200).send(splitReply[0]);
    return res.status(200).json({ multiReply: true, sent: splitReply.length });

  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).send("Server error: " + err.message);
  }
}

