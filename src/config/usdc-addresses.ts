// Refer to the documentation to learn more about the USDC addresses
// Testnet: https://developers.circle.com/stablecoins/usdc-on-test-networks
// Mainnet: https://developers.circle.com/stablecoins/usdc-on-main-networks

interface UsdcAddresses {
	[chain: string]: string;
}

export const USDC_TESTNET_ADDRESSES: UsdcAddresses = {
	arbitrumSepolia: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
	avalancheFuji: '0x5425890298aed601595a70ab815c96711a31bc65',
	solanaDevnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
	ethereumSepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
	celoAlfajores: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
	baseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
	optimismSepolia: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
	suiTestnet: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
};

export const USDC_MAINNET_ADDRESSES: UsdcAddresses = {
	arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
	avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
	solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
	ethereum: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
	celo: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
	base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
	optimism: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
	sui: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
};
