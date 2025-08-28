import { useState, useEffect } from "react";
import { Select, MenuItem, FormControl, Box } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import type {
  AudioDevice,
  AudioDeviceSelectorProps,
} from "../../../shared/types/transcription";

const AudioDeviceSelector = ({
  selectedDeviceId,
  onDeviceChange,
  disabled = false,
  preferVBDevice = false,
}: AudioDeviceSelectorProps) => {
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getAudioDevices = async () => {
    try {
      setIsLoading(true);

      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `マイク ${device.deviceId.slice(0, 8)}...`,
        }));

      setAudioDevices(audioInputDevices);

      if (audioInputDevices.length > 0 && !selectedDeviceId) {
        let deviceToSelect = audioInputDevices[0];

        if (preferVBDevice) {
          const vbKeywords = ["VB-Audio", "CABLE", "Virtual Cable", "VB-Cable"];
          const vbDevice = audioInputDevices.find((device) =>
            vbKeywords.some((keyword) =>
              device.label.toLowerCase().includes(keyword.toLowerCase())
            )
          );

          if (vbDevice) {
            deviceToSelect = vbDevice;
          }
        }

        onDeviceChange(deviceToSelect.deviceId);
      }
    } catch (error) {
      console.error("音声デバイス取得エラー:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getAudioDevices();

    const handleDeviceChange = () => {
      getAudioDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, []);

  const handleSelectChange = (event: SelectChangeEvent) => {
    onDeviceChange(event.target.value);
  };

  return (
    <Box sx={{ minWidth: 300, mb: 2 }}>
      <FormControl fullWidth size="small">
        <Select
          labelId="audio-device-select-label"
          value={selectedDeviceId}
          onChange={handleSelectChange}
          disabled={disabled || isLoading}
        >
          {audioDevices.map((device) => (
            <MenuItem key={device.deviceId} value={device.deviceId}>
              {device.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default AudioDeviceSelector;
