import { serve } from "inngest/next";
import { inngest, processJobFn, keepaliveFn } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processJobFn, keepaliveFn],
});
