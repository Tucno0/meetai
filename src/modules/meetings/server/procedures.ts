import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  sql,
} from 'drizzle-orm';
import JSONL from 'jsonl-parse-stringify';
import { z } from 'zod';

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from '@/constants';
import { db } from '@/db';
import { agents, meetings, user } from '@/db/schema';
import { TRPCError } from '@trpc/server';
import {
  createTRPCRouter,
  premiumProcedure,
  protectedProcedure,
} from '@/trpc/init';
import { streamVideo } from '@/lib/stream-video';
import { generateAvatarUri } from '@/lib/avatar';

import { meetingsInsertSchema, meetingsUpdateSchema } from '../schemmas';
import { MeetingStatus, StreamTranscriptItem } from '../types';
import { streamChat } from '@/lib/stream-chat';

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
          agent: agents,
          // Calcula la duración de la reunión en segundos
          duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as(
            'duration'
          ),
        })
        .from(meetings)
        .innerJoin(agents, eq(meetings.agentId, agents.id)) // Join con la tabla agents
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

  create: premiumProcedure('meetings')
    .input(meetingsInsertSchema)
    .mutation(async ({ input, ctx }) => {
      const [createdMeeting] = await db
        .insert(meetings)
        .values({
          ...input,
          userId: ctx.auth.user.id,
        })
        .returning();

      // Creamos una llamada en Stream Video asociada a la reunión creada
      const call = streamVideo.video.call('default', createdMeeting.id);
      await call.create({
        data: {
          created_by_id: ctx.auth.user.id, // ID del usuario que crea la reunión
          custom: {
            // Datos personalizados
            meetingId: createdMeeting.id, // ID de la reunión en nuestra base de datos
            meetingName: createdMeeting.name, // Nombre de la reunión
          },
          settings_override: {
            // Configuraciones personalizadas para la llamada
            transcription: {
              // Configuración de transcripción
              language: 'en', // Idioma de la transcripción
              mode: 'auto-on', // Modo de transcripción
              closed_caption_mode: 'auto-on', // Modo de subtítulos
            },
            recording: {
              // Configuración de grabación
              mode: 'auto-on', // Modo de grabación
              quality: '1080p', // Calidad de la grabación
            },
          },
        },
      });

      // Verificamos que el agentId proporcionado exista
      const [existingAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, createdMeeting.agentId));

      if (!existingAgent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent not found',
        });
      }

      // Agregamos o actualizamos el agente en Stream Video como usuario
      await streamVideo.upsertUsers([
        {
          id: existingAgent.id,
          name: existingAgent.name,
          role: 'user',
          image: generateAvatarUri({
            seed: existingAgent.name,
            variant: 'botttsNeutral',
          }),
        },
      ]);
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

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [removedMeeting] = await db
        .delete(meetings)
        .where(
          and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id))
        )
        .returning();

      if (!removedMeeting) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Meeting not found',
        });
      }

      return removedMeeting;
    }),

  generateToken: protectedProcedure.mutation(async ({ ctx }) => {
    // Agregamos o actualizamos el usuario en Stream Video
    await streamVideo.upsertUsers([
      {
        id: ctx.auth.user.id,
        name: ctx.auth.user.name,
        role: 'admin',
        image:
          ctx.auth.user.image ??
          generateAvatarUri({ seed: ctx.auth.user.name, variant: 'initials' }),
      },
    ]);

    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // expira en 1 hora
    const issuedAt = Math.floor(Date.now() / 1000) - 60; // emitido hace 1 minuto

    // Generamos el token de Stream Video para el usuario autenticado
    const token = streamVideo.generateUserToken({
      user_id: ctx.auth.user.id,
      expiration: expirationTime,
      validity_in_seconds: issuedAt, // tiempo de validez
    });

    return token;
  }),

  getTranscript: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [existingMeeting] = await db
        .select()
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

      if (!existingMeeting.transcriptUrl) {
        return [];
      }

      const transcript = await fetch(existingMeeting.transcriptUrl)
        .then((res) => res.text())
        .then((text) => JSONL.parse<StreamTranscriptItem>(text))
        .catch(() => {
          return [];
        });

      const speakerIds = [
        ...new Set(transcript.map((item) => item.speaker_id)),
      ];

      const userSpeakers = await db
        .select()
        .from(user)
        .where(inArray(user.id, speakerIds))
        .then((users) =>
          users.map((user) => ({
            ...user,
            image:
              user.image ??
              generateAvatarUri({ seed: user.name, variant: 'initials' }),
          }))
        );

      const agentSpeakers = await db
        .select()
        .from(agents)
        .where(inArray(agents.id, speakerIds))
        .then((agents) =>
          agents.map((agent) => ({
            ...agent,
            image: generateAvatarUri({
              seed: agent.name,
              variant: 'botttsNeutral',
            }),
          }))
        );

      const speakers = [...userSpeakers, ...agentSpeakers];

      const transcriptWithSpeakers = transcript.map((item) => {
        const speaker = speakers.find(
          (speaker) => speaker.id === item.speaker_id
        );

        if (!speaker)
          return {
            ...item,
            user: {
              name: 'Unknown',
              image: generateAvatarUri({
                seed: 'Unknown',
                variant: 'initials',
              }),
            },
          };

        return {
          ...item,
          user: {
            name: speaker.name,
            image: speaker.image,
          },
        };
      });

      return transcriptWithSpeakers;
    }),

  generateChatToken: protectedProcedure.mutation(async ({ ctx }) => {
    // Creamos el token de Stream Chat para el usuario autenticado
    const token = streamChat.createToken(ctx.auth.user.id);

    await streamChat.upsertUser({
      id: ctx.auth.user.id,
      role: 'admin',
    });

    return token;
  }),
});
