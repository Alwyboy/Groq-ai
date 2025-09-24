export default async function handler(req, res) {
  try {
    const prompt = req.query.prompt || "";
    const user_id = req.query.user_id || "guest";

    if (!prompt) return res.status(400).send("Isi prompt dulu 😅");

    const { data: history } = await supabase
      .from("chat_history")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: true });

    const reply = generateReply(prompt, history || []);

    await supabase.from("chat_history").insert([
      { user_id, prompt, reply, created_at: new Date() },
    ]);

    res.status(200).send(reply);
  } catch (err) {
    console.error(err);
    res.status(500).send("Ups, ada error 😬");
  }
}
