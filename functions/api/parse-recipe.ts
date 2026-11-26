/// <reference types="@cloudflare/workers-types" />

interface Env {
  GEMINI_API_KEY: string;
}

interface ParseRequestBody {
  text?: string;
  imageBase64?: string; // Sin el prefijo "data:image/jpeg;base64,"
  mimeType?: string; // ej. "image/jpeg" o "image/png"
}

const SYSTEM_PROMPT = `
Eres un asistente culinario experto en estructurar recetas para una aplicación personal en español.
Analiza el texto o la imagen proporcionados y devuelve ÚNICAMENTE un objeto JSON válido siguiendo el esquema exacto indicado.

Reglas estrictas:
1. "type":
   - Usa "thermomix" si menciona Thermomix, TM5/TM6/TM7, velocidades (vel 1, vel cuchara, espiga), giro inverso o temperatura varoma.
   - Usa "basica" si es solo el nombre de un plato sencillo sin pasos de elaboración (ej. "Judías verdes con patata", "Filete de pollo a la plancha"). En este caso, deja "markdown_body" como null e infiere los ingredientes principales evidentes si no se listan.
   - Usa "manual" para cualquier otra receta tradicional con elaboración.
2. "markdown_body":
   - Redacta los pasos en Markdown limpio y directo usando listas numeradas (1., 2., 3.).
   - Si "type" es "thermomix", encierra SIEMPRE los parámetros de máquina entre corchetes con el formato [tiempo / temperatura / velocidad], por ejemplo: [3 min / 120°C / vel 1] o [5 seg / vel 5].
   - Si "type" es "basica", devuelve null.
3. "ingredients":
   - Extrae cada ingrediente con nombre normalizado en minúsculas, cantidad numérica ("qty") y unidad ("unit": "g", "ml", "ud", "cda", "cdta", "pizca", etc.). Si es "al gusto", pon qty: null y unit: "al gusto".
4. "tags":
   - Genera entre 2 y 4 etiquetas cortas en minúsculas útiles para filtrar (ej. "arroz", "rápido", "legumbres", "cena ligera", "vegetariano", "pescado", "pollo").
`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    type: { type: 'STRING', enum: ['basica', 'manual', 'thermomix'] },
    prep_time_min: { type: 'INTEGER', nullable: true },
    servings: { type: 'INTEGER', nullable: true },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          qty: { type: 'NUMBER', nullable: true },
          unit: { type: 'STRING', nullable: true },
        },
        required: ['name'],
      },
    },
    notes: { type: 'STRING', nullable: true },
    markdown_body: { type: 'STRING', nullable: true },
  },
  required: ['title', 'type', 'tags', 'ingredients'],
};

/** Flash-Lite: thinking mínimo por defecto; ideal para extracción JSON rápida. */
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_TIMEOUT_MS = 25_000;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });
    }

    const body = (await context.request.json()) as ParseRequestBody;
    if (!body.text?.trim() && !body.imageBase64) {
      return Response.json({ error: 'Debes enviar texto o una imagen' }, { status: 400 });
    }

    const parts: Array<Record<string, unknown>> = [];

    if (body.text?.trim()) {
      parts.push({ text: `Receta a procesar:\n${body.text.trim()}` });
    } else {
      parts.push({ text: 'Extrae y estructura la receta que aparece en esta imagen.' });
    }

    if (body.imageBase64) {
      parts.push({
        inline_data: {
          mime_type: body.mimeType || 'image/jpeg',
          data: body.imageBase64,
        },
      });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    let geminiRes: Response;
    try {
      geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            thinkingConfig: {
              thinkingLevel: 'minimal',
            },
          },
        }),
      });
    } catch (err) {
      const message = (err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError'
        ? 'La IA tardó demasiado. Inténtalo de nuevo.'
        : `No se pudo contactar con Gemini: ${(err as Error).message}`;
      return Response.json({ error: message }, { status: 504 });
    }

    if (!geminiRes.ok) {
      const errDetail = await geminiRes.text();
      return Response.json({ error: 'Error en Gemini API', detail: errDetail }, { status: 502 });
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: { blockReason?: string };
    };

    const rawJson = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) {
      const reason = geminiData.promptFeedback?.blockReason;
      return Response.json(
        {
          error: reason
            ? `La IA bloqueó la solicitud (${reason})`
            : 'Respuesta vacía de la IA',
        },
        { status: 502 },
      );
    }

    return new Response(rawJson, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return Response.json(
      { error: 'Error interno procesando receta', message: (err as Error).message },
      { status: 500 },
    );
  }
};
