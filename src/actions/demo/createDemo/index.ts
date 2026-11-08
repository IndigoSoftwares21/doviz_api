import insertDemo from "./queries/insertDemo";

interface ICreateDemo {
    name: string;
}

const createDemo = async ({ name }: ICreateDemo) => {
    const data = await insertDemo({ name });

    return { data };
};

export default createDemo;
