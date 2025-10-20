export default async function handler(req, res) {
  try {
    const { user, message } = req.body;
    console.log(`[SEND] ${user}: ${message}`);

    // Contoh kirim ke Nightbot lewat Streamlabs / Chat API kamu
    await fetch("https://api.nightbot.tv/1/channel/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NIGHTBOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    res.status(200).send("ok");
  } catch (err) {
    console.error("SendChat error:", err);
    res.status(500).send("error");
  }
}
