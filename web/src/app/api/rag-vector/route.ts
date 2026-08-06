// Non-streaming: waits for embed + retrieve + the downstream Gemma call to fully
// complete (cold starts can take ~60-90s), unlike the simple streaming chat proxy.
export const maxDuration = 120;

export async function POST(request: Request) {
  const modalUrl = process.env.MODAL_RAG_VECTOR_URL;
  const serveToken = process.env.MODAL_SERVE_TOKEN;
  if (!modalUrl || !serveToken) {
    return Response.json(
      { error: "server is missing MODAL_RAG_VECTOR_URL/MODAL_SERVE_TOKEN" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question : "";
  if (!question.trim()) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const upstream = await fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        top_k: body?.top_k ?? 5,
        token: serveToken,
      }),
    });

    const data = await upstream.json().catch(() => ({ error: "invalid upstream response" }));
    return Response.json(data, { status: upstream.status });
  } catch {
    // The Modal endpoint can be mid cold-start and drop the connection entirely --
    // always return valid JSON here so the client never has to parse an error page.
    return Response.json(
      { error: "Could not reach the Modal backend — it may be cold-starting. Try again in a moment." },
      { status: 502 }
    );
  }
}
