interface LiveMapSubscriber {
  subscribe(channel: string, listener: (message: string) => void): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

interface LiveMapStreamOptions {
  channels: string[];
  subscriber: LiveMapSubscriber;
  loadSnapshot(): Promise<unknown[]>;
  signal: AbortSignal;
  heartbeatMs?: number;
}

const encoder = new TextEncoder();

export function createLiveMapStream(options: LiveMapStreamOptions): ReadableStream<Uint8Array> {
  let closed = false;
  let refreshing = false;
  let refreshAgain = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (value: string) => {
        if (!closed) controller.enqueue(encoder.encode(value));
      };
      const snapshot = async () => {
        if (refreshing) {
          refreshAgain = true;
          return;
        }
        refreshing = true;
        try {
          do {
            refreshAgain = false;
            const vehicles = await options.loadSnapshot();
            enqueue(`event: snapshot\ndata: ${JSON.stringify({ vehicles })}\n\n`);
          } while (refreshAgain && !closed);
        } finally {
          refreshing = false;
        }
      };
      const cleanup = async () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        // Close the controller before asynchronous Redis cleanup. Otherwise a
        // concurrent consumer cancellation can close the stream while we are
        // awaiting unsubscribe(), causing ERR_INVALID_STATE here.
        try {
          controller.close();
        } catch (error) {
          if (!(error instanceof TypeError) || !String(error.message).includes('already closed')) {
            throw error;
          }
        }
        await Promise.allSettled(
          options.channels.map((channel) => options.subscriber.unsubscribe(channel)),
        );
        await Promise.resolve(options.subscriber.quit()).catch(() => undefined);
      };
      options.signal.addEventListener('abort', () => void cleanup(), { once: true });
      if (options.signal.aborted) return cleanup();
      for (const channel of options.channels) {
        await options.subscriber.subscribe(channel, () => void snapshot());
      }
      await snapshot();
      heartbeat = setInterval(
        () => enqueue(`: heartbeat ${Date.now()}\n\n`),
        options.heartbeatMs ?? 15_000,
      );
    },
    async cancel() {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      await Promise.allSettled(
        options.channels.map((channel) => options.subscriber.unsubscribe(channel)),
      );
      await Promise.resolve(options.subscriber.quit()).catch(() => undefined);
    },
  });
}
