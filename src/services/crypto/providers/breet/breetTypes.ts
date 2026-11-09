/** Breet's raw API shapes (only the fields we use). Never exported beyond this folder. */

export interface BreetAsset {
    id: string;
    name: string;
    identifier: string;
    symbol: string;
    minimum?: number | null;
    type?: string;
    network?: string;
    confirmations?: number | null;
}

export interface BreetBank {
    id: string;
    name: string;
    slug?: string;
}

export interface BreetWallet {
    id: string;
    label: string;
    address: string;
    identifier: string;
    asset: string;
}

export interface BreetTransaction {
    id: string;
    amount: number | string;
    rate?: number | string | null;
    txHash?: string | null;
    asset: string;
    address: string;
    sourceAddress?: string | null;
    passAMLCheck?: boolean | null;
    amountReceived?: number | string | null;
    cryptoReceived: string | number;
    status: string;
    currency?: string;
    confirmations?: number | null;
    reason?: string | null;
    updatedAt: string;
}

/** One fee band, by trade size in USD: `rate` % applies from `min` up. */
export interface BreetFeeTier {
    min: number;
    max: number;
    rate: number | string;
}

export interface BreetIntegration {
    /** A flat percent, or (as Breet returns today) tiers by trade size. */
    platformFeePercent?: number | string | BreetFeeTier[];
}

export interface BreetRateQuote {
    NGNAmount: number | string;
    rate: number | string;
    cryptoAmount: number | string;
}
