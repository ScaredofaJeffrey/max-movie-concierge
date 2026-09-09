export const config = {
  maxDuration: 30
};

export default async function handler(request) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  console.info("[MAX transcribe] request", request.method);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (request.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      service: "MAX voice transcription",
      configured: Boolean(process.env.OPENAI_API_KEY)
    }), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json"
      }
    });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: cors
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("[MAX transcribe] missing OPENAI_API_KEY");
    return new Response("Transcription service is not configured.", {
      status: 500,
      headers: cors
    });
  }

  try {
    console.info("[MAX transcribe] reading multipart audio");
    const incoming = await request.formData();
    const audio = incoming.get("file");

    if (!(audio instanceof Blob) || !audio.size) {
      console.error("[MAX transcribe] no audio received");
      return new Response("No audio received.", {
        status: 400,
        headers: cors
      });
    }

    console.info("[MAX transcribe] audio received", audio.size, audio.type || "unknown");

    const form = new FormData();
    form.append(
      "file",
      audio,
      audio.name || "max-voice.webm"
    );
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "en");
    form.append("response_format", "json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let response;

    try {
      console.info("[MAX transcribe] sending audio to OpenAI");
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: form,
        signal: controller.signal
      });
      console.info("[MAX transcribe] OpenAI responded", response.status);
    } finally {
      clearTimeout(timeout);
    }

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        ...cors,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      console.error("[MAX transcribe] OpenAI request timed out");
      return new Response("Transcription provider timed out.", {
        status: 504,
        headers: cors
      });
    }

    console.error("[MAX transcribe] failure", error?.message || error);
    return new Response(error?.message || "Transcription service failed.", {
      status: 500,
      headers: cors
    });
  }
}
