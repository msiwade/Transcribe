import React, { useRef, useEffect } from "react";
import { IconButton, Box, Tooltip } from "@mui/material";
import { Mic as MicIcon } from "@mui/icons-material";
import { startTranscribeStreaming } from "../services/amplifyService";

interface VoiceRecorderProps {
  onTranscriptionResult?: (text: string) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  disabled?: boolean;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscriptionResult,
  onRecordingStart,
  onRecordingStop,
  disabled = false,
}) => {
  // 完全に独立した状態管理
  const isRecordingRef = useRef(false);
  const buttonElementRef = useRef<HTMLButtonElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isStoppedManuallyRef = useRef(false);
  const accumulatedTranscriptRef = useRef<string>("");
  const transcribeAbortControllerRef = useRef<AbortController | null>(null);
  const isInitializedRef = useRef(false);

  // ボタンUIを直接更新する関数
  const updateButtonUI = (recording: boolean) => {
    if (!buttonElementRef.current) return;

    console.log(`🔄 ボタンUI更新: ${isRecordingRef.current} → ${recording}`);
    isRecordingRef.current = recording;

    const button = buttonElementRef.current;
    button.style.backgroundColor = recording ? "#ff5252" : "#4caf50";
    button.innerHTML = recording
      ? '<svg class="MuiSvgIcon-root" focusable="false" viewBox="0 0 24 24" aria-hidden="true" style="font-size: 1.5rem;"><path d="M6 6h12v12H6z"></path></svg>'
      : '<svg class="MuiSvgIcon-root" focusable="false" viewBox="0 0 24 24" aria-hidden="true" style="font-size: 1.5rem;"><path d="M12 2c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2s-2-.9-2-2V4c0-1.1.9-2 2-2zm5.6 6.5c.4 0 .8.3.8.8v.7c0 3.3-2.7 6-6 6s-6-2.7-6-6v-.7c0-.4.4-.8.8-.8s.8.3.8.8v.7c0 2.8 2.2 5 5 5s5-2.2 5-5v-.7c0-.4.4-.8.8-.8zM12 17c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1s-1-.4-1-1v-2c0-.6.4-1 1-1z"></path></svg>';

    // ツールチップテキストも更新
    const tooltip = recording ? "録音停止" : "録音開始";
    button.setAttribute("title", tooltip);
  };

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
            // デバウンス処理で頻繁な更新を制御
            setTimeout(() => {
              onTranscriptionResult?.(accumulatedTranscriptRef.current);
            }, 100);
          } else {
            if (text.trim()) {
              const displayText = accumulatedTranscriptRef.current + text;
              // 中間結果は更新頻度を制限
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
    if (isRecordingRef.current) {
      // 停止処理
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
      setTimeout(() => {
        onTranscriptionResult?.("");
        onRecordingStop?.();
      }, 100);

      updateButtonUI(false);
    } else {
      // 開始処理
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

        updateButtonUI(true);
        setTimeout(() => {
          onRecordingStart?.();
        }, 100);

        startTranscribeStreamingProcess().catch((error) => {
          console.error("Transcribe Streaming開始エラー:", error);
        });
      } catch (err) {
        console.error("音声ストリーム取得エラー:", err);
        updateButtonUI(false);
      }
    }
  };

  useEffect(() => {
    if (!isInitializedRef.current) {
      initializeRecorder();
      isInitializedRef.current = true;
    }
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Tooltip title="録音開始">
        <IconButton
          ref={buttonElementRef}
          onClick={handleButtonClick}
          disabled={disabled}
          sx={{
            backgroundColor: "#4caf50",
            color: "white",
            width: "40px",
            height: "40px",
            minWidth: "40px",
            "&:hover": {
              backgroundColor: "#388e3c",
            },
            "&:disabled": {
              backgroundColor: "#ccc",
            },
          }}
        >
          <MicIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default VoiceRecorder;
