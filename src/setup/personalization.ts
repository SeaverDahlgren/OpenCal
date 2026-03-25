import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type SetupState = {
  personalizationCompletedAt?: string;
};

export type PersonalizationIO = {
  print(message: string): void;
  ask(prompt: string): Promise<string>;
  confirm(prompt: string, defaultYes?: boolean): Promise<boolean>;
};

type PersonalizationAnswers = {
  interests?: string;
  workingHours?: string;
  meetingPreferences?: string;
  additionalContext?: string;
};

const STATE_FILE_NAME = "setup-state.json";

export async function maybeRunPersonalizationSetup(
  rootDir: string,
  io: PersonalizationIO,
): Promise<void> {
  const statePath = path.join(rootDir, ".opencal", STATE_FILE_NAME);
  const state = await loadSetupState(statePath);
  if (state.personalizationCompletedAt) {
    return;
  }

  io.print("Optional setup: answer a few questions so the assistant can personalize scheduling and advice.");
  const shouldRun = await io.confirm("Answer 4 optional personalization questions now?");
  if (!shouldRun) {
    await saveSetupState(statePath, {
      personalizationCompletedAt: new Date().toISOString(),
    });
    return;
  }

  const answers = await askPersonalizationQuestions(io);
  await persistPersonalizationAnswers(rootDir, answers);
  await saveSetupState(statePath, {
    personalizationCompletedAt: new Date().toISOString(),
  });
}

export function updateUserMarkdown(
  userMarkdown: string,
  updates: {
    workingHours?: string;
    meetingPreferences?: string;
  },
): string {
  let next = ensureUserHeader(userMarkdown);

  if (updates.workingHours) {
    next = upsertBullet(next, "working_hours", updates.workingHours);
  }

  if (updates.meetingPreferences) {
    next = upsertBullet(next, "meeting_preferences", updates.meetingPreferences);
  }

  return next;
}

export function buildMemoryPersonalizationBlock(answers: {
  interests?: string;
  additionalContext?: string;
}): string {
  const items: string[] = [];

  if (answers.interests) {
    items.push(`- current_interests: ${answers.interests}`);
  }

  if (answers.additionalContext) {
    items.push(`- additional_context: ${answers.additionalContext}`);
  }

  if (items.length === 0) {
    return "";
  }

  return [``, `## ${new Date().toISOString()}`, `Setup personalization`, ...items, ``].join("\n");
}

async function askPersonalizationQuestions(io: PersonalizationIO): Promise<PersonalizationAnswers> {
  io.print("Press Enter on any question to skip it.");

  const interests = await askOptional(io, "What are your current interests?");
  const workingHours = await askOptional(
    io,
    "What are your typical work start and stop times? Example: 09:00-17:00",
  );
  const meetingPreferences = await askOptional(
    io,
    "When do you prefer to schedule meetings with people?",
  );
  const additionalContext = await askOptional(
    io,
    "Is there anything else I should know about you to be a better assistant?",
  );

  return {
    interests,
    workingHours,
    meetingPreferences,
    additionalContext,
  };
}

async function askOptional(io: PersonalizationIO, prompt: string): Promise<string | undefined> {
  const answer = (await io.ask(prompt)).trim();
  return answer || undefined;
}

async function persistPersonalizationAnswers(
  rootDir: string,
  answers: PersonalizationAnswers,
): Promise<void> {
  const userPath = path.join(rootDir, "USER.md");
  const memoryPath = path.join(rootDir, "Memory.md");

  if (answers.workingHours || answers.meetingPreferences) {
    const currentUser = await fs.readFile(userPath, "utf8");
    const nextUser = updateUserMarkdown(currentUser, {
      workingHours: answers.workingHours,
      meetingPreferences: answers.meetingPreferences,
    });

    if (nextUser !== currentUser) {
      await fs.writeFile(userPath, nextUser, "utf8");
    }
  }

  const memoryBlock = buildMemoryPersonalizationBlock({
    interests: answers.interests,
    additionalContext: answers.additionalContext,
  });

  if (memoryBlock) {
    await fs.appendFile(memoryPath, memoryBlock, "utf8");
  }
}

async function loadSetupState(statePath: string): Promise<SetupState> {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    return JSON.parse(raw) as SetupState;
  } catch {
    return {};
  }
}

async function saveSetupState(statePath: string, state: SetupState): Promise<void> {
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}${os.EOL}`, "utf8");
}

function ensureUserHeader(userMarkdown: string): string {
  const trimmed = userMarkdown.trim();
  if (!trimmed) {
    return "# USER\n";
  }
  return userMarkdown.endsWith("\n") ? userMarkdown : `${userMarkdown}\n`;
}

function upsertBullet(markdown: string, key: string, value: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^- ${escapedKey}:.*$`, "m");
  const nextLine = `- ${key}: ${value}`;

  if (pattern.test(markdown)) {
    return markdown.replace(pattern, nextLine);
  }

  return `${markdown}${nextLine}\n`;
}
