export default async function handler(req, res) {
  try {
    const { user, message } = req.body;

    // 🟢 Contoh kirim ke Nightbot (jika kamu punya token akses)
    // await fetch("https://api.nightbot.tv/1/channel/send", {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${process.env.NIGHTBOT_TOKEN}`,
    //     "Content-Type": "application/json"
    //   },
    //   body: JSON.stringify({ message })
    // });

    // Untuk sekarang kita log aja ke console:
    console.log(`[BOT SEND] ${user}: ${message}`);

    res.status(200).send("sent");
  } catch (err) {
    console.error("SendChat error:", err.message);
    res.status(500).send("error: " + err.message);
  }
}
