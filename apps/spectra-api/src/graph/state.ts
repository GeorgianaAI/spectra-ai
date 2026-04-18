import { Annotation } from '@langchain/langgraph';
import type {
  DocumentOutput,
  RouterOutput,
  VisionOutput,
  AudioOutput,
  SynthesisOutput,
  AuditorOutput,
} from '../lib/schemas';

export const SpectraStateAnnotation = Annotation.Root({
  jobId: Annotation<string>(),
  userId: Annotation<string>(),
  s3Keys: Annotation<RouterOutput['s3Keys']>(),
  activeModalities: Annotation<Array<'document' | 'vision' | 'audio'>>(),
  documentOutput: Annotation<DocumentOutput | undefined>({
    default: () => undefined,
    reducer: (_, y) => y,
  }),
  visionOutput: Annotation<VisionOutput | undefined>({
    default: () => undefined,
    reducer: (_, y) => y,
  }),
  audioOutput: Annotation<AudioOutput | undefined>({
    default: () => undefined,
    reducer: (_, y) => y,
  }),
  synthesisOutput: Annotation<SynthesisOutput | undefined>({
    default: () => undefined,
    reducer: (_, y) => y,
  }),
  auditorOutput: Annotation<AuditorOutput | undefined>({
    default: () => undefined,
    reducer: (_, y) => y,
  }),
});

export type SpectraState = typeof SpectraStateAnnotation.State;
