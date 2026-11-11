const cryptoTags = [
    {
        name: "Crypto deposits",
        description:
            "Deposit addresses and conversion quotes. Crypto sent to an address is converted to naira and credited to the user's naira balance, minus Ziks's markup for that coin. Quotes are estimates; the final amount uses the rate when the deposit completes.",
    },
    {
        name: "Buy crypto",
        description: "Buy a coin with naira and have it sent to your own wallet address. Our price per coin includes the network fee; the result arrives on the socket.",
    },
    {
        name: "Naira wallet",
        description: "The user's naira balance and transaction history (from the ledger).",
    },
    {
        name: "Banks",
        description: "Banks and the user's verified bank accounts. An account must be in the user's legal name.",
    },
];

export default cryptoTags;
