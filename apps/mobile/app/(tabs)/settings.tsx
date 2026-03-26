import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createApiClient } from "../../src/api/client";
import type { SettingsDto } from "../../src/api/types";
import { EditorialHeader } from "../../src/components/EditorialHeader";
import { InlineNotice } from "../../src/components/InlineNotice";
import { SurfaceCard } from "../../src/components/SurfaceCard";
import { useSession } from "../../src/state/session";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

export default function SettingsScreen() {
  const { token, clearSession, resetAgentSession } = useSession();
  const [data, setData] = useState<SettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(nextError instanceof Error ? nextError.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function save() {
    if (!token || !data) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await createApiClient(token).updateSettings(data);
      setData(updated);
      setNotice("Settings saved.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetAgentSession() {
    setError(null);
    setNotice(null);
    try {
      await resetAgentSession();
      await load();
      setNotice("Agent session reset.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to reset the agent session.");
    }
  }

  if (loading || !data) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <EditorialHeader eyebrow="PREFERENCES" title="Settings" subtitle="Control profile preferences, planning defaults, and advanced beta configuration." />
      {notice ? <InlineNotice tone="success" message={notice} /> : null}
      {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void load()} /> : null}

      <SurfaceCard elevated>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.value}>{data.profile.name}</Text>
        <Text style={styles.muted}>{data.profile.email}</Text>
      </SurfaceCard>

      <SurfaceCard elevated>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Field
          label="Timezone"
          value={data.preferences.timezone}
          onChangeText={(value) => setData({ ...data, preferences: { ...data.preferences, timezone: value } })}
        />
        <Field
          label="Work Start"
          value={data.preferences.workStart}
          onChangeText={(value) => setData({ ...data, preferences: { ...data.preferences, workStart: value } })}
        />
        <Field
          label="Work End"
          value={data.preferences.workEnd}
          onChangeText={(value) => setData({ ...data, preferences: { ...data.preferences, workEnd: value } })}
        />
        <Field
          label="Meeting Preference"
          value={data.preferences.meetingPreference}
          onChangeText={(value) =>
            setData({ ...data, preferences: { ...data.preferences, meetingPreference: value } })
          }
        />
        <Field
          label="Assistant Notes"
          value={data.preferences.assistantNotes}
          multiline
          onChangeText={(value) => setData({ ...data, preferences: { ...data.preferences, assistantNotes: value } })}
        />
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Advanced</Text>
          <Switch value={showAdvanced} onValueChange={setShowAdvanced} />
        </View>
        {showAdvanced ? (
          <View style={{ gap: spacing.md }}>
            <Field
              label="Provider"
              value={data.advanced.provider}
              onChangeText={(value) => setData({ ...data, advanced: { ...data.advanced, provider: value } })}
            />
            <Field
              label="Model"
              value={data.advanced.model}
              onChangeText={(value) => setData({ ...data, advanced: { ...data.advanced, model: value } })}
            />
            <Field
              label="Verbosity"
              value={data.advanced.toolResultVerbosity}
              onChangeText={(value) =>
                setData({
                  ...data,
                  advanced: {
                    ...data.advanced,
                    toolResultVerbosity: value === "verbose" ? "verbose" : "compact",
                  },
                })
              }
            />
            <Text style={styles.muted}>Session ID: {data.advanced.sessionId}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleResetAgentSession()}>
              <Text style={styles.secondaryText}>Reset Agent Session</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void clearSession()}>
              <Text style={styles.secondaryText}>Reconnect / Clear Token</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </SurfaceCard>

      <TouchableOpacity style={styles.primaryButton} onPress={() => void save()} disabled={saving}>
        <Text style={styles.primaryText}>{saving ? "Saving..." : "Save Settings"}</Text>
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
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        multiline={props.multiline}
        style={[styles.input, props.multiline && { minHeight: 92, textAlignVertical: "top" }]}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  sectionTitle: { color: colors.text, ...typography.section },
  value: { color: colors.text, fontSize: 18, fontWeight: "600" },
  muted: { color: colors.textMuted },
  label: { color: colors.textMuted, ...typography.label },
  input: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryText: { color: colors.background, fontWeight: "800", fontSize: 16 },
  secondaryButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceHighest,
  },
  secondaryText: { color: colors.primary, fontWeight: "700" },
});
