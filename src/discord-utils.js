const DISCORD_MESSAGE_LIMIT = 2000;

export function parsePrompt(message, botUserId, { replyMode }) {
  const content = message.content.trim();
  const mentionPattern = new RegExp(`^<@!?${botUserId}>\\s*`);
  const isMention = mentionPattern.test(content);
  const containsGpt = content.toLowerCase().includes("gpt");

  if (message.guild) {
    const accepted =
      replyMode === "all" ||
      ((replyMode === "mention" || replyMode === "both") && isMention) ||
      ((replyMode === "detect" || replyMode === "both") && containsGpt);
    if (!accepted) return null;
  }

  let prompt = content;
  if (isMention) prompt = prompt.replace(mentionPattern, "");
  return prompt;
}

export function splitDiscordMessage(text, limit = DISCORD_MESSAGE_LIMIT) {
  if (!text) return ["(빈 응답)"];
  const chunks = [];
  let remaining = text;

  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < Math.floor(limit * 0.5)) cut = remaining.lastIndexOf(" ", limit);
    if (cut < Math.floor(limit * 0.5)) cut = limit;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function imageAttachments(message) {
  return [...message.attachments.values()]
    .filter((attachment) => attachment.contentType?.startsWith("image/"))
    .map((attachment) => attachment.url);
}
