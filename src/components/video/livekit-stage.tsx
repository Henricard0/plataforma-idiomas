"use client";

import "@livekit/components-styles";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  VideoConference,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

/**
 * Sala de vídeo.
 * - "conference" (aulas): grade com todos, compartilhamento de tela e chat interno da chamada.
 * - "broadcast" (lives): só aparece quem transmite (o professor); o público assiste
 *   sem virar um quadradinho na tela, então funciona com muita gente.
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
  onLeave: () => void;
  onError: (error: Error) => void;
  onDeviceWarning: (message: string) => void;
}) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      video={publish}
      audio={publish}
      onDisconnected={onLeave}
      onError={onError}
      onMediaDeviceFailure={(_failure, kind) =>
        onDeviceWarning(
          kind === "audioinput"
            ? "Não conseguimos usar o microfone. Confira a permissão no cadeado ao lado do endereço do site."
            : "Não conseguimos usar a câmera. Confira a permissão no cadeado ao lado do endereço do site.",
        )
      }
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
