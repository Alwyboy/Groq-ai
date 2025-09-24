import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState([]);
  const user_id = "user123"; // ganti sesuai user

  const sendPrompt = async () => {
    if (!prompt) return;
    const res = await fetch("/api/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, user_id })
    });
    const data = await res.json();
    setChat([...chat, { prompt, reply: data.reply }]);
    setPrompt("");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Groq AI Chat 🤖</h1>
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Tulis pesan..."
          style={{ width: "300px", padding: 5 }}
        />
        <button onClick={sendPrompt} style={{ marginLeft: 5, padding: 5 }}>Kirim</button>
      </div>
      <div>
        {chat.map((c, i) => (
          <div key={i}>
            <b>Kamu:</b> {c.prompt} <br/>
            <b>Groq AI:</b> {c.reply} <hr/>
          </div>
        ))}
      </div>
    </div>
  );
}
