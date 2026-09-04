# MAX voice transcription service

The GitHub Pages app cannot safely store a speech-to-text API key in browser JavaScript. The worker in `server/transcribe.js` is a small server-side bridge for the Opera recorder fallback.

## Cloudflare Worker setup

1. Create a Cloudflare Worker.
2. Deploy `server/transcribe.js` as the Worker entry point.
3. Add an encrypted Worker secret named `OPENAI_API_KEY` containing your OpenAI API key.
4. Set `ALLOWED_ORIGIN` to the MAX GitHub Pages origin when you want to restrict browser access. For the current project, use the exact GitHub Pages origin rather than a wildcard.
5. Copy the Worker HTTPS URL.
6. Open MAX Settings and paste that URL into **Voice transcription endpoint**.
7. Save Settings, then test **Talk to MAX** in Opera.

The worker calls OpenAI's audio transcription endpoint with `gpt-4o-mini-transcribe` and returns the JSON transcription to MAX. The API key remains server-side.

## Important

The recorder fallback is intentionally not enabled by a hard-coded public service URL. Until a server-side transcription endpoint is configured in MAX Settings, Opera will explain that voice transcription is not connected rather than exposing an API key or silently sending audio somewhere unexpected.
