import type { AccountIdentity, SecureClient, PublicActions, SecureActions } from '@polymarket/client';

/**
 * Override `client.account` for SDK `/actions` calls (balance, orders) without breaking
 * private-field access on the underlying SecureClient (Proxy `receiver` must stay `target`).
 */
export function withAccountIdentity(
  client: SecureClient<PublicActions, SecureActions>,
  account: AccountIdentity,
): SecureClient<PublicActions, SecureActions> {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'account') return account;
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as SecureClient<PublicActions, SecureActions>;
}