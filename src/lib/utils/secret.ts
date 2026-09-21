export function redactSecrets(message: string, secrets: Array<string | undefined>): string {
  let result = message;
  for (const secret of secrets) {
    if (secret) result = result.split(secret).join("[redacted]");
  }
  return result;
}

const keyName = (providerId: string) => `arbor.provider-key.${providerId}`;

export function storeSessionKey(providerId: string, key: string): void {
  if (key) sessionStorage.setItem(keyName(providerId), key);
  else sessionStorage.removeItem(keyName(providerId));
}

export function getProviderKey(provider: { id: string; apiKey?: string }): string {
  return provider.apiKey || sessionStorage.getItem(keyName(provider.id)) || "";
}

export function removeSessionKey(providerId: string): void {
  sessionStorage.removeItem(keyName(providerId));
}
