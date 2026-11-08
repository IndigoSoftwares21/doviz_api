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

  transaction_pins: {
    userId: ColumnType<string>;
    pinHash: ColumnType<string>;
    failedAttempts: ColumnType<number>;
    lockedUntil: ColumnType<Date | null>;
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
