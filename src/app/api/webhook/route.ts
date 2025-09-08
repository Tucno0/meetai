import { and, eq, not } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import {
  // CallEndedEvent,
  // CallTranscriptionReadyEvent,
  // CallRecordingReadyEvent,
  CallSessionParticipantLeftEvent,
  CallSessionStartedEvent,
} from '@stream-io/node-sdk';

import { db } from '@/db';
import { agents, meetings } from '@/db/schema';
import { streamVideo } from '@/lib/stream-video';

function verifySignatureWithSDK(body: string, signature: string): boolean {
  return streamVideo.verifyWebhook(body, signature);
}

export async function POST(req: NextRequest) {
  // Obtenemos los headers de autenticación de stream-io
  const signature = req.headers.get('x-signature');
  const apiKey = req.headers.get('x-api-key');

  // Verificamos que existan los headers necesarios
  if (!signature || !apiKey) {
    return NextResponse.json(
      { error: 'Missing signature or API key' },
      { status: 400 }
    );
  }

  // Obtenemos el body de la petición
  const body = await req.text();

  // Verificamos la firma del webhook
  if (!verifySignatureWithSDK(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;

  try {
    // Parseamos el body de la petición
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    // Si el body no es un JSON válido, respondemos con un error
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Obtenemos el tipo de evento
  const eventType = (payload as Record<string, unknown>)?.type;

  // Verificamos que el evento sea uno de los que nos interesan
  if (eventType === 'call.session_started') {
    console.log('➡️ Webhook received: call.session_started');
    // Manejamos el evento call.session.started
    const event = payload as CallSessionStartedEvent;

    // Extraemos el meetingId del evento
    const meetingId = event.call.custom?.meetingId;

    if (!meetingId) {
      console.log('❌ Missing meetingId in call.custom');
      return NextResponse.json(
        { error: 'Missing meetingId in call.custom' },
        { status: 400 }
      );
    }

    // Verificamos que el meetingId exista en la base de datos y que no esté completado o cancelado
    const [existingtMeeting] = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.id, meetingId),
          not(eq(meetings.status, 'completed')),
          not(eq(meetings.status, 'active')),
          not(eq(meetings.status, 'cancelled')),
          not(eq(meetings.status, 'processing'))
        )
      );

    if (!existingtMeeting) {
      console.log('❌ Meeting not found or already completed/cancelled');
      return NextResponse.json(
        { error: 'Meeting not found or already completed/cancelled' },
        { status: 404 }
      );
    }

    // Actualizamos el estado del meeting a 'active' y seteamos la fecha de inicio
    await db
      .update(meetings)
      .set({ status: 'active', startedAt: new Date() })
      .where(eq(meetings.id, existingtMeeting.id));

    // Verificamos que el agente asignado al meeting exista
    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existingtMeeting.agentId));

    if (!existingAgent) {
      console.log('❌ Agent not found');
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Iniciamos la llamada con el SDK de stream-io
    const call = streamVideo.video.call('default', meetingId);

    // Conectamos el agente a la llamada y le habilitamos el asistente de OpenAI
    const realtimeClient = await streamVideo.video.connectOpenAi({
      call,
      openAiApiKey: process.env.OPENAI_API_KEY!,
      agentUserId: existingAgent.id,
    });

    // Actualizamos las instrucciones del agente en el cliente de OpenAI
    // Le pasamos las instrucciones que tenemos guardadas en la base de datos de nuestro agente
    realtimeClient.updateSession({
      instructions: existingAgent.instructions,
    });
  } else if (eventType === 'call.session_participant_left') {
    console.log('➡️ Webhook received: call.session_participant_left');

    // Manejamos el evento call.session.participant_left
    const event = payload as CallSessionParticipantLeftEvent;

    // Extraemos el meetingId del evento
    const meetingId = event.call_cid.split(':')[1];

    if (!meetingId) {
      console.log('❌ Missing meetingId in call_cid');
      return NextResponse.json(
        { error: 'Missing meetingId in call_cid' },
        { status: 400 }
      );
    }

    // Nos conectamos a la llamada con el SDK de stream-io
    const call = streamVideo.video.call('default', meetingId);
    // Terminamos la llamada
    await call.end();
  }

  return NextResponse.json({ status: 'ok' });
}
