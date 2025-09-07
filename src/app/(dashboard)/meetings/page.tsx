import {
  MeetingsView,
  MeetingsViewError,
  MeetingsViewLoading,
} from '@/modules/meetings/ui/views/meetings-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

const MeetingsPage = () => {
  prefetch(trpc.meetings.getMany.queryOptions({}));

  return (
    <HydrateClient>
      <Suspense fallback={<MeetingsViewLoading />}>
        <ErrorBoundary fallback={<MeetingsViewError />}>
          <MeetingsView />
        </ErrorBoundary>
      </Suspense>
    </HydrateClient>
  );
};

export default MeetingsPage;
