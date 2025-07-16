import { fetchAuthSession } from "aws-amplify/auth";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";

// AWS Transcribe Streamingサービス
export const createTranscribeStreamingClient = async () => {
  try {
    const session = await fetchAuthSession();
    const credentials = session.credentials;

    if (!credentials) {
      throw new Error("認証情報が取得できませんでした");
    }

    const transcribeClient = new TranscribeStreamingClient({
      region: "ap-northeast-1",
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    return transcribeClient;
  } catch (error) {
    console.error("TranscribeStreamingClient作成エラー:", error);
    throw error;
  }
};

// PCMエンコーディング関数
export const encodePCMChunk = (chunk: Float32Array): Uint8Array => {
  const buffer = new ArrayBuffer(chunk.length * 2);
  const view = new DataView(buffer);
  let offset = 0;

  for (let i = 0; i < chunk.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, chunk[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
};

// 音声ストリームジェネレータ
export const createAudioStream = async function* (
  mediaStream: MediaStream,
  onStop: () => boolean
): AsyncGenerator<{ AudioEvent: { AudioChunk: Uint8Array } }> {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(mediaStream);

  // より小さいバッファサイズで遅延を減らす（512サンプル = 32ms at 16kHz）
  const processor = audioContext.createScriptProcessor(512, 1, 1);

  const audioQueue: Uint8Array[] = [];
  let isProcessing = true;

  processor.onaudioprocess = (event) => {
    if (!isProcessing) return;

    const inputData = event.inputBuffer.getChannelData(0);
    const encodedChunk = encodePCMChunk(inputData);

    // キューに追加（バッファリングを最小限に）
    if (encodedChunk.length > 0) {
      audioQueue.push(encodedChunk);
    }
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  try {
    while (!onStop() && isProcessing) {
      // キューから音声データを取得
      if (audioQueue.length > 0) {
        const chunk = audioQueue.shift()!;
        yield { AudioEvent: { AudioChunk: chunk } };
      }

      // 短い間隔でポーリング（遅延を最小限に）
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } finally {
    isProcessing = false;
    processor.disconnect();
    source.disconnect();
    await audioContext.close();
  }
};

// Transcribe Streamingを開始
export const startTranscribeStreaming = async (
  mediaStream: MediaStream,
  onTranscriptionResult: (text: string, isFinal: boolean) => void,
  onStop: () => boolean
) => {
  try {
    const client = await createTranscribeStreamingClient();
    const audioStream = createAudioStream(mediaStream, onStop);

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: "ja-JP",
      MediaEncoding: "pcm",
      MediaSampleRateHertz: 16000,
      AudioStream: audioStream,
    });

    const response = await client.send(command);

    if (response.TranscriptResultStream) {
      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent && event.TranscriptEvent.Transcript) {
          const results = event.TranscriptEvent.Transcript.Results;
          if (results && results.length > 0) {
            const result = results[0];
            const transcript = result.Alternatives?.[0]?.Transcript || "";
            const isFinal = !result.IsPartial;

            if (transcript) {
              onTranscriptionResult(transcript, isFinal);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Transcribe Streamingエラー:", error);
    throw error;
  }
};
