import { count, eq } from 'drizzle-orm';

import { db } from '@/db';
import { polarClient } from '@/lib/polar';
import { agents, meetings } from '@/db/schema';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

export const premiumRouter = createTRPCRouter({
  getFreeUsage: protectedProcedure.query(async ({ ctx }) => {
    // Obtener el estado del cliente en Polar usando el ID externo (ID del usuario en tu sistema)
    const customer = await polarClient.customers.getStateExternal({
      externalId: ctx.auth.user.id,
    });

    // Obtener la suscripción activa del cliente
    const subscription = customer.activeSubscriptions[0];

    // Si hay suscripción activa, el usuario está en el plan premium
    if (subscription) {
      return null;
    }

    // Contar las reuniones y agentes del usuario
    const [userMeetings] = await db
      .select({
        count: count(meetings.id),
      })
      .from(meetings)
      .where(eq(meetings.userId, ctx.auth.user.id));

    const [userAgents] = await db
      .select({
        count: count(agents.id),
      })
      .from(agents)
      .where(eq(agents.userId, ctx.auth.user.id));

    return {
      meetingCount: userMeetings.count,
      agentCount: userAgents.count,
    };
  }),

  getProducts: protectedProcedure.query(async () => {
    // Obtener los productos desde Polar
    const products = await polarClient.products.list({
      isArchived: false,
      isRecurring: true,
      sorting: ['price_amount'],
    });

    return products.result.items;
  }),

  getCurrentSubscription: protectedProcedure.query(async ({ ctx }) => {
    // Obtener el estado del cliente en Polar usando el ID externo (ID del usuario en tu sistema)
    const customer = await polarClient.customers.getStateExternal({
      externalId: ctx.auth.user.id,
    });

    // Obtener la suscripción activa del cliente
    const subscription = customer.activeSubscriptions[0];

    if (!subscription) {
      return null;
    }

    // Obtener el producto asociado a la suscripción
    const product = await polarClient.products.get({
      id: subscription.productId,
    });

    return product;
  }),
});
