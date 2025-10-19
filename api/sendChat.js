// Contoh endpoint kirim pesan ke YouTube Live Chat / Streamlabs / Nightbot
export default async function handler(req, res) {
  try {
    const { user, message } = req.body;

    // Ganti sesuai API pengiriman kamu:
    // Contoh: kirim ke Streamlabs Chatbot, atau Nightbot custom endpoint.
    console.log(`[BOT SEND] ${user}: ${message}`);

    // TODO: tambahkan fetch ke API real bot kamu di sini

    res.status(200).send("sent");
  } catch (err) {
    console.error("SendChat error:", err.message);
    res.status(500).send("error: " + err.message);
  }
}
