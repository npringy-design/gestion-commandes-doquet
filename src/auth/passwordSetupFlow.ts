export type PasswordSetupFlow = 'recovery' | 'invite';

export const PASSWORD_SETUP_FLOW_STORAGE_KEY = 'hippo_password_setup_flow';
export const PASSWORD_SETUP_FLOW_MAX_AGE_MS = 15 * 60 * 1000;

type StoredPasswordSetupFlow = {
  flow?: string;
  createdAt?: number;
};

export function rememberPasswordSetupFlow(flow: PasswordSetupFlow): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      PASSWORD_SETUP_FLOW_STORAGE_KEY,
      JSON.stringify({ flow, createdAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

export function clearPasswordSetupFlow(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PASSWORD_SETUP_FLOW_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasStoredPasswordSetupFlow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(PASSWORD_SETUP_FLOW_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as StoredPasswordSetupFlow;
    if (parsed.flow !== 'recovery' && parsed.flow !== 'invite') return false;
    if (!parsed.createdAt || Date.now() - parsed.createdAt > PASSWORD_SETUP_FLOW_MAX_AGE_MS) {
      clearPasswordSetupFlow();
      return false;
    }
    return true;
  } catch {
    clearPasswordSetupFlow();
    return false;
  }
}

export function detectPasswordSetupFlowFromCurrentUrl(): PasswordSetupFlow | null {
  if (typeof window === 'undefined') return null;

  try {
    const url = new URL(window.location.href);
    const searchType = url.searchParams.get('type') ?? url.searchParams.get('password_setup');
    if (searchType === 'recovery' || searchType === 'invite') return searchType;
    if (url.searchParams.get('code')) return 'recovery';

    if (url.hash) {
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
      const hashType = hashParams.get('type') ?? hashParams.get('password_setup');
      if (hashType === 'recovery' || hashType === 'invite') return hashType;
      if (hashParams.get('code')) return 'recovery';
    }
  } catch {
    // ignore
  }

  return null;
}

export function persistPasswordSetupFlowFromCurrentUrl(): boolean {
  const flow = detectPasswordSetupFlowFromCurrentUrl();
  if (!flow) return false;
  rememberPasswordSetupFlow(flow);
  return true;
}

export function hasPasswordSetupFlow(): boolean {
  return persistPasswordSetupFlowFromCurrentUrl() || hasStoredPasswordSetupFlow();
}
