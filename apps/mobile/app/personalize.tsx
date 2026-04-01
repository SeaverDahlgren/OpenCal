import { useCallback, useState } from "react";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createApiClient } from "../src/api/client";
import type { SettingsDto } from "../src/api/types";
import { EditorialHeader } from "../src/components/EditorialHeader";
import { InlineNotice } from "../src/components/InlineNotice";
import { SurfaceCard } from "../src/components/SurfaceCard";
import { useSession } from "../src/state/session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function PersonalizeScreen() {
  const { token, session, refreshSession } = useSession();
  const [data, setData] = useState<SettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await createApiClient(token).getSettings());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load personalization.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function submit(skip = false) {
    if (!token) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createApiClient(token).updateSettings({
        ...(skip ? {} : data ?? {}),
        personalization: {
          markCompleted: true,
        },
      });
      await refreshSession();
      router.replace("/(tabs)/today");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save personalization.");
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return <Redirect href="/signin" />;
  }

  if (session && !session.needsPersonalization) {
    return <Redirect href="/(tabs)/today" />;
  }

  if (loading && !data) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <EditorialHeader
        eyebrow="PERSONALIZATION"
        title="Set up your preferences"
        subtitle="Answer four quick questions so OpenCal can personalize planning and advice."
      />
      {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void load()} /> : null}
      {data ? (
        <SurfaceCard elevated>
          <Field
            label="Current Interests"
            value={data.preferences.interests}
            multiline
            onChangeText={(value) =>
              setData({
                ...data,
                preferences: {
                  ...data.preferences,
                  interests: value,
                },
              })
            }
          />
          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Field
                label="Work Start"
                value={data.preferences.workStart}
                onChangeText={(value) =>
                  setData({
                    ...data,
                    preferences: {
                      ...data.preferences,
                      workStart: value,
                    },
                  })
                }
              />
            </View>
            <View style={styles.inlineField}>
              <Field
                label="Work End"
                value={data.preferences.workEnd}
                onChangeText={(value) =>
                  setData({
                    ...data,
                    preferences: {
                      ...data.preferences,
                      workEnd: value,
                    },
                  })
                }
              />
            </View>
          </View>
          <Field
            label="Meeting Preferences"
            value={data.preferences.meetingPreference}
            multiline
            onChangeText={(value) =>
              setData({
                ...data,
                preferences: {
                  ...data.preferences,
                  meetingPreference: value,
                },
              })
            }
          />
          <Field
            label="Anything else I should know?"
            value={data.preferences.additionalContext}
            multiline
            onChangeText={(value) =>
              setData({
                ...data,
                preferences: {
                  ...data.preferences,
                  additionalContext: value,
                },
              })
            }
          />
        </SurfaceCard>
      ) : null}
      <TouchableOpacity style={styles.primaryButton} onPress={() => void submit(false)} disabled={saving || !data}>
        <Text style={styles.primaryText}>{saving ? "Saving..." : "Save and continue"}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => void submit(true)} disabled={saving}>
        <Text style={styles.secondaryText}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        multiline={props.multiline}
        style={[styles.input, props.multiline && styles.inputMultiline]}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 },
  loader: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  field: { gap: 6 },
  label: { color: colors.textMuted, ...typography.label },
  input: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputMultiline: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  inlineRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  inlineField: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryText: { color: colors.background, fontWeight: "800", fontSize: 16 },
  secondaryButton: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  secondaryText: { color: colors.primary, fontWeight: "800", fontSize: 16 },
});
