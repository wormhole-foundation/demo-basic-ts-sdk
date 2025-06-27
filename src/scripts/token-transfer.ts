import {
	Chain,
	Network,
	Wormhole,
	amount,
	wormhole,
	TokenId,
	TokenTransfer,
} from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import sui from '@wormhole-foundation/sdk/sui';
import aptos from '@wormhole-foundation/sdk/aptos';
import { SignerStuff, getSigner, getTokenDecimals } from '../helpers/helpers';

(async function () {
	// Initialize the Wormhole object for the Testnet environment and add supported chains (evm and solana)
	const wh = await wormhole('Testnet', [evm, solana, sui, aptos], {
	chains: {
		//TODO: adjust rpcs if needed
		Solana: {
			rpc: 'https://api.devnet.solana.com',
		}
	},
	});

	// Grab chain Contexts -- these hold a reference to a cached rpc client
	const origChain = wh.getChain('Solana');
	const destChain = wh.getChain('Berachain');

	// Get signer from local key but anything that implements
	// Signer interface (e.g. wrapper around web wallet) should work
	const source = await getSigner(origChain);
	const destination = await getSigner(destChain);

	// TODO: uncomment the comment below for transferring native gas tokens
	const tokenId = Wormhole.tokenId("Solana", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // USDC on Solana
  	// Shortcut to allow transferring native gas token
	// const tokenId = Wormhole.tokenId(origChain.chain, 'native');
    console.log(`token ID for ${origChain.chain}: `, tokenId);

	// Define the amount of tokens to transfer
	const amt = '0.01';

	// Check token balance on source chain
	console.log('Checking source token balance...');
	const decimals = await getTokenDecimals(wh, tokenId, origChain);
	console.log(`Token decimals: `, decimals);	
	const sourceTokenBalance = await origChain.getBalance(source.signer.address(), tokenId.address);
	if (!sourceTokenBalance) {
		throw new Error('Failed to get source token balance');
	}
	console.log(`Source token balance: `, sourceTokenBalance);

	// Set automatic transfer to false for manual transfer
	const automatic = false;

	// The automatic relayer has the ability to deliver some native gas funds to the destination account
	// The amount specified for native gas will be swapped for the native gas token according
	// to the swap rate provided by the contract, denominated in native gas tokens
	const nativeGas = automatic ? '0.1' : undefined;

	// Check if source has sufficient token balance
	const transferAmount = amount.units(amount.parse(amt, decimals));
	if (sourceTokenBalance < transferAmount) {
		throw new Error(`Insufficient token balance. Required: ${amt}, Available: ${amount.parse(sourceTokenBalance.toString(), decimals)}`);
	}

	// Perform the token transfer if no recovery transaction ID is provided
	const xfer = await tokenTransfer(wh, {
		token: tokenId,
		amount: transferAmount,
		source,
		destination,
		delivery: {
			automatic,
			nativeGas: nativeGas ? amount.units(amount.parse(nativeGas, decimals)) : undefined,
		},
	});

	process.exit(0);
})();

async function tokenTransfer<N extends Network>(
	wh: Wormhole<N>,
	route: {
		token: TokenId;
		amount: bigint;
		source: SignerStuff<N, Chain>;
		destination: SignerStuff<N, Chain>;
		delivery?: {
			automatic: boolean;
			nativeGas?: bigint;
		};
		payload?: Uint8Array;
	}
) {
	// EXAMPLE_TOKEN_TRANSFER
	// Create a TokenTransfer object to track the state of the transfer over time
	const xfer = await wh.tokenTransfer(
		route.token,
		route.amount,
		route.source.address,
		route.destination.address,
		route.delivery?.automatic ?? false,
		route.payload,
		route.delivery?.nativeGas
	);

	const quote = await TokenTransfer.quoteTransfer(
		wh,
		route.source.chain,
		route.destination.chain,
		xfer.transfer
	);

	if (xfer.transfer.automatic && quote.destinationToken.amount < 0)
		throw 'The amount requested is too low to cover the fee and any native gas requested.';

	// 1) Submit the transactions to the source chain, passing a signer to sign any txns
	console.log('Starting transfer');
	console.log(' ');
	const srcTxids = await xfer.initiateTransfer(route.source.signer);
	console.log(`${route.source.signer.chain()} Trasaction ID: ${srcTxids[0]}`);
	console.log(`Wormhole Trasaction ID: ${srcTxids[1] ?? srcTxids[0]}`);
	console.log(' ');

	// 2) Wait for the VAA to be signed and ready (not required for auto transfer)
	console.log('Getting Attestation');
	const timeout = 30 * 60 * 1000; // Timeout in milliseconds (20 minutes)
	await xfer.fetchAttestation(timeout);
	// console.log(`Got Attestation: `, attestIds);
	console.log(' ');

	// 3) Redeem the VAA on the dest chain
	console.log('Completing Transfer');
	const destTxids = await xfer.completeTransfer(route.destination.signer);
	console.log(`Completed Transfer: `, destTxids);
	console.log('Transfer completed successfully');
}
