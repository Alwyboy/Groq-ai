import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Konfigurasi memory auto-clear (jam)
const MEMORY_EXPIRY_HOURS = parseInt(process.env.MEMORY_EXPIRY_HOURS || "24");
// Batas karakter pesan YouTube Live Chat (aman: 200)
const CHAT_CHAR_LIMIT = 200;

export default async function handler(req, res) {
  try {
    // --- Ambil user & message ---
    const user = req.query.user || "Guest";
    let message = (req.query.message || "").trim();

    // ✅ Jika user tidak mengetik apapun → respon khusus
    if (!message) {
      return res.status(200).send(`iya kenapa ${user} sayang?`);
    }

    const msgLower = message.toLowerCase();

    // ✅ Override khusus jika pesan hanya "Nightbot" atau "@Nightbot"
    if (msgLower === "nightbot" || msgLower === "@nightbot") {
      return res.status(200).send(`${user}, iya kenapa sayang`);
    }

    // --- Simpan chat global ---
    try {
      await supabase.from("chat_global").insert([{ username: user, message }]);
    } catch (err) {
      console.error("Supabase insert global failed:", err.message);
    }

    // --- Simpan chat per user ---
    try {
      await supabase.from("chat_user_memory").insert([{ username: user, message }]);
    } catch (err) {
      console.error("Supabase insert user memory failed:", err.message);
    }

    // --- Hapus memory lama ---
    const expiryDate = new Date(Date.now() - MEMORY_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    try {
      await supabase.from("chat_global").delete().lt("created_at", expiryDate);
      await supabase.from("chat_user_memory").delete().lt("created_at", expiryDate);
    } catch (err) {
      console.error("Supabase delete old memory failed:", err.message);
    }

    // --- Ambil memory ---
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

    // ✅ Tambahkan nama user di depan semua respon
    reply = `${user}, ${reply}`.trim();

    // ✅ Jika balasan terlalu panjang, pecah jadi beberapa bagian
    const splitReply = [];
    for (let i = 0; i < reply.length; i += CHAT_CHAR_LIMIT) {
      splitReply.push(reply.slice(i, i + CHAT_CHAR_LIMIT));
    }

    // Jika hanya 1 bagian, kirim biasa
    if (splitReply.length === 1) {
      return res.status(200).send(splitReply[0]);
    }

    // Jika lebih dari 1 bagian, kirim sebagai array pesan berurutan
    // Misal Nightbot diset untuk menampilkan semuanya satu per satu
    const fullReply = splitReply
      .map((part, idx) => idx === 0 ? `${part}` : `↳ ${part}`)
      .join("\n");

    return res.status(200).send(fullReply);

  } catch (err) {
    console.error("Unexpected error in handler:", err);
    res.status(500).send("Server error: " + err.message);
  }
}
