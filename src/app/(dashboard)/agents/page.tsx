import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { HydrateClient, prefetch, trpc } from '@/trpc/server';
import {
  AgentsView,
  AgentsViewError,
  AgentsViewLoading,
} from '@/modules/agents/ui/views/agents-view';

const AgentsPage = () => {
  prefetch(trpc.agents.getMany.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={<AgentsViewLoading />}>
        <ErrorBoundary fallback={<AgentsViewError />}>
          <AgentsView />
        </ErrorBoundary>
      </Suspense>
    </HydrateClient>
  );
};

export default AgentsPage;
