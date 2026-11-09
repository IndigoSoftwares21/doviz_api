/**
 * This file was automatically generated.
 * DO NOT MODIFY IT MANUALLY.
 *
 * Column names are camelCase (DB_TYPES_CASE=camel).
 * Table names always match the real DB table names.
 */

import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

// Database interface with auto-generated fields wrapped in Generated<>
export interface Database {
  audit_logs: {
    id: Generated<string>;
    actorType: ColumnType<string>;
    actorId: ColumnType<string | null>;
    action: ColumnType<string>;
    entityType: ColumnType<string | null>;
    entityId: ColumnType<string | null>;
    ipAddress: ColumnType<string | null>;
    userAgent: ColumnType<string | null>;
    metadata: ColumnType<unknown>;
    createdAt: Generated<Date>;
  };

  auth_refresh_tokens: {
    id: Generated<string>;
    sessionId: ColumnType<string>;
    tokenHash: ColumnType<string>;
    rotatedAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
  };

  auth_sessions: {
    id: Generated<string>;
    userId: ColumnType<string>;
    ipAddress: ColumnType<string | null>;
    userAgent: ColumnType<string | null>;
    expiresAt: ColumnType<Date>;
    revokedAt: ColumnType<Date | null>;
    lastUsedAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
    userDeviceId: ColumnType<string | null>;
    revokedReason: ColumnType<string | null>;
  };

  bank_withdrawals: {
    id: Generated<string>;
    userId: ColumnType<string>;
    bankAccountId: ColumnType<string>;
    provider: ColumnType<string>;
    providerReference: ColumnType<string | null>;
    currency: ColumnType<string>;
    amount: ColumnType<string>;
    fee: ColumnType<string | null>;
    status: ColumnType<string>;
    failureReason: ColumnType<string | null>;
    holdLedgerTransactionId: ColumnType<string>;
    finalLedgerTransactionId: ColumnType<string | null>;
    requestedAt: Generated<Date>;
    finalizedAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
    updatedAt: Generated<Date>;
  };

  biometric_challenges: {
    id: Generated<string>;
    userId: ColumnType<string>;
    biometricKeyId: ColumnType<string>;
    challenge: ColumnType<string>;
    expiresAt: ColumnType<Date>;
    consumedAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
    purpose: ColumnType<string>;
  };

  biometric_keys: {
    id: Generated<string>;
    userId: ColumnType<string>;
    deviceId: ColumnType<string>;
    deviceName: ColumnType<string | null>;
    publicKey: ColumnType<string>;
    lastUsedAt: ColumnType<Date | null>;
    revokedAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
  };

  conversion_markups: {
    id: Generated<string>;
    assetId: ColumnType<string>;
    currency: ColumnType<string>;
    markupPercent: ColumnType<string>;
    effectiveFrom: Generated<Date>;
    note: ColumnType<string | null>;
    createdAt: Generated<Date>;
  };

  crypto_assets: {
    id: Generated<string>;
    symbol: ColumnType<string>;
    network: ColumnType<string>;
    name: ColumnType<string>;
    decimals: ColumnType<number>;
    isEnabled: ColumnType<boolean>;
    createdAt: Generated<Date>;
    updatedAt: Generated<Date>;
  };

  crypto_deposits: {
    id: Generated<string>;
    provider: ColumnType<string>;
    providerReference: ColumnType<string>;
    walletId: ColumnType<string>;
    userId: ColumnType<string>;
    assetId: ColumnType<string>;
    status: ColumnType<string>;
    subStatus: ColumnType<string | null>;
    cryptoAmount: ColumnType<string>;
    reportedUsd: ColumnType<string | null>;
    rateNgnPerUsd: ColumnType<string | null>;
    grossNgn: ColumnType<string | null>;
    conversionMarkupId: ColumnType<string | null>;
    markupPercent: ColumnType<string | null>;
    markupNgn: ColumnType<string | null>;
    netNgn: ColumnType<string | null>;
    ledgerTransactionId: ColumnType<string | null>;
    txHash: ColumnType<string | null>;
    senderAddress: ColumnType<string | null>;
    confirmations: ColumnType<number | null>;
    amlPassed: ColumnType<boolean | null>;
    lastEventAt: ColumnType<Date | null>;
    detectedAt: Generated<Date>;
    completedAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
    updatedAt: Generated<Date>;
  };

  crypto_provider_assets: {
    id: Generated<string>;
    assetId: ColumnType<string>;
    provider: ColumnType<string>;
    environment: ColumnType<string>;
    providerAssetId: ColumnType<string>;
    providerCode: ColumnType<string>;
    minDeposit: ColumnType<string | null>;
    confirmations: ColumnType<number | null>;
    isEnabled: ColumnType<boolean>;
    syncedAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
    updatedAt: Generated<Date>;
  };

  crypto_wallets: {
    id: Generated<string>;
    userId: ColumnType<string>;
    assetId: ColumnType<string>;
    provider: ColumnType<string>;
    label: ColumnType<string>;
    status: ColumnType<string>;
    isPrimary: ColumnType<boolean>;
    address: ColumnType<string | null>;
    providerWalletId: ColumnType<string | null>;
    activatedAt: ColumnType<Date | null>;
    retiredAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
    updatedAt: Generated<Date>;
  };

  demo: {
    id: Generated<number>;
    name: ColumnType<string>;
    createdAt: Generated<Date | null>;
  };

