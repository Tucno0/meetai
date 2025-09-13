import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';

import { auth } from '@/lib/auth';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';
import {
  CallView,
  CallViewError,
  CallViewLoading,
} from '@/modules/call/ui/views/call-view';

interface CallPageProps {
  params: Promise<{ meetingId: string }>;
}

const CallPage = async ({ params }: CallPageProps) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  const { meetingId } = await params;

  prefetch(trpc.meetings.getOne.queryOptions({ id: meetingId }));

  return (
    <HydrateClient>
      <Suspense fallback={<CallViewLoading />}>
        <ErrorBoundary fallback={<CallViewError />}>
          <CallView meetingId={meetingId} />
        </ErrorBoundary>
      </Suspense>
    </HydrateClient>
  );
};

export default CallPage;
