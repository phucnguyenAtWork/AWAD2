import { env } from "../env";

export type GeminiMessage = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

export type ModelChatRequest = {
  systemInstruction: string;
  messages: GeminiMessage[];
};

export type ModelChatResponse = {
  text: string;
};

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;

export const modelClient = {
  async chat(input: ModelChatRequest): Promise<ModelChatResponse> {
    const body = {
      system_instruction: {
        parts: [{ text: input.systemInstruction }],
      },
      contents: input.messages,
    };

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errorText}`);
    }

    type GeminiResponse = {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { text };
  },
};
