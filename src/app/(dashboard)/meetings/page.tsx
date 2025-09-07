import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';
import type { SearchParams } from 'nuqs/server';

import { HydrateClient, prefetch, trpc } from '@/trpc/server';
import { auth } from '@/lib/auth';

import { MeetingsListHeader } from '@/modules/meetings/ui/components/meetings-list-header';
import {
  MeetingsView,
  MeetingsViewError,
  MeetingsViewLoading,
} from '@/modules/meetings/ui/views/meetings-view';
import { loadSearcherParams } from '@/modules/meetings/params';

interface MeetingsPageProps {
  searchParams: Promise<SearchParams>;
}

const MeetingsPage = async ({ searchParams }: MeetingsPageProps) => {
  const filters = await loadSearcherParams(searchParams);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  prefetch(trpc.meetings.getMany.queryOptions({ ...filters }));

  return (
    <>
      <MeetingsListHeader />

      <HydrateClient>
        <Suspense fallback={<MeetingsViewLoading />}>
          <ErrorBoundary fallback={<MeetingsViewError />}>
            <MeetingsView />
          </ErrorBoundary>
        </Suspense>
      </HydrateClient>
    </>
  );
};

export default MeetingsPage;
