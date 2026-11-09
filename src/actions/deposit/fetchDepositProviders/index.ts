import selectDepositProviders from "./queries/selectDepositProviders";

const fetchDepositProviders = async () => {
    const providerRows = await selectDepositProviders();

    const data = providerRows.map((row) => row.provider);

    return { data };
};

export default fetchDepositProviders;
