/** KuCoin response shapes we read (only the fields we use). */

export interface KucoinEnvelope<T> {
    code?: string;
    msg?: string;
    data?: T;
}

export interface KucoinChain {
    chainName?: string;
    chainId: string;
    withdrawalMinSize?: string;
    withdrawMinSize?: string;
    withdrawalMinFee?: string;
    withdrawMinFee?: string;
    withdrawPrecision?: number;
    needTag?: boolean;
    isWithdrawEnabled?: boolean;
}

export interface KucoinCurrency {
    currency: string;
    precision?: number;
    chains?: KucoinChain[] | null;
}

export interface KucoinWithdrawalQuota {
    currency: string;
    chain?: string;
    withdrawMinFee: string;
    withdrawMinSize: string;
    precision: number;
    isWithdrawEnabled: boolean;
}

export interface KucoinAccount {
    currency: string;
    type: string;
    available: string;
}

export interface KucoinWithdrawal {
    id: string;
    currency?: string;
    chain?: string;
    status: string;
    amount?: string | null;
    fee?: string | null;
    walletTxId?: string | null;
    remark?: string | null;
    failureReason?: string | null;
    failureReasonMsg?: string | null;
}

export interface KucoinWithdrawalPage {
    items: KucoinWithdrawal[];
}
