import { create } from 'zustand';
import type { Email, EmailType } from '@shared/types';

export type EmailFilterType = 'all' | EmailType;

// Email type metadata — shared across EmailCard, EmailDetail, EmailFilter.
// Colors use @lobehub/ui Tag presets (no hardcoded hex).
export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  review: '审稿',
  decision: '决定',
  revision: '修改',
  other: '其他',
};

export const EMAIL_TYPE_COLORS: Record<EmailType, string> = {
  review: 'blue',
  decision: 'gold',
  revision: 'orange',
  other: 'gray',
};

/** Match emails related to the current paper title (same rule as the list UI). */
export function matchesPaperTitle(email: Email, projectTitle: string): boolean {
  if (!projectTitle) return true;
  const keyword = projectTitle.toLowerCase();
  return (
    email.subject?.toLowerCase().includes(keyword) ||
    email.raw_content?.toLowerCase().includes(keyword) ||
    false
  );
}

/** Keep selectedId only if it still belongs to paper-related emails. */
function resolveSelectedId(
  emails: Email[],
  selectedId: string | null,
  projectTitle: string,
): string | null {
  const related = emails.filter((e) => matchesPaperTitle(e, projectTitle));
  if (selectedId && related.some((e) => e.id === selectedId)) {
    return selectedId;
  }
  return related[0]?.id ?? null;
}

interface SubmissionState {
  emails: Email[];
  selectedId: string | null;
  filterType: EmailFilterType;
  /** Paper title used to gate auto-select / detail preview. */
  paperTitle: string;
  imapConfigured: boolean;
  configChecked: boolean;
  loading: boolean;
  fetching: boolean;
  reclassifyingId: string | null;
  togglingReadId: string | null;
  error: string | null;

  setPaperTitle: (title: string) => void;
  checkImapConfig: () => Promise<void>;
  loadEmails: (projectId: string) => Promise<void>;
  selectEmail: (id: string | null) => void;
  filterEmails: (filter: EmailFilterType) => void;
  fetchEmails: (projectId: string) => Promise<void>;
  reclassifyEmail: (emailId: string) => Promise<void>;
  toggleRead: (email: Email) => Promise<void>;
}

export const useSubmissionStore = create<SubmissionState>((set, get) => ({
  emails: [],
  selectedId: null,
  filterType: 'all',
  paperTitle: '',
  imapConfigured: false,
  configChecked: false,
  loading: false,
  fetching: false,
  reclassifyingId: null,
  togglingReadId: null,
  error: null,

  setPaperTitle: (title) => {
    const { emails, selectedId } = get();
    set({
      paperTitle: title,
      selectedId: resolveSelectedId(emails, selectedId, title),
    });
  },

  checkImapConfig: async () => {
    set({ error: null });
    try {
      const config = await window.api.db.emailConfig.get();
      set({ imapConfigured: config !== null, configChecked: true });
    } catch (e) {
      const error = e as Error;
      set({
        error: error.message,
        imapConfigured: false,
        configChecked: true,
      });
    }
  },

  loadEmails: async (projectId) => {
    set({ loading: true, error: null, selectedId: null });
    try {
      const emails = await window.api.db.emails.list(projectId);
      // Sort chronologically — newest first (received_at descending)
      const sorted = [...emails].sort(
        (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
      );
      const paperTitle = get().paperTitle;
      set({
        emails: sorted,
        loading: false,
        selectedId: resolveSelectedId(sorted, null, paperTitle),
      });
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, loading: false });
    }
  },

  selectEmail: (id) => set({ selectedId: id }),

  filterEmails: (filter) => set({ filterType: filter }),

  fetchEmails: async (projectId) => {
    // Guard against concurrent fetches — poll/visibility/manual can overlap
    if (get().fetching) return;
    set({ fetching: true, error: null });

    // Subscribe to streaming events — each new email is pushed to the list
    // immediately as it's processed, so the user sees it appear in real-time.
    const existingIds = new Set(get().emails.map((e) => e.id));
    const unsubscribe = window.api.email.onEmailFetched((email) => {
      if (existingIds.has(email.id)) return;
      existingIds.add(email.id);
      const current = get().emails;
      const merged = [email, ...current].sort(
        (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
      );
      const paperTitle = get().paperTitle;
      // Only auto-select paper-related emails so the detail pane stays in sync
      // with the title-filtered list on the left.
      const nextSelected =
        get().selectedId ??
        (matchesPaperTitle(email, paperTitle) ? email.id : null);
      set({ emails: merged, selectedId: nextSelected });
    });

    try {
      await window.api.email.fetch(projectId);
      // Final reload from DB to catch any updates to existing emails
      const emails = await window.api.db.emails.list(projectId);
      const sorted = [...emails].sort(
        (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
      );
      const paperTitle = get().paperTitle;
      set({
        emails: sorted,
        fetching: false,
        selectedId: resolveSelectedId(sorted, get().selectedId, paperTitle),
      });
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, fetching: false });
    } finally {
      unsubscribe();
    }
  },

  reclassifyEmail: async (emailId) => {
    set({ reclassifyingId: emailId, error: null });
    try {
      const newType = await window.api.email.classify(emailId);
      set({
        emails: get().emails.map((e) =>
          e.id === emailId ? { ...e, email_type: newType } : e,
        ),
        reclassifyingId: null,
      });
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, reclassifyingId: null });
    }
  },

  toggleRead: async (email) => {
    set({ togglingReadId: email.id, error: null });
    try {
      const nextRead = email.is_read === 1 ? 0 : 1;
      const updated = await window.api.db.emails.update(email.id, {
        is_read: nextRead,
      });
      set({
        emails: get().emails.map((e) => (e.id === email.id ? updated : e)),
        togglingReadId: null,
      });
    } catch (e) {
      const error = e as Error;
      set({ error: error.message, togglingReadId: null });
    }
  },
}));
