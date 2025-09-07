import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { ErrorBoundary } from 'react-error-boundary';

import { auth } from '@/lib/auth';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

import {
  MeetingIdView,
  MeetingIdViewError,
  MeetingIdViewLoading,
} from '@/modules/meetings/ui/views/meeting-id-view';

interface MeetingIdPageProps {
  params: Promise<{ meetingId: string }>;
}

const MeetingIdPage = async ({ params }: MeetingIdPageProps) => {
  const { meetingId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  prefetch(trpc.meetings.getOne.queryOptions({ id: meetingId }));

  return (
    <HydrateClient>
      <Suspense fallback={<MeetingIdViewLoading />}>
        <ErrorBoundary fallback={<MeetingIdViewError />}>
          <MeetingIdView meetingId={meetingId} />
        </ErrorBoundary>
      </Suspense>
    </HydrateClient>
  );
};

export default MeetingIdPage;
