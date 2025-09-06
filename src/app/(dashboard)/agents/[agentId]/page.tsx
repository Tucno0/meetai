import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { HydrateClient, prefetch, trpc } from '@/trpc/server';
import {
  AgentIdView,
  AgentIdViewError,
  AgentIdViewLoading,
} from '@/modules/agents/ui/views/agent-id-view';

interface Props {
  params: Promise<{ agentId: string }>;
}

const AgentIdPage = async ({ params }: Props) => {
  const { agentId } = await params;

  prefetch(trpc.agents.getOne.queryOptions({ id: agentId }));

  return (
    <HydrateClient>
      <Suspense fallback={<AgentIdViewLoading />}>
        <ErrorBoundary fallback={<AgentIdViewError />}>
          <AgentIdView agentId={agentId} />
        </ErrorBoundary>
      </Suspense>
    </HydrateClient>
  );
};

export default AgentIdPage;
