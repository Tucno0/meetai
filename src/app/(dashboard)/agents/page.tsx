import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';

import { HydrateClient, prefetch, trpc } from '@/trpc/server';
import { auth } from '@/lib/auth';
import {
  AgentsView,
  AgentsViewError,
  AgentsViewLoading,
} from '@/modules/agents/ui/views/agents-view';
import { AgentsListHeader } from '@/modules/agents/ui/components/agents-list-header';

const AgentsPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  prefetch(trpc.agents.getMany.queryOptions());

  return (
    <>
      <AgentsListHeader />

      <HydrateClient>
        <Suspense fallback={<AgentsViewLoading />}>
          <ErrorBoundary fallback={<AgentsViewError />}>
            <AgentsView />
          </ErrorBoundary>
        </Suspense>
      </HydrateClient>
    </>
  );
};

export default AgentsPage;
