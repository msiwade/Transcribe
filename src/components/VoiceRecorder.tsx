import React, { useRef, useEffect, useState, memo } from "react";
import { IconButton, Box, Tooltip } from "@mui/material";
import { Mic as MicIcon, Stop as StopIcon } from "@mui/icons-material";
import { startTranscribeStreaming } from "../services/amplifyService";

interface VoiceRecorderProps {
  onTranscriptionResult?: (text: string) => void;
  disabled?: boolean;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscriptionResult,
  disabled = false,
}) => {
  // React状態管理を使用
  const [isRecording, setIsRecording] = useState(false);

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
      const { createTranscribeStreamingClient } = await import(
        "../services/amplifyService"
      );
      await createTranscribeStreamingClient();
    } catch (error) {
      console.error("AWS Transcribe Streaming初期化エラー:", error);
    }
  };

  const startTranscribeStreamingProcess = async () => {
    if (!mediaStreamRef.current) return;

    try {
      transcribeAbortControllerRef.current = new AbortController();
      console.log("AWS Transcribe Streaming開始");

      await startTranscribeStreaming(
        mediaStreamRef.current,
        (text: string, isFinal: boolean) => {
          if (isFinal) {
            if (text.trim()) {
              accumulatedTranscriptRef.current += text + " ";
              console.log("最終結果追加:", text);
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
        () => isStoppedManuallyRef.current
      );

      console.log("AWS Transcribe Streaming終了");
    } catch (error) {
      console.error("AWS Transcribe Streamingエラー:", error);
    }
  };

  const handleButtonClick = async () => {
    if (isRecording) {
      console.log("🛑 録音停止開始");
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
      console.log("🎤 録音開始");
      isStoppedManuallyRef.current = false;
      accumulatedTranscriptRef.current = "";

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        mediaStreamRef.current = stream;

        setIsRecording(true);

        startTranscribeStreamingProcess().catch((error) => {
          console.error("Transcribe Streaming開始エラー:", error);
        });
      } catch (err) {
        console.error("音声ストリーム取得エラー:", err);
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

  // 録音状態変更を監視して適切な処理を実行
  const isFirstRenderRef = useRef(true);
  const prevIsRecordingRef = useRef(false);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevIsRecordingRef.current = isRecording;
      return;
    }

    // 状態が実際に変更された場合のみ処理を実行
    if (prevIsRecordingRef.current !== isRecording) {
      console.log(
        `🔄 録音状態変更: ${prevIsRecordingRef.current} → ${isRecording}`
      );
      if (isRecording) {
        // 録音開始時：空文字列を送信
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
      <Tooltip title={isRecording ? "録音停止" : "録音開始"}>
        <IconButton
          onClick={handleButtonClick}
          disabled={disabled}
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
};

export default memo(VoiceRecorder);
