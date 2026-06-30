import EventSource from 'react-native-sse';

if (typeof globalThis !== 'undefined' && !('EventSource' in globalThis)) {
  (globalThis as any).EventSource = EventSource;
}
