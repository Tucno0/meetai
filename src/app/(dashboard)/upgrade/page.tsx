import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';

import { auth } from '@/lib/auth';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';
import {
  UpgradeView,
  UpgradeViewError,
  UpgradeViewLoading,
} from '@/modules/premium/ui/views/upgrade-view';

const UpgradePage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  prefetch(trpc.premium.getCurrentSubscription.queryOptions());
  prefetch(trpc.premium.getProducts.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={<UpgradeViewLoading />}>
        <ErrorBoundary fallback={<UpgradeViewError />}>
          <UpgradeView />
        </ErrorBoundary>
      </Suspense>
    </HydrateClient>
  );
};

export default UpgradePage;
