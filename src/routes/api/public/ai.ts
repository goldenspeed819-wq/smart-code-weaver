import { createFileRoute } from "@tanstack/react-router";

type Body = { prompt?: string; images?: string[] };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const Route = createFileRoute("/api/public/ai")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const { prompt, images = [] } = (await request.json()) as Body;
        if (!prompt || typeof prompt !== "string") {
          return Response.json({ error: "prompt obrigatório" }, { status: 400, headers: CORS });
        }
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return Response.json({ error: "LOVABLE_API_KEY ausente" }, { status: 500, headers: CORS });
        }

        const content: unknown[] = [{ type: "text", text: prompt }];
        for (const url of images.slice(0, 6)) {
          content.push({ type: "image_url", image_url: { url } });
        }

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "google/gemini-3.8-flash",
            messages: [{ role: "user", content }],
          }),
        });

        const text = await res.text();
        if (!res.ok) {
          return Response.json({ error: `gateway ${res.status}: ${text.slice(0, 400)}` }, { status: res.status, headers: CORS });
        }
        const data = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
        return Response.json({ text: data.choices?.[0]?.message?.content ?? "" }, { headers: CORS });
      },
    },
  },
});