  email_verifications: {
    id: Generated<string>;
    userId: ColumnType<string>;
    email: ColumnType<string>;
    codeHash: ColumnType<string>;
    attempts: ColumnType<number>;
    maxAttempts: ColumnType<number>;
    expiresAt: ColumnType<Date>;
    consumedAt: ColumnType<Date | null>;
    revokedAt: ColumnType<Date | null>;
    requestIp: ColumnType<string | null>;
    userAgent: ColumnType<string | null>;
    createdAt: Generated<Date>;
  };

  knex_migrations: {
    id: Generated<number>;
    name: ColumnType<string | null>;
    batch: ColumnType<number | null>;
    migrationTime: ColumnType<Date | null>;
  };

  knex_migrations_lock: {
    index: Generated<number>;
    isLocked: ColumnType<number | null>;
  };

  ledger_accounts: {
    id: Generated<string>;
    kind: ColumnType<string>;
    userId: ColumnType<string | null>;
    provider: ColumnType<string | null>;
    currency: ColumnType<string>;
    balance: ColumnType<string>;
    createdAt: Generated<Date>;
    updatedAt: Generated<Date>;
  };

  ledger_entries: {
    id: Generated<string>;
    transactionId: ColumnType<string>;
    accountId: ColumnType<string>;
    currency: ColumnType<string>;
    amount: ColumnType<string>;
    balanceAfter: ColumnType<string>;
    createdAt: Generated<Date>;
  };

  ledger_transactions: {
    id: Generated<string>;
    idempotencyKey: ColumnType<string>;
    type: ColumnType<string>;
    description: ColumnType<string | null>;
    metadata: ColumnType<unknown>;
    createdAt: Generated<Date>;
  };

  payout_banks: {
    id: Generated<string>;
    name: ColumnType<string>;
    code: ColumnType<string | null>;
    isEnabled: ColumnType<boolean>;
    createdAt: Generated<Date>;
    updatedAt: Generated<Date>;
    slug: ColumnType<string>;
  };

  phone_otps: {
    id: Generated<string>;
    phoneNumber: ColumnType<string>;
    purpose: ColumnType<string>;
    codeHash: ColumnType<string>;
    attempts: ColumnType<number>;
    maxAttempts: ColumnType<number>;
    expiresAt: ColumnType<Date>;
    consumedAt: ColumnType<Date | null>;
    revokedAt: ColumnType<Date | null>;
    requestIp: ColumnType<string | null>;
    userAgent: ColumnType<string | null>;
    createdAt: Generated<Date>;
  };

  provider_banks: {
    id: Generated<string>;
    payoutBankId: ColumnType<string>;
    provider: ColumnType<string>;
    environment: ColumnType<string>;
    providerBankId: ColumnType<string>;
    syncedAt: ColumnType<Date | null>;
  };

  provider_webhook_events: {
    id: Generated<string>;
    provider: ColumnType<string>;
    eventId: ColumnType<string>;
    eventName: ColumnType<string>;
    resourceId: ColumnType<string | null>;
    eventTime: ColumnType<Date | null>;
    payload: ColumnType<unknown>;
    sourceIp: ColumnType<string | null>;
    status: ColumnType<string>;
    attempts: ColumnType<number>;
    lastError: ColumnType<string | null>;
    receivedAt: Generated<Date>;
    processedAt: ColumnType<Date | null>;
  };

  transaction_pins: {
    userId: ColumnType<string>;
    pinHash: ColumnType<string>;
    failedAttempts: ColumnType<number>;
    lockedUntil: ColumnType<Date | null>;
    createdAt: Generated<Date>;
    updatedAt: Generated<Date>;
  };

  user_bank_accounts: {
    id: Generated<string>;
    userId: ColumnType<string>;
    payoutBankId: ColumnType<string>;
    accountNumber: ColumnType<string>;
    accountName: ColumnType<string>;
    isPrimary: ColumnType<boolean>;
    status: ColumnType<string>;
    verifiedAt: ColumnType<Date>;
    removedAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
    updatedAt: Generated<Date>;
  };

  user_devices: {
    id: Generated<string>;
    userId: ColumnType<string>;
    deviceId: ColumnType<string>;
    deviceName: ColumnType<string | null>;
    platform: ColumnType<string | null>;
    lastIp: ColumnType<string | null>;
    lastSeenAt: Generated<Date>;
    trustedAt: Generated<Date>;
    revokedAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
  };

  users: {
    id: Generated<string>;
    phoneNumber: ColumnType<string>;
    phoneVerifiedAt: ColumnType<Date | null>;
    lastLoginAt: ColumnType<Date | null>;
    createdAt: Generated<Date>;
    updatedAt: Generated<Date>;
    email: ColumnType<string | null>;
    emailVerifiedAt: ColumnType<Date | null>;
    firstName: ColumnType<string | null>;
    middleName: ColumnType<string | null>;
    lastName: ColumnType<string | null>;
    nameUpdatedAt: ColumnType<Date | null>;
    status: ColumnType<string>;
  };

}

// Utility types for better type safety
export type Row<Table extends keyof Database> = Selectable<Database[Table]>;
export type InsertRow<Table extends keyof Database> = Insertable<Database[Table]>;
export type UpdateRow<Table extends keyof Database> = Updateable<Database[Table]>;
