/**
 * Bedrock client — used exclusively by routerNode for Nova Micro classification.
 * All other model calls use the Anthropic SDK or OpenAI SDK directly.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION ?? process.env.AWS_REGION_OVERRIDE ?? "eu-west-1";
const MODEL_ID = process.env.BEDROCK_NOVA_MICRO_MODEL_ID ?? "amazon.nova-micro-v1:0";

export const bedrockClient = new BedrockRuntimeClient({ region: REGION });

export interface NovaMessage {
  role: "user" | "assistant";
  content: string;
}

export interface NovaResponse {
  output: {
    message: {
      role: string;
      content: Array<{ text: string }>;
    };
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function invokeNovaMicro(
  messages: NovaMessage[],
  systemPrompt?: string,
): Promise<string> {
  const payload = {
    messages: messages.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    ...(systemPrompt && {
      system: [{ text: systemPrompt }],
    }),
    inferenceConfig: {
      maxTokens: 512,
      temperature: 0,
    },
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await bedrockClient.send(command);
  const decoded = JSON.parse(Buffer.from(response.body).toString("utf-8")) as NovaResponse;

  return decoded.output.message.content[0]?.text ?? "";
}
