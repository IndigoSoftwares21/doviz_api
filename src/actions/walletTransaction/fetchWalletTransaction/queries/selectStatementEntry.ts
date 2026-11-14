import { db } from "@/database";
import { LEDGER_ACCOUNT_KIND } from "@/constants/ledger";

/** One of the user's statement lines (existence/ownership checked in the schema). */
const selectStatementEntry = async ({ userId, entryId }: { userId: string; entryId: string }) => {
    const entryRow = await db
        .selectFrom("ledger_entries")
        .innerJoin("ledger_accounts", "ledger_accounts.id", "ledger_entries.accountId")
        .innerJoin("ledger_transactions", "ledger_transactions.id", "ledger_entries.transactionId")
        .leftJoin("crypto_deposits", "crypto_deposits.ledgerTransactionId", "ledger_transactions.id")
        .leftJoin("crypto_assets", "crypto_assets.id", "crypto_deposits.assetId")
        .leftJoin("internal_transfers", "internal_transfers.ledgerTransactionId", "ledger_transactions.id")
        .leftJoin("users as transfer_sender", "transfer_sender.id", "internal_transfers.senderId")
        .leftJoin("users as transfer_recipient", "transfer_recipient.id", "internal_transfers.recipientId")
        .leftJoin("naira_deposits", "naira_deposits.ledgerTransactionId", "ledger_transactions.id")
        // The bill this line belongs to: its hold, or its final settle/refund
        // (both columns are unique, so at most one payment matches).
        .leftJoin("bill_payments", (join) =>
            join.on((eb) =>
                eb.or([
                    eb("bill_payments.holdLedgerTransactionId", "=", eb.ref("ledger_transactions.id")),
                    eb("bill_payments.finalLedgerTransactionId", "=", eb.ref("ledger_transactions.id")),
                ]),
            ),
        )
        // The withdrawal this line belongs to (its hold, or its final settle/refund).
        .leftJoin("bank_withdrawals", (join) =>
            join.on((eb) =>
                eb.or([
                    eb("bank_withdrawals.holdLedgerTransactionId", "=", eb.ref("ledger_transactions.id")),
                    eb("bank_withdrawals.finalLedgerTransactionId", "=", eb.ref("ledger_transactions.id")),
                ]),
            ),
        )
        .leftJoin("user_bank_accounts as withdrawal_account", "withdrawal_account.id", "bank_withdrawals.bankAccountId")
        .leftJoin("payout_banks as withdrawal_bank", "withdrawal_bank.id", "withdrawal_account.payoutBankId")
        .leftJoin("payout_banks as recipient_bank", "recipient_bank.id", "bank_withdrawals.recipientPayoutBankId")
        // The crypto purchase this line belongs to (its hold, or its refund).
        .leftJoin("crypto_purchases", (join) =>
            join.on((eb) =>
                eb.or([
                    eb("crypto_purchases.holdLedgerTransactionId", "=", eb.ref("ledger_transactions.id")),
                    eb("crypto_purchases.finalLedgerTransactionId", "=", eb.ref("ledger_transactions.id")),
                ]),
            ),
        )
        .leftJoin("crypto_assets as purchase_asset", "purchase_asset.id", "crypto_purchases.assetId")
        .leftJoin("billers", "billers.id", "bill_payments.billerId")
        .leftJoin("bill_products", "bill_products.id", "bill_payments.productId")
        .select([
            "ledger_entries.id",
            "ledger_entries.amount",
            "ledger_entries.balanceAfter",
            "ledger_entries.createdAt",
            "ledger_transactions.type",
            "crypto_deposits.id as depositId",
            "crypto_assets.symbol",
            "crypto_assets.network",
            "crypto_deposits.cryptoAmount",
            "crypto_deposits.grossNgn",
            "crypto_deposits.markupNgn",
            "crypto_deposits.markupPercent",
            "internal_transfers.id as transferId",
            "internal_transfers.senderTag as transferSenderTag",
            "internal_transfers.recipientTag as transferRecipientTag",
            "internal_transfers.note as transferNote",
            "transfer_sender.firstName as transferSenderFirstName",
            "transfer_sender.lastName as transferSenderLastName",
            "transfer_recipient.firstName as transferRecipientFirstName",
            "transfer_recipient.lastName as transferRecipientLastName",
            "bill_payments.id as billPaymentId",
            "billers.categoryCode as billCategory",
            "billers.name as billerName",
            "bill_products.name as billProductName",
            "bill_payments.customerId as billCustomerId",
            "bill_payments.token as billToken",
            "crypto_purchases.id as purchaseId",
            "crypto_purchases.status as purchaseStatus",
            "purchase_asset.symbol as purchaseSymbol",
            "purchase_asset.network as purchaseNetwork",
            "crypto_purchases.cryptoAmount as purchaseCryptoAmount",
            "crypto_purchases.networkFee as purchaseNetworkFee",
            "crypto_purchases.unitPrice as purchaseUnitPrice",
            "crypto_purchases.nairaAmount as purchaseNairaAmount",
            "crypto_purchases.nairaFee as purchaseNairaFee",
            "crypto_purchases.totalNaira as purchaseTotal",
            "crypto_purchases.address as purchaseAddress",
            "crypto_purchases.memo as purchaseMemo",
            "crypto_purchases.txHash as purchaseTxHash",
            "crypto_purchases.failureReason as purchaseFailureReason",
            "crypto_purchases.requestedAt as purchaseRequestedAt",
            "crypto_purchases.finalizedAt as purchaseCompletedAt",
            "crypto_deposits.rateNgnPerUsd",
            "crypto_deposits.txHash",
            "crypto_deposits.confirmations",
            "crypto_deposits.detectedAt",
            "crypto_deposits.completedAt",
            "naira_deposits.id as nairaDepositId",
            "naira_deposits.senderName",
            "naira_deposits.senderBankName",
            "naira_deposits.senderAccountNumber",
            "bank_withdrawals.id as withdrawalId",
            "bank_withdrawals.status as withdrawalStatus",
            "bank_withdrawals.amount as withdrawalAmount",
            "bank_withdrawals.fee as withdrawalFee",
            "bank_withdrawals.feeReserve as withdrawalFeeReserve",
            "bank_withdrawals.failureReason as withdrawalFailureReason",
            "bank_withdrawals.requestedAt as withdrawalRequestedAt",
            "bank_withdrawals.finalizedAt as withdrawalFinalizedAt",
            "withdrawal_account.accountName as withdrawalAccountName",
            "withdrawal_account.accountNumber as withdrawalAccountNumber",
            "withdrawal_bank.name as withdrawalBankName",
            "bank_withdrawals.recipientAccountName as withdrawalRecipientName",
            "bank_withdrawals.recipientAccountNumber as withdrawalRecipientNumber",
            "recipient_bank.name as withdrawalRecipientBankName",
            "bank_withdrawals.narration as withdrawalNarration",
            "naira_deposits.amountReceived as depositAmountReceived",
            "naira_deposits.providerFee as depositFee",
            "naira_deposits.amountCredited as depositAmountCredited",
        ])
        .where("ledger_entries.id", "=", entryId)
        .where("ledger_accounts.kind", "=", LEDGER_ACCOUNT_KIND.USER_AVAILABLE)
        .where("ledger_accounts.userId", "=", userId)
        .executeTakeFirstOrThrow();

    return entryRow;
};

export default selectStatementEntry;
