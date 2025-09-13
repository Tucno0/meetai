'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { toast } from 'sonner';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';

import { useTRPC } from '@/trpc/client';

import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { MeetingIdViewHeader } from '../components/meeting-id-view-header';
import { UpdateMeetingDialog } from '../components/update-meeting-dialog';
import { UpcomingState } from '../components/upcoming-state';
import { ActiveState } from '../components/active-state';
import { CancelledState } from '../components/cancelled-state';
import { ProcessingState } from '../components/processing-state';
import { useConfirm } from '@/hooks/use-confirm';
import { CompletedState } from '../components/completed-state';

interface MeetingIdViewProps {
  meetingId: string;
}

export const MeetingIdView = ({ meetingId }: MeetingIdViewProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [updateMeetingDialogOpen, setUpdateMeetingDialogOpen] = useState(false);

  const { data } = useSuspenseQuery(
    trpc.meetings.getOne.queryOptions({ id: meetingId })
  );

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    'Are you sure?',
    'The following action will remove this meeting'
  );

  const removeMeeting = useMutation(
    trpc.meetings.remove.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.meetings.getMany.queryOptions({}));
        queryClient.invalidateQueries(trpc.premium.getFreeUsage.queryOptions());
        router.push('/meetings');
      },

      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const handleRemoveMeeting = async () => {
    const confirmed = await confirmRemove();
    if (!confirmed) return;
    await removeMeeting.mutateAsync({ id: meetingId });
  };

  const isActive = data.status === 'active';
  const isUpcoming = data.status === 'upcoming';
  const isCancelled = data.status === 'cancelled';
  const isCompleted = data.status === 'completed';
  const isProcessing = data.status === 'processing';

  return (
    <>
      <RemoveConfirmation />

      <UpdateMeetingDialog
        open={updateMeetingDialogOpen}
        onOpenChange={setUpdateMeetingDialogOpen}
        initialValues={data}
      />

      <div className="flex-1 py-4 px-4 md:px-8 flex flex-col gap-y-4">
        <MeetingIdViewHeader
          meetingId={meetingId}
          meetingName={data.name}
          onEdit={() => setUpdateMeetingDialogOpen(true)}
          onRemove={handleRemoveMeeting}
        />

        {isActive && <ActiveState meetingId={meetingId} />}

        {isUpcoming && <UpcomingState meetingId={meetingId} />}

        {isCancelled && <CancelledState />}

        {isProcessing && <ProcessingState />}

        {isCompleted && <CompletedState data={data} />}
      </div>
    </>
  );
};

export const MeetingIdViewLoading = () => {
  return (
    <LoadingState
      title="Loading Meeting"
      description="This may take a few seconds..."
    />
  );
};

export const MeetingIdViewError = () => {
  return (
    <ErrorState
      title="Error loading Meeting"
      description="Something went wrong"
    />
  );
};
