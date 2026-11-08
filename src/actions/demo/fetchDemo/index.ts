import selectDemo from "./queries/selectDemo";

interface IFetchDemo {
    limit: number;
}

const fetchDemo = async ({ limit }: IFetchDemo) => {
    const data = await selectDemo({ limit });

    return { data };
};

export default fetchDemo;
