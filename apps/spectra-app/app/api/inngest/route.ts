import { serve } from "inngest/next";
import { inngest, processJobFn } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({ client: inngest, functions: [processJobFn] });
