import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createApiClient } from "../src/api/client";
import type { AgentTurnDto } from "../src/api/types";
import { EditorialHeader } from "../src/components/EditorialHeader";
import { ScreenShell } from "../src/components/ScreenShell";
import { useSession } from "../src/state/session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatScreen() {
  const { token, taskState, refreshSession, refreshTaskState } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [response, setResponse] = useState<AgentTurnDto | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!taskState) {
      setResponse(null);
      return;
    }
    if (taskState.clarification || taskState.confirmation) {
      setResponse({
        assistant: {
          message:
            taskState.clarification?.prompt ??
            taskState.confirmation?.prompt ??
            taskState.taskState?.summary ??
            "Resume your task.",
        },
        clarification: taskState.clarification,
        confirmation: taskState.confirmation,
        session: { hasBlockedTask: Boolean(taskState.taskState?.hasBlockedPrompt || taskState.confirmation) },
      });
      return;
    }
    setResponse(null);
  }, [taskState]);

  async function submit(body: { message?: string; action?: "confirm" | "cancel"; optionValue?: string }) {
    if (!token) {
      return;
    }
    setSending(true);
    const userContent = body.message ?? body.optionValue ?? body.action ?? "";
    if (userContent) {
      setMessages((current) => [...current, { id: `${Date.now()}-user`, role: "user", content: userContent }]);
    }
    const next = await createApiClient(token).sendAgentMessage(body);
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-assistant`, role: "assistant", content: next.assistant.message },
    ]);
    setResponse(next);
    setDraft("");
    setSending(false);
    await Promise.all([refreshSession(), refreshTaskState()]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={96}
    >
      <ScreenShell scroll={false}>
        <EditorialHeader eyebrow="AI CHANNEL" title="OpenCal" subtitle="Clarifications and confirmations stay inline while the text composer remains available." />
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.message, item.role === "user" && styles.userMessage]}>{item.content}</Text>
            </View>
          )}
          ListFooterComponent={
            <View style={{ gap: spacing.md }}>
              {response?.clarification ? (
                <View style={styles.inlineCard}>
                  <Text style={styles.inlineEyebrow}>ACTION NEEDED</Text>
                  <Text style={styles.inlineTitle}>{response.clarification.prompt}</Text>
                  {response.clarification.options.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={styles.option}
                      onPress={() => void submit({ optionValue: option.value })}
                    >
                      <Text style={styles.optionText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {response?.confirmation ? (
                <View style={styles.inlineCard}>
                  <Text style={styles.inlineEyebrow}>CONFIRMATION</Text>
                  <Text style={styles.inlineTitle}>{response.confirmation.prompt}</Text>
                  <Text style={styles.inlineBody}>
                    {response.confirmation.payloadPreview.summary ?? response.confirmation.payloadPreview.kind}
                  </Text>
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.confirm} onPress={() => void submit({ action: "confirm" })}>
                      <Text style={styles.confirmText}>{response.confirmation.actionLabel}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancel} onPress={() => void submit({ action: "cancel" })}>
                      <Text style={styles.cancelText}>{response.confirmation.cancelLabel}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          }
        />
      </ScreenShell>

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          style={styles.input}
          placeholder="Message OpenCal"
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity
          style={styles.send}
          disabled={sending || draft.trim().length === 0}
          onPress={() => void submit({ message: draft.trim() })}
        >
          <Text style={styles.sendText}>{sending ? "..." : "Send"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { gap: spacing.md, paddingBottom: 24 },
  bubble: { borderRadius: radii.lg, padding: spacing.md, maxWidth: "88%" },
  userBubble: { backgroundColor: colors.primary, alignSelf: "flex-end" },
  assistantBubble: { backgroundColor: colors.surfaceHigh, alignSelf: "flex-start" },
  message: { color: colors.text, fontSize: 15, lineHeight: 22 },
  userMessage: { color: colors.background },
  inlineCard: { backgroundColor: colors.surfaceHigh, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  inlineEyebrow: { color: colors.tertiary, ...typography.eyebrow },
  inlineTitle: { color: colors.text, fontWeight: "700", fontSize: 16 },
  inlineBody: { color: colors.textMuted },
  option: { backgroundColor: colors.surfaceHighest, borderRadius: radii.md, padding: spacing.md },
  optionText: { color: colors.primary, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm },
  confirm: { flex: 1, backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md, alignItems: "center" },
  cancel: { flex: 1, backgroundColor: colors.surfaceHighest, borderRadius: radii.md, padding: spacing.md, alignItems: "center" },
  confirmText: { color: colors.background, fontWeight: "800" },
  cancelText: { color: colors.textMuted, fontWeight: "700" },
  composer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineGhost,
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    color: colors.text,
    minHeight: 48,
  },
  send: {
    backgroundColor: colors.tertiary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: colors.background, fontWeight: "800" },
});
