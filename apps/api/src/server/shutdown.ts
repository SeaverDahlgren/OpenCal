import type http from "node:http";

export function registerAbortOnSignals(controller: AbortController, onSignal?: (signal: NodeJS.Signals) => void) {
  const handler = (signal: NodeJS.Signals) => {
    if (controller.signal.aborted) {
      return;
    }
    onSignal?.(signal);
    controller.abort();
  };

  process.once("SIGINT", handler);
  process.once("SIGTERM", handler);

  return () => {
    process.off("SIGINT", handler);
    process.off("SIGTERM", handler);
  };
}

export function closeServer(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
