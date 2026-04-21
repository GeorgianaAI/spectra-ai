import OpenAI from "openai";
import { downloadFromS3 } from "../../lib/s3-client";
import { VisionInputSchema, VisionOutputSchema, type VisionOutput } from "../../lib/schemas";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function visionNode(
  state: Record<string, unknown>,
): Promise<{ visionOutput: VisionOutput }> {
  const input = VisionInputSchema.parse(state);

  const imageBuffer = await downloadFromS3(input.s3Key);
  const base64Image = imageBuffer.toString("base64");

  // Detect MIME type from key extension
  const ext = input.s3Key.split(".").pop()?.toLowerCase() ?? "jpeg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  const mimeType = mimeMap[ext] ?? "image/jpeg";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
          {
            type: "text",
            text: `Analyse this image as part of a multimodal intelligence pipeline.

Extract the following and respond with ONLY a JSON object:
{
  "rawDescription": "A thorough description of the image",
  "findings": ["Key factual observations, anomalies, or intelligence-relevant details"],
  "annotations": [
    { "label": "entity or region label", "confidence": 0.0-1.0, "boundingDescription": "optional spatial description" }
  ]
}

Focus on: entities present, spatial relationships, anomalies, text visible in the image, and any indicators of the image's operational context.`,
          },
        ],
      },
    ],
  });

  let parsedResult: {
    rawDescription: string;
    findings: string[];
    annotations: VisionOutput["annotations"];
  };
  try {
    const text = response.choices[0]?.message?.content ?? "";
    const cleaned = text.trim().replace(/^```json\n?|```$/g, "");
    parsedResult = JSON.parse(cleaned);
  } catch {
    parsedResult = {
      rawDescription: response.choices[0]?.message?.content ?? "Image processed",
      findings: ["Visual analysis complete — structured extraction unavailable"],
      annotations: [],
    };
  }

  const output = VisionOutputSchema.parse(parsedResult);
  return { visionOutput: output };
}
