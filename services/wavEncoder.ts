// Function to convert an AudioBuffer to a WAV file (Blob)
export function encodeWAV(audioBuffer: AudioBuffer): Blob {
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    // Helper function to write strings to the DataView
    const writeString = (s: string) => {
        for (i = 0; i < s.length; i++) {
            view.setUint8(pos++, s.charCodeAt(i));
        }
    };

    // RIFF chunk descriptor
    writeString('RIFF');
    view.setUint32(pos, 36 + audioBuffer.length * numOfChan * 2, true); pos += 4;
    writeString('WAVE');

    // FMT sub-chunk
    writeString('fmt ');
    view.setUint32(pos, 16, true); pos += 4; // Sub-chunk size
    view.setUint16(pos, 1, true); pos += 2; // Audio format (1 = PCM)
    view.setUint16(pos, numOfChan, true); pos += 2; // Number of channels
    view.setUint32(pos, audioBuffer.sampleRate, true); pos += 4; // Sample rate
    view.setUint32(pos, audioBuffer.sampleRate * 2 * numOfChan, true); pos += 4; // Byte rate
    view.setUint16(pos, numOfChan * 2, true); pos += 2; // Block align
    view.setUint16(pos, 16, true); pos += 2; // Bits per sample

    // Data sub-chunk
    writeString('data');
    view.setUint32(pos, audioBuffer.length * numOfChan * 2, true); pos += 4;

    // Write the PCM data
    for (i = 0; i < numOfChan; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // Clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // Convert to 16-bit integer
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([view], { type: 'audio/wav' });
}
