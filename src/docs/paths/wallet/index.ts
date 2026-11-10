import balancePaths from "./balancePaths";
import statementPaths from "./statementPaths";
import withdrawalPaths from "./withdrawalPaths";

const walletPaths = { ...balancePaths, ...statementPaths, ...withdrawalPaths };

export default walletPaths;
