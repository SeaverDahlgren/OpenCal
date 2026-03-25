import { ConsoleIO } from "./cli/io.js";
import { AgentRunner } from "./agent/runner.js";
import { loadConfig } from "./config/env.js";
import { createLlmProvider } from "./llm/factory.js";
import { buildToolRegistry } from "./tools/registry.js";
import { createGoogleClients, ensureGoogleAuthorization } from "./integrations/google/auth.js";

async function main() {
  const command = process.argv[2] ?? "chat";
  const config = loadConfig();
  const io = new ConsoleIO();

  try {
    const provider = createLlmProvider(config);
    const authClient = await ensureGoogleAuthorization(config, io, command === "auth");
    const googleClients = createGoogleClients(authClient);
    const tools = buildToolRegistry(googleClients, io);
    const runner = new AgentRunner(config, provider, io, tools);
    await runner.initialize();

    if (command === "auth") {
      io.print("Google authorization refreshed.");
      return;
    }

    await runner.runChatLoop();
  } finally {
    io.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
