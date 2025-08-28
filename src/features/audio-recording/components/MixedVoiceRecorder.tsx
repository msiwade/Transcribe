import React, { useRef, useEffect, useState, memo } from "react";
import { IconButton, Box, Tooltip, Typography } from "@mui/material";
import { Mic as MicIcon, Stop as StopIcon } from "@mui/icons-material";
import { startTranscribeStreaming } from "../../../shared/services/streamingTranscribeService";
import { AudioDeviceSelector } from "../../device-management";
import type { VoiceRecorderProps } from "../../../shared/types/transcription";

export interface MixedVoiceRecorderRef {
  stopRecording: () => void;
  clearAccumulatedText: () => void;
}

const MixedVoiceRecorder = React.forwardRef<
  MixedVoiceRecorderRef,
  VoiceRecorderProps
>(({ onTranscriptionResult, disabled = false }, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [myDeviceId, setMyDeviceId] = useState("");
  const [otherDeviceId, setOtherDeviceId] = useState("");

  const myStreamRef = useRef<MediaStream | null>(null);
  const otherStreamRef = useRef<MediaStream | null>(null);
  const isStoppedManuallyRef = useRef(false);
  const accumulatedTranscriptRef = useRef<string>("");
  const myTranscribeControllerRef = useRef<AbortController | null>(null);
  const otherTranscribeControllerRef = useRef<AbortController | null>(null);
  const isInitializedRef = useRef(false);

  const initializeRecorder = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("このブラウザは音声録音をサポートしていません");
      }
      const { createTranscribeStreamingClient } = await import(
        "../../../shared/services/streamingTranscribeService"
      );
      await createTranscribeStreamingClient();
    } catch (error) {
      // エラー時は何もしない
    }
  };

  const startTranscribeStreamingProcess = async () => {
    if (!myStreamRef.current || !otherStreamRef.current) {
      return;
    }

    try {
      myTranscribeControllerRef.current = new AbortController();
      otherTranscribeControllerRef.current = new AbortController();

      // 自分の声の文字起こし
      const myTranscribePromise = startTranscribeStreaming(
        myStreamRef.current,
        (text: string, isFinal: boolean) => {
          if (isFinal) {
            if (text.trim()) {
              const prefixedText = `[自分] ${text}`;
              accumulatedTranscriptRef.current += prefixedText + "\n";
            }
            setTimeout(() => {
              onTranscriptionResult?.(accumulatedTranscriptRef.current);
            }, 100);
          } else {
            if (text.trim()) {
              const prefixedText = `[自分] ${text}`;
              const displayText =
                accumulatedTranscriptRef.current + prefixedText + "\n";
              setTimeout(() => {
                onTranscriptionResult?.(displayText);
              }, 200);
            }
          }
        },
        () => isStoppedManuallyRef.current,
        16000
      );

      // 相手の声の文字起こし
      const otherTranscribePromise = startTranscribeStreaming(
        otherStreamRef.current,
        (text: string, isFinal: boolean) => {
          if (isFinal) {
            if (text.trim()) {
              const prefixedText = `[相手] ${text}`;
              accumulatedTranscriptRef.current += prefixedText + "\n";
            }
            setTimeout(() => {
              onTranscriptionResult?.(accumulatedTranscriptRef.current);
            }, 100);
          } else {
            if (text.trim()) {
              const prefixedText = `[相手] ${text}`;
              const displayText =
                accumulatedTranscriptRef.current + prefixedText + "\n";
              setTimeout(() => {
                onTranscriptionResult?.(displayText);
              }, 200);
            }
          }
        },
        () => isStoppedManuallyRef.current,
        16000
      );

      await Promise.all([myTranscribePromise, otherTranscribePromise]);
    } catch (error) {
      // エラー時は何もしない
    }
  };

  const handleButtonClick = async () => {
    if (isRecording) {
      isStoppedManuallyRef.current = true;

      if (myTranscribeControllerRef.current) {
        myTranscribeControllerRef.current.abort();
        myTranscribeControllerRef.current = null;
      }

      if (otherTranscribeControllerRef.current) {
        otherTranscribeControllerRef.current.abort();
        otherTranscribeControllerRef.current = null;
      }

      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach((track) => track.stop());
        myStreamRef.current = null;
      }

      if (otherStreamRef.current) {
        otherStreamRef.current.getTracks().forEach((track) => track.stop());
        otherStreamRef.current = null;
      }

      accumulatedTranscriptRef.current = "";
      setIsRecording(false);
    } else {
      isStoppedManuallyRef.current = false;
      accumulatedTranscriptRef.current = "";

      try {
        // 自分のデバイス用設定
        const myAudioConstraints: MediaTrackConstraints = {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };

        if (myDeviceId) {
          myAudioConstraints.deviceId = { exact: myDeviceId };
        }

        // 相手のデバイス用設定
        const otherAudioConstraints: MediaTrackConstraints = {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        };

        if (otherDeviceId) {
          otherAudioConstraints.deviceId = { exact: otherDeviceId };
        }

        // 両方のストリームを同時取得
        const [myStream, otherStream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ audio: myAudioConstraints }),
          navigator.mediaDevices.getUserMedia({ audio: otherAudioConstraints }),
        ]);

        myStreamRef.current = myStream;
        otherStreamRef.current = otherStream;
        setIsRecording(true);

        startTranscribeStreamingProcess();
      } catch (err) {
        setIsRecording(false);
      }
    }
  };

  useEffect(() => {
    if (!isInitializedRef.current) {
      initializeRecorder();
      isInitializedRef.current = true;
    }
  }, []);

  const stopRecording = () => {
    if (isRecording) {
      isStoppedManuallyRef.current = true;

      if (myTranscribeControllerRef.current) {
        myTranscribeControllerRef.current.abort();
        myTranscribeControllerRef.current = null;
      }

      if (otherTranscribeControllerRef.current) {
        otherTranscribeControllerRef.current.abort();
        otherTranscribeControllerRef.current = null;
      }

      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach((track) => track.stop());
        myStreamRef.current = null;
      }

      if (otherStreamRef.current) {
        otherStreamRef.current.getTracks().forEach((track) => track.stop());
        otherStreamRef.current = null;
      }

      accumulatedTranscriptRef.current = "";
      setIsRecording(false);
    }
  };

  const clearAccumulatedText = () => {
    accumulatedTranscriptRef.current = "";
  };

  React.useImperativeHandle(ref, () => ({
    stopRecording,
    clearAccumulatedText,
  }));

  const isFirstRenderRef = useRef(true);
  const prevIsRecordingRef = useRef(false);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevIsRecordingRef.current = isRecording;
      return;
    }

    if (prevIsRecordingRef.current !== isRecording) {
      if (isRecording) {
        onTranscriptionResult?.("");
      }
      prevIsRecordingRef.current = isRecording;
    }
  }, [isRecording]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: "400px" }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: "primary.main" }}>
          自分の声（マイク）
        </Typography>
        <AudioDeviceSelector
          selectedDeviceId={myDeviceId}
          onDeviceChange={setMyDeviceId}
          disabled={isRecording}
        />
      </Box>

      <Box sx={{ width: "100%", maxWidth: "400px" }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: "secondary.main" }}>
          相手の声（VB-Audio Virtual Cable）
        </Typography>
        <AudioDeviceSelector
          selectedDeviceId={otherDeviceId}
          onDeviceChange={setOtherDeviceId}
          disabled={isRecording}
          preferVBDevice={true}
        />
      </Box>

      <Tooltip title={isRecording ? "録音停止" : "録音開始"}>
        <IconButton
          onClick={handleButtonClick}
          disabled={disabled || !myDeviceId || !otherDeviceId}
          sx={{
            backgroundColor: isRecording ? "#ff5252" : "#4caf50",
            color: "white",
            width: "40px",
            height: "40px",
            minWidth: "40px",
            "&:hover": {
              backgroundColor: isRecording ? "#d32f2f" : "#388e3c",
            },
            "&:disabled": {
              backgroundColor: "#ccc",
            },
          }}
        >
          {isRecording ? <StopIcon /> : <MicIcon />}
        </IconButton>
      </Tooltip>
    </Box>
  );
});

export default memo(MixedVoiceRecorder);
