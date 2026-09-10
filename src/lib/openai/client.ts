import "server-only";
import OpenAI from "openai";

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!cached) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    cached = new OpenAI({ apiKey });
  }
  return cached;
}

export function getModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
