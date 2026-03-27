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
  const [showTimezoneOptions, setShowTimezoneOptions] = useState(false);
  const [showProviderOptions, setShowProviderOptions] = useState(false);
  const [showVerbosityOptions, setShowVerbosityOptions] = useState(false);
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

  if (loading && !data) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ refreshing: true })} tintColor={colors.primary} />}
    >
      <EditorialHeader eyebrow="PREFERENCES" title="Settings" subtitle="Control profile preferences, planning defaults, and advanced beta configuration." />
      {notice ? <InlineNotice tone="success" message={notice} /> : null}
      {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void load()} /> : null}

      <SurfaceCard elevated>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Field
          label="Name"
          value={data.profile.name}
          onChangeText={(value) => setData({ ...data, profile: { ...data.profile, name: value } })}
        />
        <Text style={styles.muted}>{data.profile.email}</Text>
      </SurfaceCard>

      <SurfaceCard elevated>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <SelectField
          label="Timezone"
          value={data.preferences.timezone}
          open={showTimezoneOptions}
          options={buildTimezoneOptions(data.preferences.timezone)}
          onToggle={() => {
            setShowTimezoneOptions((value) => !value);
            setShowProviderOptions(false);
            setShowVerbosityOptions(false);
          }}
          onSelect={(value) => {
            setData({ ...data, preferences: { ...data.preferences, timezone: value } });
            setShowTimezoneOptions(false);
          }}
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
          label="Personalized Notes"
          value={mergePersonalizedNotes(data.preferences.meetingPreference, data.preferences.assistantNotes)}
          multiline
          onChangeText={(value) =>
            setData({
              ...data,
              preferences: {
                ...data.preferences,
                meetingPreference: value,
                assistantNotes: value,
              },
            })
          }
        />
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Advanced</Text>
          <Switch value={showAdvanced} onValueChange={setShowAdvanced} />
        </View>
        {showAdvanced ? (
          <View style={{ gap: spacing.md }}>
            <SelectField
              label="Provider"
              value={data.advanced.provider}
              open={showProviderOptions}
              options={[
                { label: "Groq", value: "groq" },
                { label: "Gemini", value: "gemini" },
              ]}
              onToggle={() => {
                setShowProviderOptions((value) => !value);
                setShowTimezoneOptions(false);
                setShowVerbosityOptions(false);
              }}
              onSelect={(value) => {
                setData({ ...data, advanced: { ...data.advanced, provider: value } });
                setShowProviderOptions(false);
              }}
            />
            <Field
              label="Model"
              value={data.advanced.model}
              onChangeText={(value) => setData({ ...data, advanced: { ...data.advanced, model: value } })}
            />
            <SelectField
              label="Verbosity"
              value={data.advanced.toolResultVerbosity}
              open={showVerbosityOptions}
              options={[
                { label: "Compact", value: "compact" },
                { label: "Verbose", value: "verbose" },
              ]}
              onToggle={() => {
                setShowVerbosityOptions((value) => !value);
                setShowTimezoneOptions(false);
                setShowProviderOptions(false);
              }}
              onSelect={(value) => {
                setData({
                  ...data,
                  advanced: {
                    ...data.advanced,
                    toolResultVerbosity: value === "verbose" ? "verbose" : "compact",
                  },
                });
                setShowVerbosityOptions(false);
              }}
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

function buildTimezoneOptions(selectedValue: string) {
  const options = [
    { label: "Pacific Time", value: "America/Los_Angeles" },
    { label: "Mountain Time", value: "America/Denver" },
    { label: "Central Time", value: "America/Chicago" },
    { label: "Eastern Time", value: "America/New_York" },
    { label: "Alaska Time", value: "America/Anchorage" },
    { label: "Hawaii Time", value: "Pacific/Honolulu" },
    { label: "UTC", value: "UTC" },
    { label: "London", value: "Europe/London" },
    { label: "Paris", value: "Europe/Paris" },
    { label: "Tokyo", value: "Asia/Tokyo" },
    { label: "Sydney", value: "Australia/Sydney" },
  ];

  if (options.some((option) => option.value === selectedValue)) {
    return options;
  }

  return [{ label: selectedValue, value: selectedValue }, ...options];
}

function mergePersonalizedNotes(meetingPreference: string, assistantNotes: string) {
  const normalizedMeetingPreference = meetingPreference.trim();
  const normalizedAssistantNotes = assistantNotes.trim();

  if (!normalizedMeetingPreference) {
    return normalizedAssistantNotes;
  }

  if (!normalizedAssistantNotes) {
    return normalizedMeetingPreference;
  }

  if (normalizedMeetingPreference === normalizedAssistantNotes) {
    return normalizedAssistantNotes;
  }

  return `${normalizedMeetingPreference}\n\n${normalizedAssistantNotes}`;
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

function SelectField(props: {
  label: string;
  value: string;
  open: boolean;
  options: Array<{ label: string; value: string }>;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  const selected = props.options.find((option) => option.value === props.value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TouchableOpacity style={styles.selectTrigger} onPress={props.onToggle}>
        <Text style={styles.selectValue}>{selected?.label ?? props.value}</Text>
        <Text style={styles.selectChevron}>{props.open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {props.open ? (
        <ScrollView style={styles.selectMenu} contentContainerStyle={styles.selectMenuContent} nestedScrollEnabled>
          {props.options.map((option) => {
            const active = option.value === props.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.selectOption, active && styles.selectOptionActive]}
                onPress={() => props.onSelect(option.value)}
              >
                <Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
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
  selectTrigger: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectValue: { color: colors.text, fontSize: 16 },
  selectChevron: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  selectMenu: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    maxHeight: 220,
  },
  selectMenuContent: {
    padding: 6,
    gap: 4,
  },
  selectOption: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectOptionActive: {
    backgroundColor: colors.surface,
  },
  selectOptionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  selectOptionTextActive: {
    color: colors.primary,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  },
  secondaryText: { color: colors.primary, fontWeight: "700" },
});
