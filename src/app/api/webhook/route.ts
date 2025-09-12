import { and, eq, not } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

import {
  CallEndedEvent,
  CallTranscriptionReadyEvent,
  CallRecordingReadyEvent,
  CallSessionParticipantLeftEvent,
  CallSessionStartedEvent,
  MessageNewEvent,
} from '@stream-io/node-sdk';

import { db } from '@/db';
import { agents, meetings } from '@/db/schema';
import { streamVideo } from '@/lib/stream-video';
import { inngest } from '@/inngest/client';
import { generateAvatarUri } from '@/lib/avatar';
import { streamChat } from '@/lib/stream-chat';

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    // Evento de inicio de llamada
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
    // Evento de participante que se va de la llamada
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
  } else if (eventType === 'call.session_ended') {
    // Evento de llamada terminada
    console.log('➡️ Webhook received: call.session_ended');

    // Manejamos el evento call.session.ended
    const event = payload as CallEndedEvent;

    // Extraemos el meetingId del evento
    const meetingId = event.call.custom?.meetingId;

    if (!meetingId) {
      console.log('❌ Missing meetingId in call.custom');
      return NextResponse.json(
        { error: 'Missing meetingId in call.custom' },
        { status: 400 }
      );
    }

    // Actualizamos el estado del meeting a 'completed' y seteamos la fecha de finalización
    await db
      .update(meetings)
      .set({ status: 'processing', endedAt: new Date() })
      .where(and(eq(meetings.id, meetingId), eq(meetings.status, 'active')));
  } else if (eventType === 'call.transcription_ready') {
    // Evento de transcripción lista
    console.log('➡️ Webhook received: call.transcription_ready');

    // Manejamos el evento call.transcription.ready
    const event = payload as CallTranscriptionReadyEvent;
    // Extraemos el meetingId del evento
    const meetingId = event.call_cid.split(':')[1];

    if (!meetingId) {
      console.log('❌ Missing meetingId in call_cid');
      return NextResponse.json(
        { error: 'Missing meetingId in call_cid' },
        { status: 400 }
      );
    }

    // Actualizamos la transcripción del meeting en la base de datos
    const [updatedMeeting] = await db
      .update(meetings)
      .set({ transcriptUrl: event.call_transcription.url })
      .where(eq(meetings.id, meetingId))
      .returning();

    if (!updatedMeeting) {
      console.log('❌ Meeting not found');
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Enviamos el evento a Inngest para que procese la transcripción y genere el resumen
    await inngest.send({
      name: 'meetings/processing',
      data: {
        meetingId: updatedMeeting.id,
        transcriptUrl: event.call_transcription.url,
      },
    });
  } else if (eventType === 'call.recording_ready') {
    // Evento de grabación lista
    console.log('➡️ Webhook received: call.recording_ready');
    // Manejamos el evento call.recording.ready
    const event = payload as CallRecordingReadyEvent;
    // Extraemos el meetingId del evento
    const meetingId = event.call_cid.split(':')[1]; // call_cid tiene el formato "type:meetingId"

    if (!meetingId) {
      console.log('❌ Missing meetingId in call_cid');
      return NextResponse.json(
        { error: 'Missing meetingId in call_cid' },
        { status: 400 }
      );
    }

    // Actualizamos la grabación del meeting en la base de datos
    await db
      .update(meetings)
      .set({ recordingUrl: event.call_recording.url })
      .where(eq(meetings.id, meetingId));
  } else if (eventType === 'message.new') {
    // Evento de nuevo mensaje en el chat
    console.log('➡️ Webhook received: message.new');

    // Manejamos el evento message.new
    const event = payload as MessageNewEvent;

    // Extraemos los datos que nos interesan del mensaje nuevo
    const userId = event.user?.id;
    const channelId = event.channel_id;
    const text = event.message?.text;

    // Validamos que se hayan recibido todos los datos necesarios
    if (!userId || !channelId || !text) {
      console.log('❌ Missing userId, channelId or text in message.new');
      return NextResponse.json(
        { error: 'Missing userId, channelId or text in message.new' },
        { status: 400 }
      );
    }

    // Verificamos que el meetingId exista en la base de datos y que esté completado
    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, channelId), eq(meetings.status, 'completed')));

    if (!existingMeeting) {
      console.log('❌ Meeting not found or not completed');
      return NextResponse.json(
        { error: 'Meeting not found or not completed' },
        { status: 404 }
      );
    }

    // Verificamos si el agente ya existe en la base de datos de agentes
    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existingMeeting.agentId));

    if (!existingAgent) {
      console.log('❌ Agent not found');
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (userId !== existingAgent.id) {
      const instructions = `
        You are an AI assistant helping the user revisit a recently completed meeting.
        Below is a summary of the meeting, generated from the transcript:
        
        ${existingMeeting.summary}
        
        The following are your original instructions from the live meeting assistant. Please continue to follow these behavioral guidelines as you assist the user:
        
        ${existingAgent.instructions}
        
        The user may ask questions about the meeting, request clarifications, or ask for follow-up actions.
        Always base your responses on the meeting summary above.
        
        You also have access to the recent conversation history between you and the user. Use the context of previous messages to provide relevant, coherent, and helpful responses. If the user's question refers to something discussed earlier, make sure to take that into account and maintain continuity in the conversation.
        
        If the summary does not contain enough information to answer a question, politely let the user know.
        
        Be concise, helpful, and focus on providing accurate information from the meeting and the ongoing conversation.
      `;

      // Obtenemos el historial reciente de mensajes en el canal
      const channel = streamChat.channel('messaging', channelId);
      // Nos conectamos al canal
      await channel.watch();

      // Nos traemos los últimos 5 mensajes del canal para contexto
      // Filtramos los mensajes que no tengan texto (por ejemplo, mensajes que solo contienen archivos adjuntos)
      const previusMessages = channel.state.messages
        .slice(-5)
        .filter((msg) => msg.text && msg.text.trim() !== '')
        .map<ChatCompletionMessageParam>((message) => ({
          role: message.user?.id === existingAgent.id ? 'assistant' : 'user',
          content: message.text || '',
        }));

      // Creamos la solicitud a la API de OpenAI para generar la respuesta del asistente
      const GPTResponse = await openaiClient.chat.completions.create({
        messages: [
          { role: 'system', content: instructions },
          ...previusMessages,
          { role: 'user', content: text },
        ],
        model: 'gpt-4o',
      });

      // Obtenemos el texto de la respuesta generada por OpenAI
      const GTPResponseText = GPTResponse.choices[0].message.content;

      if (!GTPResponseText) {
        console.log('❌ No response from OpenAI');
        return NextResponse.json(
          { error: 'No response from OpenAI' },
          { status: 400 }
        );
      }

      // Generamos una URL de avatar para el asistente basado en el nombre del agente
      const avatarUrl = generateAvatarUri({
        seed: existingAgent.name,
        variant: 'botttsNeutral',
      });

      streamChat.upsertUser({
        id: existingAgent.id,
        name: existingAgent.name,
        image: avatarUrl,
      });

      channel.sendMessage({
        text: GTPResponseText,
        user: {
          id: existingAgent.id,
          name: existingAgent.name,
          image: avatarUrl,
        },
      });
    }
  }

  return NextResponse.json({ status: 'ok' });
}
