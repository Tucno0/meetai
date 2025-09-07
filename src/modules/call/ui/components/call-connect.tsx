'use client';

import { useEffect, useState } from 'react';
import { LoaderIcon } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import {
  Call,
  CallingState,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';

import { useTRPC } from '@/trpc/client';
import { CallUI } from './call-ui';

interface CallConnectProps {
  meetingId: string;
  meetingName: string;
  userId: string;
  userName: string;
  userImage: string;
}

export const CallConnect = ({
  meetingId,
  meetingName,
  userId,
  userName,
  userImage,
}: CallConnectProps) => {
  const trpc = useTRPC();
  const { mutateAsync: generateToken } = useMutation(
    trpc.meetings.generateToken.mutationOptions({})
  );

  const [client, setClient] = useState<StreamVideoClient>();

  useEffect(() => {
    // Creamos el cliente de video stream
    const _client = new StreamVideoClient({
      apiKey: process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!, // Clave de API de Stream Video
      user: {
        // Datos del usuario que se conecta
        id: userId,
        name: userName,
        image: userImage,
      },
      tokenProvider: generateToken, // Función para generar el token de autenticación
    });

    // Conectamos el usuario
    setClient(_client);

    return () => {
      // Desconectamos el usuario al desmontar el componente
      _client.disconnectUser();
      setClient(undefined);
    };
  }, [generateToken, userId, userName, userImage]);

  const [call, setCall] = useState<Call>();

  useEffect(() => {
    if (!client) return;

    const _call = client.call('default', meetingId);
    _call.camera.disable();
    _call.microphone.disable();
    setCall(_call);

    return () => {
      if (_call.state.callingState !== CallingState.LEFT) {
        _call.leave();
        _call.endCall();
        setCall(undefined);
      }
    };
  }, [client, meetingId]);

  if (!client || !call) {
    return (
      <div className="flex h-screen items-center justify-center bg-radial from-sidebar-accent to-sidebar">
        <LoaderIcon className="size-6 animate-spin text-white" />
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI meetingName={meetingName} />
      </StreamCall>
    </StreamVideo>
  );
};
