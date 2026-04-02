import { createLlmProvider } from "../../../../src/llm/factory.js";
import { runAgentSessionTurn } from "../../../../src/app/session-runtime.js";
import { buildToolRegistry } from "../../../../src/tools/registry.js";
import type { AgentActionRequest, StoredSessionState } from "../../../../src/app/session-types.js";
import type { AppConfig } from "../../../../src/config/env.js";
import type { GoogleClients } from "../../../../src/integrations/google/auth.js";
import { buildHostedMemoryContext } from "../memory/context.js";
import type { ProductionMemoryRecord } from "../memory/types.js";
import type { UserProfile } from "../users/profile.js";
import { buildProfilePersonalizationBlock } from "../users/profile.js";
import { buildSkillCatalogAndManifests } from "../skills.js";
import { buildHostedSystemContext } from "./system-context.js";
import { hostedDebugLogPath } from "../runtime/filesystem.js";

export async function executeAgentTurn(args: {
  config: AppConfig;
  session: StoredSessionState;
  profile: UserProfile;
  memories: ProductionMemoryRecord[];
  googleClients: GoogleClients;
  action: AgentActionRequest;
}) {
  const runtimeConfig = configForSession(args.config, args.session);
  const provider = createLlmProvider(runtimeConfig);
  const tools = buildToolRegistry(args.googleClients);
  const skills = await buildSkillCatalogAndManifests(args.config.rootDir);
  return await runAgentSessionTurn(
    {
      config: runtimeConfig,
      provider,
      tools,
      debugLogPath: hostedDebugLogPath(args.config),
      promptContext: {
        kind: "hosted",
        systemContext: buildHostedSystemContext(),
        memoryContext: buildHostedMemoryContext(args.memories),
        profileContext: buildProfilePersonalizationBlock(args.profile),
      },
      timezone: args.profile.timezone,
      skillManifests: skills.manifests,
      skillsCatalog: skills.catalog,
    },
    args.session,
    args.action,
  );
}

function configForSession(base: AppConfig, session: StoredSessionState) {
  return {
    ...base,
    llmProvider: session.provider,
    toolResultVerbosity: session.toolResultVerbosity,
    geminiModel: session.provider === "gemini" ? session.model : base.geminiModel,
    groqModel: session.provider === "groq" ? session.model : base.groqModel,
  };
}
