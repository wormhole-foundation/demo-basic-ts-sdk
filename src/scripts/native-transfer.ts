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
	const wh = await wormhole('Testnet', [evm, solana, sui, aptos]);

	// Grab chain Contexts -- these hold a reference to a cached rpc client
	const sendChain = wh.getChain('Aptos');
	const rcvChain = wh.getChain('Solana');

	// Get signer from local key but anything that implements
	// Signer interface (e.g. wrapper around web wallet) should work
	const source = await getSigner(sendChain);
	const destination = await getSigner(rcvChain);

	// Shortcut to allow transferring native gas token
	const token = Wormhole.tokenId(sendChain.chain, 'native');

	// Define the amount of tokens to transfer
	const amt = '1';

	// Set automatic transfer to false for manual transfer
	const automatic = false;

	// The automatic relayer has the ability to deliver some native gas funds to the destination account
	// The amount specified for native gas will be swapped for the native gas token according
	// to the swap rate provided by the contract, denominated in native gas tokens
	const nativeGas = automatic ? '0.1' : undefined;

	// Used to normalize the amount to account for the tokens decimals
	const decimals = await getTokenDecimals(wh, token, sendChain);

	// Perform the token transfer if no recovery transaction ID is provided
	const xfer = await tokenTransfer(wh, {
		token,
		amount: amount.units(amount.parse(amt, decimals)),
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
	await xfer.fetchAttestation(60_000);
	// console.log(`Got Attestation: `, attestIds);
	console.log(' ');

	// 3) Redeem the VAA on the dest chain
	console.log('Completing Transfer');
	// console.log('Destination Signer:', route.destination.signer);
	console.log(' ');
	const destTxids = await xfer.completeTransfer(route.destination.signer);
	console.log(`Completed Transfer: `, destTxids);
	console.log(' ');
	console.log('Transfer completed successfully');
}
