import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from '@/constants';
import { db } from '@/db';
import { agents, meetings } from '@/db/schema';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, getTableColumns, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';
import { meetingsInsertSchema, meetingsUpdateSchema } from '../schemmas';
import { MeetingStatus } from '../types';

export const meetingsRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(MIN_PAGE_SIZE)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
        agentId: z.string().nullish(),
        status: z
          .enum([
            MeetingStatus.Upcoming,
            MeetingStatus.Active,
            MeetingStatus.Completed,
            MeetingStatus.Processing,
            MeetingStatus.Cancelled,
          ])
          .nullish(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { page, pageSize, search, agentId, status } = input;

      const data = await db
        .select({
          ...getTableColumns(meetings), // Selecciona todas las columnas de meetings
          agent: agents, // Selecciona todas las columnas de agents
          // Calcula la duración de la reunión en segundos
          duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as(
            'duration'
          ),
        })
        .from(meetings) // Selecciona todas las columnas de meetings
        .innerJoin(agents, eq(meetings.agentId, agents.id)) // Realiza un INNER JOIN con la tabla agents
        .where(
          and(
            eq(meetings.userId, ctx.auth.user.id), // Filtra por el userId del usuario autenticado
            search ? ilike(meetings.name, `%${search}%`) : undefined, // Si se proporciona un término de búsqueda, filtra por el nombre de la reunión
            status ? eq(meetings.status, status) : undefined, // Si se proporciona un estado, filtra por el estado de la reunión
            agentId ? eq(meetings.agentId, agentId) : undefined // Si se proporciona un agentId, filtra por agentId
          )
        )
        .orderBy(desc(meetings.createdAt), desc(meetings.id)) // Ordena por createdAt e id en orden descendente
        .limit(pageSize) // Limita el número de resultados por página
        .offset((page - 1) * pageSize); // Paginación

      // Obtiene el total de reuniones del usuario autenticado con el filtro de búsqueda aplicado
      const [total] = await db
        .select({ count: count() })
        .from(meetings)
        .innerJoin(agents, eq(meetings.agentId, agents.id))
        .where(
          and(
            eq(meetings.userId, ctx.auth.user.id),
            search ? ilike(meetings.name, `%${search}%`) : undefined,
            status ? eq(meetings.status, status) : undefined,
            agentId ? eq(meetings.agentId, agentId) : undefined
          )
        );

      const totalPages = Math.ceil(total.count / pageSize);

      return {
        items: data,
        total: total.count,
        totalPages,
      };
    }),

  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const [existingMeeting] = await db
        .select({
          ...getTableColumns(meetings),
        })
        .from(meetings)
        .where(
          and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id))
        );

      if (!existingMeeting) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Meeting not found',
        });
      }

      return existingMeeting;
    }),

  create: protectedProcedure
    .input(meetingsInsertSchema)
    .mutation(async ({ input, ctx }) => {
      const [createdMeeting] = await db
        .insert(meetings)
        .values({
          ...input,
          userId: ctx.auth.user.id,
        })
        .returning();

      // TODO: Create Stream Call, Upsert Stream Users

      return createdMeeting;
    }),

  update: protectedProcedure
    .input(meetingsUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const [updatedMeeting] = await db
        .update(meetings)
        .set(input)
        .where(
          and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id))
        )
        .returning();

      if (!updatedMeeting) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Meeting not found',
        });
      }

      return updatedMeeting;
    }),
});
