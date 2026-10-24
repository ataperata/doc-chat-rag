export function messageText(message: {
  parts?: Array<{ type?: string; text?: string }>;
}) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}
