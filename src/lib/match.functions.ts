import { createServerFn } from "@tanstack/react-start";

export type Match = {
  account_id: string;
  owner_id: string | null;
  confidence: number;
  reason: string;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["matches"],
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["account_id", "owner_id", "confidence", "reason"],
        properties: {
          account_id: { type: "string" },
          owner_id: { type: ["string", "null"] },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
      },
    },
  },
};

export const suggestMatches = createServerFn({ method: "POST" })
  .inputValidator((d: { accounts: string; owners: string }) => {
    if (typeof d?.accounts !== "string" || typeof d?.owners !== "string") throw new Error("Invalid input");
    if (d.accounts.length + d.owners.length > 60000) throw new Error("Input too large");
    return d;
  })
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "You match ownerless account records to owner profiles using shared emails, domains, names, teams or other evidence. Return one entry per account using the account's id (first column). Use owner_id null when no reasonable match exists. Confidence is 0-1. Keep reasons short.",
        input: `OWNERLESS ACCOUNTS (CSV):\n${data.accounts}\n\nOWNER PROFILES (CSV):\n${data.owners}`,
        text: { format: { type: "json_schema", name: "matches", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      const msg = await res.text().catch(() => "");
      if (res.status === 402) throw new Error("AI credits are used up. Add credits in workspace settings.");
      if (res.status === 429) throw new Error("Too many requests. Please wait and try again.");
      throw new Error(`AI request failed (${res.status}) ${msg.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p);
          if (ev.type === "response.output_text.delta") out += ev.delta;
          if (ev.type === "response.refusal.delta") throw new Error("The AI declined this request.");
          if (ev.type === "error" || ev.type === "response.failed") throw new Error("AI request failed.");
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("The AI")) throw e;
          if (e instanceof Error && e.message === "AI request failed.") throw e;
        }
      }
    }
    const parsed = JSON.parse(out) as { matches: Match[] };
    return parsed.matches;
  });
