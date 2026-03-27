import { useCallback, useEffect, useRef, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { InlineNotice } from "../src/components/InlineNotice";
import { ScreenShell } from "../src/components/ScreenShell";
import { useSession } from "../src/state/session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function ChatScreen() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const router = useRouter();
  const { chatHistory, pendingTurn, sendAgentAction } = useSession();
  const listRef = useRef<FlatList<(typeof chatHistory)[number]>>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showDraftPreview, setShowDraftPreview] = useState(false);

  const scrollToLatest = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    if (typeof prompt === "string" && prompt.trim() && !draft) {
      setDraft(prompt.trim());
    }
  }, [draft, prompt]);

  useEffect(() => {
    setShowDraftPreview(false);
  }, [pendingTurn?.confirmation?.payloadPreview.body, pendingTurn?.confirmation?.prompt]);

  useFocusEffect(
    useCallback(() => {
      scrollToLatest(false);
    }, [scrollToLatest]),
  );

  useEffect(() => {
    if (chatHistory.length === 0 && !pendingTurn) {
      return;
    }
    scrollToLatest(false);
  }, [chatHistory.length, pendingTurn, scrollToLatest]);

  async function submit(body: { message?: string; action?: "confirm" | "cancel"; optionValue?: string }) {
    setSending(true);
    setError(null);
    try {
      const next = await sendAgentAction(body);
      if (!next) {
        setSending(false);
        return;
      }
      setDraft("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to send that message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={96}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.dismissLabel}>Done</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScreenShell scroll={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Open CAL</Text>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => setShowRecommendations((value) => !value)}
          >
            <Text style={styles.helpButtonText}>?</Text>
          </TouchableOpacity>
        </View>
        {showRecommendations ? (
          <View style={styles.recommendationsCard}>
            <Text style={styles.inlineEyebrow}>TRY ASKING</Text>
            <Text style={styles.recommendation}>What does my day look like?</Text>
            <Text style={styles.recommendation}>Reschedule my meeting with Joe for tomorrow afternoon.</Text>
            <Text style={styles.recommendation}>Draft an email to Sarah about moving our meeting.</Text>
            <Text style={styles.recommendation}>How many times am I swimming next month?</Text>
          </View>
        ) : null}
        {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void submit({ message: draft.trim() })} /> : null}
        <FlatList
          ref={listRef}
          data={chatHistory}
          keyExtractor={(item) => item.id}
          style={styles.listView}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scrollToLatest(false)}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.message, item.role === "user" && styles.userMessage]}>{item.content}</Text>
            </View>
          )}
          ListFooterComponent={
            chatHistory.length === 0 && !pendingTurn ? (
              <View style={styles.emptyCard}>
                <Text style={styles.inlineEyebrow}>START HERE</Text>
                <Text style={styles.inlineTitle}>Ask OpenCal to plan, reschedule, or draft.</Text>
                <Text style={styles.inlineBody}>
                  The conversation stays synced with the backend session, so you can leave and come back without losing context.
                </Text>
              </View>
            ) : null
          }
        />
        {pendingTurn?.clarification ? (
          <View style={styles.pendingPanel}>
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
          </View>
        ) : null}
        {pendingTurn?.confirmation ? (
          <View style={styles.pendingPanel}>
            <View style={styles.inlineCard}>
              <Text style={styles.inlineEyebrow}>CONFIRMATION</Text>
              <Text style={styles.inlineTitle}>{pendingTurn.confirmation.prompt}</Text>
              <Text style={styles.inlineBody}>
                {pendingTurn.confirmation.payloadPreview.summary ?? pendingTurn.confirmation.payloadPreview.kind}
              </Text>
              {pendingTurn.confirmation.payloadPreview.kind === "write_draft" &&
              pendingTurn.confirmation.payloadPreview.body ? (
                <>
                  <TouchableOpacity
                    style={styles.previewToggle}
                    onPress={() => setShowDraftPreview((value) => !value)}
                  >
                    <Text style={styles.previewToggleText}>
                      {showDraftPreview ? "Hide Full Email" : "Preview Full Email"}
                    </Text>
                  </TouchableOpacity>
                  {showDraftPreview ? (
                    <View style={styles.previewCard}>
                      {pendingTurn.confirmation.payloadPreview.subject ? (
                        <Text style={styles.previewSubject}>
                          Subject: {pendingTurn.confirmation.payloadPreview.subject}
                        </Text>
                      ) : null}
                      {pendingTurn.confirmation.payloadPreview.recipients?.length ? (
                        <Text style={styles.previewMeta}>
                          To: {pendingTurn.confirmation.payloadPreview.recipients.join(", ")}
                        </Text>
                      ) : null}
                      <Text style={styles.previewBody}>
                        {pendingTurn.confirmation.payloadPreview.body}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : null}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.confirm} onPress={() => void submit({ action: "confirm" })}>
                  <Text style={styles.confirmText}>{pendingTurn.confirmation.actionLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancel} onPress={() => void submit({ action: "cancel" })}>
                  <Text style={styles.cancelText}>{pendingTurn.confirmation.cancelLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  helpButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  helpButtonText: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  recommendationsCard: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  recommendation: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  listView: { flex: 1 },
  list: { gap: spacing.md, paddingBottom: 24 },
  pendingPanel: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  bubble: { borderRadius: radii.lg, padding: spacing.md, maxWidth: "88%" },
  userBubble: { backgroundColor: colors.primary, alignSelf: "flex-end" },
  assistantBubble: { backgroundColor: colors.surfaceHigh, alignSelf: "flex-start" },
  message: { color: colors.text, fontSize: 15, lineHeight: 22 },
  userMessage: { color: colors.background },
  inlineCard: { backgroundColor: colors.surfaceHigh, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  inlineEyebrow: { color: colors.tertiary, ...typography.eyebrow },
  inlineTitle: { color: colors.text, fontWeight: "700", fontSize: 16 },
  inlineBody: { color: colors.textMuted },
  previewToggle: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  previewToggleText: {
    color: colors.primary,
    fontWeight: "700",
  },
  previewCard: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  previewSubject: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  previewMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  previewBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
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
  dismissLabel: { color: colors.primary, fontSize: 15, fontWeight: "700" },
});
