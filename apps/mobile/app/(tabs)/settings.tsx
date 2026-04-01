import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
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
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options?: { refreshing?: boolean }) => {
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (options?.refreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      setData(await createApiClient(token).getSettings());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load settings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updateData = useCallback((updater: (current: SettingsDto) => SettingsDto) => {
    setData((current) => (current ? updater(current) : current));
  }, []);

  async function save() {
    if (!token || !data) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await createApiClient(token).updateSettings({
        profile: {
          name: data.profile.name,
        },
        preferences: {
          interests: data.preferences.interests,
        },
        advanced: {
          provider: data.advanced.provider,
          model: data.advanced.model,
          toolResultVerbosity: data.advanced.toolResultVerbosity,
        },
      });
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

  if (loading && !data) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ refreshing: true })} tintColor={colors.primary} />}
      >
        <EditorialHeader eyebrow="PREFERENCES" title="Settings" subtitle="Update your interests for better daily suggestions and planning." />
        {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void load()} /> : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ refreshing: true })} tintColor={colors.primary} />}
    >
      <EditorialHeader eyebrow="PREFERENCES" title="Settings" subtitle="Update your interests for better daily suggestions and planning." />
      {notice ? <InlineNotice tone="success" message={notice} /> : null}
      {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void load()} /> : null}

      <SurfaceCard elevated>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Field
          label="Name"
          value={data.profile.name}
          onChangeText={(value) =>
            updateData((current) => ({
              ...current,
              profile: {
                ...current.profile,
                name: value,
              },
            }))
          }
        />
        <Text style={styles.muted}>{data.profile.email}</Text>
      </SurfaceCard>

      <SurfaceCard elevated>
        <Text style={styles.sectionTitle}>Interests</Text>
        <Field
          label="Interests"
          value={data.preferences.interests}
          multiline
          onChangeText={(value) =>
            updateData((current) => ({
              ...current,
              preferences: {
                ...current.preferences,
                interests: value,
              },
            }))
          }
        />
        <Text style={styles.helper}>
          Use onboarding to set work hours, meeting preferences, and other planning context.
        </Text>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Advanced</Text>
          <Switch value={showAdvanced} onValueChange={setShowAdvanced} />
        </View>
        {showAdvanced ? (
          <View style={styles.advancedStack}>
            <Field
              label="Provider"
              value={data.advanced.provider}
              onChangeText={(value) =>
                updateData((current) => ({
                  ...current,
                  advanced: {
                    ...current.advanced,
                    provider: value,
                  },
                }))
              }
            />
            <Field
              label="Model"
              value={data.advanced.model}
              onChangeText={(value) =>
                updateData((current) => ({
                  ...current,
                  advanced: {
                    ...current.advanced,
                    model: value,
                  },
                }))
              }
            />
            <Field
              label="Verbosity"
              value={data.advanced.toolResultVerbosity}
              onChangeText={(value) =>
                updateData((current) => ({
                  ...current,
                  advanced: {
                    ...current.advanced,
                    toolResultVerbosity: value === "verbose" ? "verbose" : "compact",
                  },
                }))
              }
            />
            <Text style={styles.muted}>Session ID: {data.advanced.sessionId}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleResetAgentSession()}>
              <Text style={styles.secondaryText}>Reset Agent Session</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </SurfaceCard>

      <TouchableOpacity style={styles.primaryButton} onPress={() => void save()} disabled={saving}>
        <Text style={styles.primaryText}>{saving ? "Saving..." : "Save Settings"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.destructiveButton} onPress={() => void clearSession()}>
        <Text style={styles.destructiveText}>Sign Out</Text>
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
  muted: { color: colors.textMuted },
  helper: { color: colors.textMuted, ...typography.body },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  advancedStack: { gap: spacing.md },
  label: { color: colors.textMuted, ...typography.label },
  input: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryText: { color: colors.background, fontWeight: "800", fontSize: 16 },
  destructiveButton: {
    backgroundColor: "#5a1e26",
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#a84552",
  },
  destructiveText: { color: "#ffd7dc", fontWeight: "800", fontSize: 16 },
  secondaryButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceHighest,
    alignSelf: "flex-start",
  },
  secondaryText: { color: colors.primary, fontWeight: "700" },
});
