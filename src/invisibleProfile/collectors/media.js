import { setState } from '../state.js';

function canPlayVideo(type) {
  try {
    const v = document.createElement('video');
    return v.canPlayType(type) || '';
  } catch (e) {
    return '';
  }
}

function canPlayAudio(type) {
  try {
    const a = document.createElement('audio');
    return a.canPlayType(type) || '';
  } catch (e) {
    return '';
  }
}

export async function collectMediaCapabilities() {
  const out = {
    video: {
      h264: canPlayVideo('video/mp4; codecs="avc1.42E01E"'),
      hevc: canPlayVideo('video/mp4; codecs="hvc1"'),
      av1: canPlayVideo('video/mp4; codecs="av01.0.05M.08"'),
      vp9: canPlayVideo('video/webm; codecs="vp9"'),
    },
    audio: {
      aac: canPlayAudio('audio/mp4; codecs="mp4a.40.2"'),
      opus: canPlayAudio('audio/webm; codecs="opus"'),
    },
    mediaDevices: null,
  };

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const counts = devs.reduce(
        (acc, d) => {
          acc[d.kind] = (acc[d.kind] || 0) + 1;
          return acc;
        },
        { audioinput: 0, audiooutput: 0, videoinput: 0 }
      );
      out.mediaDevices = counts;
    }
  } catch (e) {
    out.mediaDevices = { error: String(e) };
  }

  setState({ media: out });
  return out;
}

