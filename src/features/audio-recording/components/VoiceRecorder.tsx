import React, { useRef, useEffect, useState, memo } from "react";
import { IconButton, Box, Tooltip } from "@mui/material";
import { Mic as MicIcon, Stop as StopIcon } from "@mui/icons-material";
import { startTranscribeStreaming } from "../../../shared/services/streamingTranscribeService";
import { AudioDeviceSelector } from "../../device-management";
import type { VoiceRecorderProps } from "../../../shared/types/transcription";

export interface VoiceRecorderRef {
  stopRecording: () => void;
  clearAccumulatedText: () => void;
}

const VoiceRecorder = React.forwardRef<VoiceRecorderRef, VoiceRecorderProps>(
  ({ onTranscriptionResult, disabled = false }, ref) => {
    const [isRecording, setIsRecording] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState("");

    const mediaStreamRef = useRef<MediaStream | null>(null);
    const isStoppedManuallyRef = useRef(false);
    const accumulatedTranscriptRef = useRef<string>("");
    const transcribeAbortControllerRef = useRef<AbortController | null>(null);
    const isInitializedRef = useRef(false);

    const initializeRecorder = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("このブラウザは音声録音をサポートしていません");
        }
      } catch (error) {
        // エラー時は何もしない
      }
    };

    const startTranscribeStreamingProcess = async () => {
      if (!mediaStreamRef.current) {
        return;
      }

      try {
        transcribeAbortControllerRef.current = new AbortController();

        await startTranscribeStreaming(
          mediaStreamRef.current,
          (text: string, isFinal: boolean) => {
            if (isFinal) {
              if (text.trim()) {
                accumulatedTranscriptRef.current += text + " ";
              }
              setTimeout(() => {
                onTranscriptionResult?.(accumulatedTranscriptRef.current);
              }, 100);
            } else {
              if (text.trim()) {
                const displayText = accumulatedTranscriptRef.current + text;
                setTimeout(() => {
                  onTranscriptionResult?.(displayText);
                }, 200);
              }
            }
          },
          () => isStoppedManuallyRef.current,
          16000
        );
      } catch (error) {
        // エラー時は何もしない
      }
    };

    const handleButtonClick = async () => {
      if (isRecording) {
        isStoppedManuallyRef.current = true;

        if (transcribeAbortControllerRef.current) {
          transcribeAbortControllerRef.current.abort();
          transcribeAbortControllerRef.current = null;
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        accumulatedTranscriptRef.current = "";
        setIsRecording(false);
      } else {
        isStoppedManuallyRef.current = false;
        accumulatedTranscriptRef.current = "";

        try {
          const audioConstraints: MediaTrackConstraints = {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          };

          if (selectedDeviceId) {
            audioConstraints.deviceId = { exact: selectedDeviceId };
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
          });

          mediaStreamRef.current = stream;
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

        if (transcribeAbortControllerRef.current) {
          transcribeAbortControllerRef.current.abort();
          transcribeAbortControllerRef.current = null;
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
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
        <AudioDeviceSelector
          selectedDeviceId={selectedDeviceId}
          onDeviceChange={setSelectedDeviceId}
          disabled={isRecording}
        />

        <Tooltip title={isRecording ? "録音停止" : "録音開始"}>
          <span>
            <IconButton
              onClick={handleButtonClick}
              disabled={disabled || !selectedDeviceId}
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
          </span>
        </Tooltip>
      </Box>
    );
  }
);

export default memo(VoiceRecorder);
