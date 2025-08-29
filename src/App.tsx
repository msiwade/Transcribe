import {
  useState,
  useCallback,
  lazy,
  Suspense,
  useRef,
  useEffect,
} from "react";
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  CircularProgress,
  Button,
} from "@mui/material";
import { Clear as ClearIcon } from "@mui/icons-material";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

const VoiceRecorder = lazy(
  () => import("./features/audio-recording/components/VoiceRecorder")
);
const MixedVoiceRecorder = lazy(
  () => import("./features/audio-recording/components/MixedVoiceRecorder")
);

function App() {
  const [transcriptionText, setTranscriptionText] = useState<string>("");
  const [isMixedMode, setIsMixedMode] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  const voiceRecorderRef = useRef<{
    stopRecording: () => void;
    clearAccumulatedText: () => void;
  } | null>(null);
  const mixedVoiceRecorderRef = useRef<{
    stopRecording: () => void;
    clearAccumulatedText: () => void;
  } | null>(null);

  const outputBoxRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTranscriptionResult = useCallback((text: string) => {
    setTranscriptionText(text);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (outputBoxRef.current && isAutoScrollEnabled) {
      outputBoxRef.current.scrollTop = outputBoxRef.current.scrollHeight;
    }
  }, [isAutoScrollEnabled]);

  const handleScroll = useCallback(() => {
    if (!outputBoxRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = outputBoxRef.current;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 10;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    if (isAutoScrollEnabled && !isNearBottom) {
      setIsAutoScrollEnabled(false);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (isNearBottom) {
        setIsAutoScrollEnabled(true);
      }
    }, 150);
  }, [isAutoScrollEnabled]);

  const toggleMode = () => {
    if (isMixedMode && mixedVoiceRecorderRef.current) {
      mixedVoiceRecorderRef.current.stopRecording();
    } else if (!isMixedMode && voiceRecorderRef.current) {
      voiceRecorderRef.current.stopRecording();
    }

    setIsMixedMode(!isMixedMode);
    setTranscriptionText("");
  };

  const clearTranscription = () => {
    setTranscriptionText("");

    if (isMixedMode && mixedVoiceRecorderRef.current) {
      mixedVoiceRecorderRef.current.clearAccumulatedText();
    } else if (!isMixedMode && voiceRecorderRef.current) {
      voiceRecorderRef.current.clearAccumulatedText();
    }
  };

  useEffect(() => {
    if (transcriptionText) {
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [transcriptionText, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Authenticator>
      {() => (
        <Box
          sx={{
            flexGrow: 1,
            bgcolor: "background.default",
            minHeight: "100vh",
          }}
        >
          <AppBar
            position="static"
            sx={{ backgroundColor: "white", boxShadow: "none" }}
          >
            <Toolbar>
              <Typography
                variant="h6"
                component="div"
                onClick={toggleMode}
                sx={{
                  flexGrow: 1,
                  textAlign: "center",
                  color: "black",
                  fontWeight: "bold",
                  cursor: "pointer",
                  "&:hover": {
                    opacity: 0.7,
                  },
                }}
              >
                Transcribe App {isMixedMode ? "(両方)" : "(自分のみ)"}
              </Typography>
            </Toolbar>
          </AppBar>

          <Box
            sx={{
              p: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Suspense fallback={<CircularProgress sx={{ mt: 4 }} />}>
              {isMixedMode ? (
                <MixedVoiceRecorder
                  ref={mixedVoiceRecorderRef}
                  onTranscriptionResult={handleTranscriptionResult}
                />
              ) : (
                <VoiceRecorder
                  ref={voiceRecorderRef}
                  onTranscriptionResult={handleTranscriptionResult}
                />
              )}
            </Suspense>

            <Box
              sx={{
                p: 3,
                minWidth: "300px",
                maxWidth: "600px",
                width: "100%",
                minHeight: "200px",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6">出力結果:</Typography>
                <Button
                  variant="text"
                  size="small"
                  onClick={clearTranscription}
                  startIcon={<ClearIcon />}
                  disabled={!transcriptionText}
                  sx={{
                    minWidth: "auto",
                    color: "red",
                    px: 2,
                  }}
                >
                  クリア
                </Button>
              </Box>
              <Box
                ref={outputBoxRef}
                onScroll={handleScroll}
                sx={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  border: "1px solid #e0e0e0",
                  borderRadius: 1,
                  p: 2,
                  backgroundColor: "#fafafa",
                }}
              >
                <Typography
                  variant="body1"
                  sx={{
                    whiteSpace: "pre-wrap",
                    wordWrap: "break-word",
                    lineHeight: 1.6,
                  }}
                >
                  {transcriptionText ||
                    "デバイスを選択して録音ボタンを押してください..."}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Authenticator>
  );
}

export default App;
