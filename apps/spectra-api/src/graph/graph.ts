import { MemorySaver } from '@langchain/langgraph';
import { Send, StateGraph } from '@langchain/langgraph';
import { SpectraStateAnnotation, type SpectraState } from './state';
import { routerNode } from './nodes/routerNode';
import { documentNode } from './nodes/documentNode';
import { visionNode } from './nodes/visionNode';
import { audioNode } from './nodes/audioNode';
import { synthesisNode } from './nodes/synthesisNode';
import { auditorNode } from './nodes/auditorNode';

// Route from routerNode to specialist nodes in parallel via Send.
// Only active modalities receive a Send — inactive nodes are skipped.
function routeToSpecialists(state: SpectraState): Send[] {
  const sends: Send[] = [];

  if (state.activeModalities.includes('document') && state.s3Keys.document) {
    sends.push(
      new Send('documentNode', {
        jobId: state.jobId,
        s3Key: state.s3Keys.document,
        userId: state.userId,
      }),
    );
  }

  if (state.activeModalities.includes('vision') && state.s3Keys.image) {
    sends.push(
      new Send('visionNode', {
        jobId: state.jobId,
        s3Key: state.s3Keys.image,
      }),
    );
  }

  if (state.activeModalities.includes('audio') && state.s3Keys.audio) {
    sends.push(
      new Send('audioNode', {
        jobId: state.jobId,
        s3Key: state.s3Keys.audio,
      }),
    );
  }

  // If no modalities are active (edge case), route directly to synthesis
  if (sends.length === 0) {
    sends.push(new Send('synthesisNode', state));
  }

  return sends;
}

const checkpointer = new MemorySaver();

export const spectraGraph = new StateGraph(SpectraStateAnnotation)
  .addNode('routerNode', routerNode)
  // Specialist nodes accept Record<string, unknown> because they receive Send payloads
  .addNode('documentNode', documentNode as unknown as (state: SpectraState) => Promise<Partial<SpectraState>>)
  .addNode('visionNode', visionNode as unknown as (state: SpectraState) => Promise<Partial<SpectraState>>)
  .addNode('audioNode', audioNode as unknown as (state: SpectraState) => Promise<Partial<SpectraState>>)
  .addNode('synthesisNode', synthesisNode)
  .addNode('auditorNode', auditorNode)
  .addEdge('__start__', 'routerNode')
  .addConditionalEdges('routerNode', routeToSpecialists)
  .addEdge('documentNode', 'synthesisNode')
  .addEdge('visionNode', 'synthesisNode')
  .addEdge('audioNode', 'synthesisNode')
  .addEdge('synthesisNode', 'auditorNode')
  .addEdge('auditorNode', '__end__')
  .compile({ checkpointer });
