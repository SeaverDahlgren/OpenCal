import { createLlmProvider } from "../../../../src/llm/factory.js";
import { runAgentSessionTurn } from "../../../../src/app/session-runtime.js";
import { buildToolRegistry } from "../../../../src/tools/registry.js";
import type { AgentActionRequest, StoredSessionState } from "../../../../src/app/session-types.js";
import type { AppConfig } from "../../../../src/config/env.js";
import type { WorkspaceFiles } from "../../../../src/memory/workspace.js";
import type { GoogleClients } from "../../../../src/integrations/google/auth.js";
import type { UserProfile } from "../users/profile.js";
import { buildSkillCatalogAndManifests } from "../skills.js";

export async function executeAgentTurn(args: {
  config: AppConfig;
  session: StoredSessionState;
  profile: UserProfile;
  workspace: WorkspaceFiles;
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
      workspace: args.workspace,
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
