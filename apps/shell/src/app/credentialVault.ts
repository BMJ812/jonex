import { appLocalDataDir, join } from "@tauri-apps/api/path";
import {
  Client,
  Stronghold,
  type Store,
} from "@tauri-apps/plugin-stronghold";

const clientName = "jonex-credentials";
const selfTestKey = "jonex.vault.self-test";

interface VaultSession {
  stronghold: Stronghold;
  client: Client;
  store: Store;
  path: string;
}

export interface CredentialVaultStatus {
  unlocked: boolean;
  path: string | null;
}

let session: VaultSession | null = null;

export async function unlockCredentialVault(
  passphrase: string,
): Promise<CredentialVaultStatus> {
  const normalizedPassphrase = passphrase.trim();

  if (normalizedPassphrase.length < 12) {
    throw new Error("Vault passphrase must be at least 12 characters.");
  }

  if (session) {
    return {
      unlocked: true,
      path: session.path,
    };
  }

  const localData = await appLocalDataDir();
  const vaultPath = await join(localData, "credentials.hold");
  const stronghold = await Stronghold.load(vaultPath, normalizedPassphrase);

  let client: Client;

  try {
    client = await stronghold.loadClient(clientName);
  } catch {
    client = await stronghold.createClient(clientName);
  }

  const store = client.getStore();
  session = {
    stronghold,
    client,
    store,
    path: vaultPath,
  };

  await runVaultSelfTest(session);

  return {
    unlocked: true,
    path: vaultPath,
  };
}

export async function lockCredentialVault(): Promise<void> {
  const current = session;
  session = null;

  if (current) {
    await current.stronghold.unload();
  }
}

export function getCredentialVaultStatus(): CredentialVaultStatus {
  return {
    unlocked: session !== null,
    path: session?.path ?? null,
  };
}

export async function saveServiceCredential(
  serviceId: string,
  value: string,
): Promise<void> {
  const current = requireSession();
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Credential cannot be empty.");
  }

  await current.store.insert(
    serviceCredentialKey(serviceId),
    Array.from(new TextEncoder().encode(normalized)),
  );
  await current.stronghold.save();
}

export async function getServiceCredential(
  serviceId: string,
): Promise<string | null> {
  const current = requireSession();
  const data = await current.store.get(serviceCredentialKey(serviceId));

  if (!data) {
    return null;
  }

  return new TextDecoder().decode(data);
}

export async function hasServiceCredential(
  serviceId: string,
): Promise<boolean> {
  return (await getServiceCredential(serviceId)) !== null;
}

export async function removeServiceCredential(
  serviceId: string,
): Promise<boolean> {
  const current = requireSession();
  const removed = await current.store.remove(serviceCredentialKey(serviceId));
  await current.stronghold.save();
  return removed !== null;
}

function requireSession(): VaultSession {
  if (!session) {
    throw new Error("Credential vault is locked.");
  }

  return session;
}

function serviceCredentialKey(serviceId: string): string {
  const normalized = serviceId.trim();

  if (!normalized) {
    throw new Error("Service id cannot be empty.");
  }

  return `service:${normalized}:credential`;
}

async function runVaultSelfTest(current: VaultSession): Promise<void> {
  const marker = crypto.randomUUID();
  const encoded = Array.from(new TextEncoder().encode(marker));

  await current.store.insert(selfTestKey, encoded);
  await current.stronghold.save();

  const recovered = await current.store.get(selfTestKey);
  const decoded = recovered
    ? new TextDecoder().decode(recovered)
    : null;

  if (decoded !== marker) {
    session = null;
    await current.stronghold.unload();
    throw new Error("Credential vault self-test failed.");
  }

  await current.store.remove(selfTestKey);
  await current.stronghold.save();
}
