import {
	ChainAddress,
	ChainContext,
	Network,
	Signer,
	Wormhole,
	Chain,
	TokenId,
	isTokenId,
	TokenBridge,
} from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import sui from '@wormhole-foundation/sdk/sui';
import aptos from '@wormhole-foundation/sdk/aptos';
import { config } from 'dotenv';
import * as fs from 'fs';
import bs58 from 'bs58';
config();

export interface SignerStuff<N extends Network, C extends Chain> {
	chain: ChainContext<N, C>;
	signer: Signer<N, C>;
	address: ChainAddress<C>;
}

// Function to fetch environment variables (like your private key)
function getEnv(key: string): string {
	const val = process.env[key];
	if (!val) throw new Error(`Missing environment variable: ${key}`);
	return val;
}

/** Load a Solana/SVM keypair JSON file as base58 string */
export function loadKeypairAsBase58(path: string): string {
	const keypairData = JSON.parse(fs.readFileSync(path, 'utf-8'));
	return bs58.encode(Uint8Array.from(keypairData));
}

// Signer setup function for different blockchain platforms
export async function getSigner<N extends Network, C extends Chain>(
	chain: ChainContext<N, C>,
	gasLimit?: bigint
): Promise<{ chain: ChainContext<N, C>; signer: Signer<N, C>; address: ChainAddress<C> }> {
	let signer: Signer;
	const platform = chain.platform.utils()._platform;

	switch (platform) {
		case 'Solana':
			signer = await (await solana()).getSigner(await chain.getRpc(), getEnv('SOL_PRIVATE_KEY'));
			break;
		case 'Evm':
			const evmSignerOptions = gasLimit ? { gasLimit } : {};
			signer = await (
				await evm()
			).getSigner(await chain.getRpc(), getEnv('ETH_PRIVATE_KEY'), evmSignerOptions);
			break;
		case 'Sui':
			signer = await (await sui()).getSigner(await chain.getRpc(), getEnv('SUI_MNEMONIC'));
			break;
		case 'Aptos':
			signer = await (await aptos()).getSigner(await chain.getRpc(), getEnv('APTOS_PRIVATE_KEY'));
			break;
		default:
			throw new Error('Unsupported platform: ' + platform);
	}

	return {
		chain,
		signer: signer as Signer<N, C>,
		address: Wormhole.chainAddress(chain.chain, signer.address()),
	};
}

export async function getTokenDecimals<N extends 'Mainnet' | 'Testnet' | 'Devnet'>(
	wh: Wormhole<N>,
	token: TokenId,
	sendChain: ChainContext<N, any>
): Promise<number> {
	return isTokenId(token)
		? Number(await wh.getDecimals(token.chain, token.address))
		: sendChain.config.nativeTokenDecimals;
}

export async function waitForWrappedAsset<N extends Network, C extends Chain>(
	tokenBridge: TokenBridge<N, C>,
	tokenId: TokenId,
	timeoutMs = 25 * 60 * 1000,
	intervalMs = 5000
) {
	const start = Date.now();
	let attempt = 0;
	while (Date.now() - start < timeoutMs) {
		attempt++;
		try {
			return await tokenBridge.getWrappedAsset(tokenId);
		} catch {
			const elapsed = Math.round((Date.now() - start) / 1000);
			console.log(`Wrapped asset not found yet (attempt ${attempt}, ${elapsed}s elapsed). Retrying...`);
			await new Promise((r) => setTimeout(r, intervalMs));
		}
	}
	throw new Error(`Wrapped asset not available after ${timeoutMs / 1000}s`);
}
