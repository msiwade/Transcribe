export interface AudioDevice {
  deviceId: string;
  label: string;
}

export interface VoiceRecorderProps {
  onTranscriptionResult?: (text: string) => void;
  disabled?: boolean;
}

export interface AudioDeviceSelectorProps {
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  disabled?: boolean;
  preferVBDevice?: boolean;
}
