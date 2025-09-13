'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';

import { ErrorState } from '@/components/error-state';
import { CallProvider } from '../components/call-provider';
import { LoadingState } from '@/components/loading-state';

interface CallViewProps {
  meetingId: string;
}

export const CallView = ({ meetingId }: CallViewProps) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.meetings.getOne.queryOptions({ id: meetingId })
  );

  if (data.status === 'completed') {
    return (
      <div className="flex h-screen items-center justify-center">
        <ErrorState
          title="Meeting has ended"
          description="You can no longer join this meeting"
        />
      </div>
    );
  }

  return <CallProvider meetingId={meetingId} meetingName={data.name} />;
};

export const CallViewLoading = () => {
  return (
    <LoadingState
      title="Loading call..."
      description="Please wait while we connect you to the call."
    />
  );
};

export const CallViewError = () => {
  return (
    <ErrorState
      title="Failed to load call"
      description="There was an issue loading the call. Please try again later."
    />
  );
};
