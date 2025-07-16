# AWS Transcribe Streamingを使ったリアルタイム音声認識PoC実施記録

## 概要

### 目的

ボイスチャットアプリケーションにおいて、AWS Transcribeを使用してリアルタイムの音声文字起こし機能が実現可能かを検証。

### 技術スタック

- **フロントエンド**: React 19 + TypeScript + Material-UI
- **音声認識**: AWS Transcribe Streaming
- **認証**: AWS Cognito (Amplify)
- **インフラ**: AWS Amplify Gen2
- **音声処理**: Web Audio API + MediaRecorder API

### 検証結果

✅ **成功** - リアルタイム音声認識とストリーミング文字起こしを実現

## アーキテクチャ構成

```
ユーザー音声入力
    ↓
ブラウザ MediaRecorder API (16kHz PCM)
    ↓
AWS Cognito認証
    ↓
AWS Transcribe Streaming
    ↓
リアルタイム文字起こし結果
    ↓
React UI表示
```

## 実装手順

### 1. AWS Amplify設定

#### 認証設定 (`amplify/auth/resource.ts`)

```typescript
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
```

#### IAM権限設定 (`amplify/backend.ts`)

```typescript
// Transcribe Streamingアクセス権限を付与
backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(
  new Policy(
    backend.auth.resources.authenticatedUserIamRole.stack,
    "TranscribeStreamingPolicy",
    {
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              "transcribe:StartStreamTranscription",
              "transcribe:StartStreamTranscriptionWebSocket",
            ],
            resources: ["*"],
          }),
        ],
      }),
    }
  )
);
```

### 2. Transcribeクライアント実装

#### 認証情報取得とクライアント作成

```typescript
export const createTranscribeStreamingClient = async () => {
  const session = await fetchAuthSession();
  const credentials = session.credentials;

  return new TranscribeStreamingClient({
    region: "ap-northeast-1",
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
};
```

#### 音声ストリーミング設定

- **サンプルレート**: 16kHz (Transcribe推奨)
- **エンコード**: PCM 16bit
- **チャンクサイズ**: 512サンプル (低遅延重視)
- **言語**: 日本語 (ja-JP)

### 3. 音声処理実装

#### PCMエンコード処理

```typescript
export const encodePCMChunk = (chunk: Float32Array): Uint8Array => {
  const buffer = new ArrayBuffer(chunk.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < chunk.length; i++) {
    const s = Math.max(-1, Math.min(1, chunk[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
};
```

#### 音声ストリーム生成

```typescript
export const createAudioStream = async function* (
  mediaStream: MediaStream,
  onStop: () => boolean
): AsyncGenerator<{ AudioEvent: { AudioChunk: Uint8Array } }> {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const processor = audioContext.createScriptProcessor(512, 1, 1);

  // 音声データをリアルタイムでエンコードして送信
  processor.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0);
    const encodedChunk = encodePCMChunk(inputData);
    audioQueue.push(encodedChunk);
  };
};
```

### 4. フロントエンド実装

#### VoiceRecorderコンポーネント

- マイクボタンによる録音制御
- リアルタイム状態管理
- Transcribe結果の中間/最終結果処理
- エラーハンドリング

#### 結果表示処理

```typescript
const handleTranscriptionResult = (text: string, isFinal: boolean) => {
  if (isFinal) {
    // 最終結果を蓄積
    accumulatedTranscriptRef.current += text + " ";
    onTranscriptionResult?.(accumulatedTranscriptRef.current);
  } else {
    // 中間結果を表示
    const displayText = accumulatedTranscriptRef.current + text;
    onTranscriptionResult?.(displayText);
  }
};
```

## まとめ

このPoCにより、AWS Transcribeを使ったリアルタイム音声認識システムの実現可能性が確認できました。
