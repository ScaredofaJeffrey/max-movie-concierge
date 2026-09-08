export default async function handler(request) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: cors
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response("Transcription service is not configured.", {
      status: 500,
      headers: cors
    });
  }

  try {
    const incoming = await request.formData();
    const audio = incoming.get("file");

    if (!(audio instanceof Blob) || !audio.size) {
      return new Response("No audio received.", {
        status: 400,
        headers: cors
      });
    }

    const form = new FormData();
    form.append(
      "file",
      audio,
      audio.name || "max-voice.webm"
    );
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "en");
    form.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        ...cors,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(error?.message || "Transcription service failed.", {
      status: 500,
      headers: cors
    });
  }
}
