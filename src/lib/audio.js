export const audio = {
  // Audio context for playback
  context: null,

  async createAudioContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.context;
  },

  async playAudio(url) {
    try {
      const context = await this.createAudioContext();
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(buffer);

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      source.start();

      return source;
    } catch (error) {
      console.error('Play audio error:', error);
      throw error;
    }
  },

  async stopAudio(source) {
    try {
      source.stop();
    } catch (error) {
      console.error('Stop audio error:', error);
    }
  },
};
