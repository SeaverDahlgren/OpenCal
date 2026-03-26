import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { EditorialHeader } from "../src/components/EditorialHeader";
import { ScreenShell } from "../src/components/ScreenShell";
import { useSession } from "../src/state/session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function ChatScreen() {
  const { chatHistory, pendingTurn, sendAgentAction } = useSession();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(body: { message?: string; action?: "confirm" | "cancel"; optionValue?: string }) {
    setSending(true);
    const next = await sendAgentAction(body);
    if (!next) {
      setSending(false);
      return;
    }
    setDraft("");
    setSending(false);
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
          data={chatHistory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.message, item.role === "user" && styles.userMessage]}>{item.content}</Text>
            </View>
          )}
          ListFooterComponent={
            <View style={{ gap: spacing.md }}>
              {pendingTurn?.clarification ? (
                <View style={styles.inlineCard}>
                  <Text style={styles.inlineEyebrow}>ACTION NEEDED</Text>
                  <Text style={styles.inlineTitle}>{pendingTurn.clarification.prompt}</Text>
                  {pendingTurn.clarification.options.map((option) => (
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
              {pendingTurn?.confirmation ? (
                <View style={styles.inlineCard}>
                  <Text style={styles.inlineEyebrow}>CONFIRMATION</Text>
                  <Text style={styles.inlineTitle}>{pendingTurn.confirmation.prompt}</Text>
                  <Text style={styles.inlineBody}>
                    {pendingTurn.confirmation.payloadPreview.summary ?? pendingTurn.confirmation.payloadPreview.kind}
                  </Text>
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.confirm} onPress={() => void submit({ action: "confirm" })}>
                      <Text style={styles.confirmText}>{pendingTurn.confirmation.actionLabel}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancel} onPress={() => void submit({ action: "cancel" })}>
                      <Text style={styles.cancelText}>{pendingTurn.confirmation.cancelLabel}</Text>
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
