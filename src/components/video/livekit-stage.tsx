"use client";

import "@livekit/components-styles";
import { useCallback } from "react";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  VideoConference,
  useTracks,
} from "@livekit/components-react";
import { DisconnectReason, MediaDeviceFailure, Track } from "livekit-client";

/**
 * Sala de vídeo.
 * - "conference" (aulas): grade com todos, compartilhamento de tela e chat interno da chamada.
 * - "broadcast" (lives): só aparece quem transmite (o professor); o público assiste
 *   sem virar um quadradinho na tela, então funciona com muita gente.
 *
 * Os callbacks passados para o LiveKitRoom precisam ser estáveis: se mudarem a cada
 * render, o LiveKit tenta conectar de novo e a chamada cai.
 */
export default function LiveKitStage({
  token,
  serverUrl,
  publish,
  mode,
  onLeave,
  onError,
  onDeviceWarning,
}: {
  token: string;
  serverUrl: string;
  publish: boolean;
  mode: "conference" | "broadcast";
  /** Chamado quando a chamada termina; `message` explica o motivo se não foi a pessoa que saiu. */
  onLeave: (message?: string, detail?: string) => void;
  onError: (error: Error) => void;
  onDeviceWarning: (message: string) => void;
}) {
  const handleDisconnected = useCallback(
    (reason?: DisconnectReason) => onLeave(describeDisconnect(reason), reason ? DisconnectReason[reason] : undefined),
    [onLeave],
  );

  // Falha de câmera/microfone não derruba a chamada: a pessoa continua vendo e ouvindo.
  const handleError = useCallback(
    (error: Error) => {
      const failure = MediaDeviceFailure.getFailure(error);
      if (failure) onDeviceWarning(describeDeviceFailure(failure));
      else onError(error);
    },
    [onError, onDeviceWarning],
  );

  const handleDeviceFailure = useCallback(
    (failure?: MediaDeviceFailure) => onDeviceWarning(describeDeviceFailure(failure)),
    [onDeviceWarning],
  );

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      video={publish}
      audio={publish}
      onDisconnected={handleDisconnected}
      onError={handleError}
      onMediaDeviceFailure={handleDeviceFailure}
      data-lk-theme="default"
      style={{ height: "100%" }}
    >
      {mode === "conference" ? (
        <VideoConference />
      ) : (
        <div className="flex h-full flex-col">
          <BroadcastStage />
          <RoomAudioRenderer />
          <ControlBar
            variation="minimal"
            controls={{ microphone: publish, camera: publish, screenShare: publish, chat: false, leave: true }}
          />
        </div>
      )}
    </LiveKitRoom>
  );
}

function describeDeviceFailure(failure?: MediaDeviceFailure) {
  switch (failure) {
    case MediaDeviceFailure.PermissionDenied:
      return "O navegador bloqueou a câmera ou o microfone. Clique no cadeado ao lado do endereço do site, permita e ligue pelos botões da sala.";
    case MediaDeviceFailure.NotFound:
      return "Não encontramos câmera ou microfone neste aparelho. Você continua na sala e vê e ouve os outros normalmente.";
    case MediaDeviceFailure.DeviceInUse:
      return "A câmera ou o microfone está sendo usado por outro programa (Zoom, Teams, outra aba). Feche o outro programa e ligue de novo pelos botões da sala.";
    default:
      return "Não conseguimos ligar a câmera ou o microfone. Você continua na sala; tente ligar de novo pelos botões abaixo.";
  }
}

function describeDisconnect(reason?: DisconnectReason) {
  switch (reason) {
    case undefined:
    case DisconnectReason.CLIENT_INITIATED:
      return undefined; // a própria pessoa saiu
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "Esta mesma conta entrou na sala em outra janela ou aba, então esta foi desconectada. Para testar como aluno, entre com a conta do aluno na janela anônima.";
    case DisconnectReason.PARTICIPANT_REMOVED:
      return "Você foi removido da sala.";
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED:
      return "A sala foi encerrada.";
    case DisconnectReason.USER_REJECTED:
      return "O LiveKit recusou as chaves. Confira se LIVEKIT_API_KEY e LIVEKIT_API_SECRET foram copiadas do mesmo projeto do endereço em NEXT_PUBLIC_LIVEKIT_URL.";
    case DisconnectReason.JOIN_FAILURE:
    case DisconnectReason.CONNECTION_TIMEOUT:
      return "Não foi possível falar com o servidor de vídeo. Confira se NEXT_PUBLIC_LIVEKIT_URL está certo (começa com wss:// e termina com .livekit.cloud) e a sua internet.";
    default:
      return "A conexão com o servidor de vídeo caiu. Confira a internet e clique para entrar de novo.";
  }
}

function BroadcastStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  if (tracks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-white/70">
        Aguardando o professor ligar a câmera…
      </div>
    );
  }

  return (
    <GridLayout tracks={tracks} style={{ flex: 1, minHeight: 0 }}>
      <ParticipantTile />
    </GridLayout>
  );
}
