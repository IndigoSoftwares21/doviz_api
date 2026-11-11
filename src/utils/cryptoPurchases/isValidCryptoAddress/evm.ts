/**
 * EVM chains (Ethereum, BSC, Polygon, Arbitrum, Optimism, Base, Avalanche C):
 * 0x + 40 hex, the same on every one of them. Mixed-case (EIP-55) checksums
 * need Keccak, which Node doesn't ship — format only. The user confirms the
 * address and network on the confirm sheet before the PIN.
 */
const isEvmAddress = (address: string) => /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/.test(address);

export default isEvmAddress;
