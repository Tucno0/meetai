'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const HomeView = () => {
  const trpc = useTRPC();
  const data = useQuery(trpc.hello.queryOptions({ text: 'from tRPC' }));

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-6">
      {data.data?.greeting}
    </div>
  );
};
