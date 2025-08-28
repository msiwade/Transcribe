import { useState, useCallback } from "react";
import { Box, Typography, AppBar, Toolbar } from "@mui/material";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import { VoiceRecorder } from "./features/voice-transcription";

function App() {
  const [transcriptionText, setTranscriptionText] = useState<string>("");

  const handleTranscriptionResult = useCallback((text: string) => {
    setTranscriptionText(text);
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
                sx={{
                  flexGrow: 1,
                  textAlign: "center",
                  color: "black",
                  fontWeight: "bold",
                }}
              >
                Voice Transcription Demo
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
            <VoiceRecorder onTranscriptionResult={handleTranscriptionResult} />

            <Box
              sx={{
                p: 3,
                minWidth: "300px",
                maxWidth: "600px",
                width: "100%",
                minHeight: "200px",
              }}
            >
              <Typography variant="h6" gutterBottom>
                文字起こし結果:
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  lineHeight: 1.6,
                }}
              >
                {transcriptionText || "録音ボタンを押して話してください..."}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Authenticator>
  );
}

export default App;
