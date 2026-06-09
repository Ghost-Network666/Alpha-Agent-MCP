import { WalletType } from '@polymarket/bindings/gamma';
import type { AccountIdentity } from '@polymarket/client';

/** Map legacy `CLOB_SIGNATURE_TYPE` / ts-sdk `SignatureType` to gamma `WalletType`. */
export function walletTypeFromClobSignatureType(sig: number): WalletType {
  switch (sig) {
    case 0:
      return WalletType.EOA;
    case 1:
      return WalletType.POLY_PROXY;
    case 2:
      return WalletType.GNOSIS_SAFE;
    case 3:
      return WalletType.DEPOSIT_WALLET;
    default:
      return WalletType.POLY_PROXY;
  }
}

/**
 * Resolve CLOB account identity for SDK calls (`fetchBalanceAllowance`, orders, etc.).
 * When signer === funder but the CLOB account uses POLY_PROXY (common Trust/Magic setup),
 * the SDK auto-classifies EOA; `CLOB_SIGNATURE_TYPE` corrects walletType for API queries.
 */
export function resolveClobAccountIdentity(
  sdkAccount: AccountIdentity,
  depositWallet?: string,
): AccountIdentity {
  const wallet = (depositWallet || sdkAccount.wallet) as AccountIdentity['wallet'];
  const sigRaw = process.env.CLOB_SIGNATURE_TYPE;
  const sig = sigRaw !== undefined && sigRaw !== '' ? Number(sigRaw) : undefined;

  if (sig === undefined || Number.isNaN(sig)) {
    return { ...sdkAccount, wallet };
  }

  const walletType = walletTypeFromClobSignatureType(sig);
  if (walletType === sdkAccount.walletType) {
    return { ...sdkAccount, wallet };
  }

  return {
    signer: sdkAccount.signer,
    wallet,
    walletType,
  };
}