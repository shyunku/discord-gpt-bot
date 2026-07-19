const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

export class OpenAIResponsesClient {
  constructor({ apiKey, baseUrl, model, maxOutputTokens, reasoningEffort, instructions, timeoutMs, maxRetries }) {
    this.apiKey = apiKey;
    this.url = `${baseUrl}/responses`;
    this.model = model;
    this.maxOutputTokens = maxOutputTokens;
    this.reasoningEffort = reasoningEffort;
    this.instructions = instructions;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  async respond(history, prompt, imageUrls = []) {
    const userContent = [{ type: "input_text", text: prompt || "Describe the attached image(s)." }];
    for (const imageUrl of imageUrls) {
      userContent.push({ type: "input_image", image_url: imageUrl });
    }

    const body = {
      model: this.model,
      instructions: this.instructions,
      input: [...history, { role: "user", content: userContent }],
      max_output_tokens: this.maxOutputTokens,
      store: false,
    };
    if (this.reasoningEffort) {
      body.reasoning = { effort: this.reasoningEffort };
    }

    for (let attempt = 0; ; attempt += 1) {
      let response;
      try {
        response = await fetch(this.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        if (attempt < this.maxRetries && error.name !== "AbortError" && error.name !== "TimeoutError") {
          await backoff(attempt);
          continue;
        }
        if (error.name === "AbortError" || error.name === "TimeoutError") {
          throw new Error("OpenAI API request timed out.");
        }
        throw new Error(`Could not reach the OpenAI API: ${error.message}`);
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (attempt < this.maxRetries && RETRYABLE_STATUS.has(response.status)) {
          await backoff(attempt, response.headers.get("retry-after"));
          continue;
        }
        const detail = payload?.error?.message || `HTTP ${response.status}`;
        throw new Error(`OpenAI API error: ${detail}`);
      }

      const text = extractOutputText(payload);
      if (!text) throw new Error("OpenAI API returned no text output.");
      return text;
    }
  }
}

export function extractOutputText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

async function backoff(attempt, retryAfter) {
  const headerMs = Number(retryAfter) * 1000;
  const delay = Number.isFinite(headerMs) && headerMs > 0 ? headerMs : 500 * 2 ** attempt;
  await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 10000)));
}
