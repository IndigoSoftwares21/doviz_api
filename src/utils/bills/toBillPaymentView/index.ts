export interface BillPaymentRow {
    id: string;
    status: string;
    customerId: string;
    customerName: string | null;
    currency: string;
    amount: string;
    serviceFee: string;
    total: string;
    token: string | null;
    failureReason: string | null;
    createdAt: Date;
    finalizedAt: Date | null;
    billerId: string;
    billerName: string;
    billerCategory: string;
    billerLogoUrl: string | null;
    productId: string;
    productName: string;
}

/** A bill payment as the app sees it: Doviz names and ids only, token only once delivered. */
const toBillPaymentView = ({ row }: { row: BillPaymentRow }) => ({
    id: row.id,
    status: row.status,
    biller: { id: row.billerId, name: row.billerName, category: row.billerCategory, logoUrl: row.billerLogoUrl },
    product: { id: row.productId, name: row.productName },
    customerId: row.customerId,
    customerName: row.customerName,
    currency: row.currency,
    amount: row.amount,
    serviceFee: row.serviceFee,
    total: row.total,
    token: row.status === "completed" ? row.token : null,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    completedAt: row.finalizedAt,
});

export default toBillPaymentView;
