import { wormhole, TokenTransfer } from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import sui from '@wormhole-foundation/sdk/sui';
import { getSigner } from '../helpers/helpers';

(async function () {
	// Initialize the Wormhole object for the Testnet environment and add supported chains (evm and solana)
	const wh = await wormhole('Testnet', [evm, solana, sui]);

	// Grab chain Contexts -- these hold a reference to a cached rpc client
	const sendChain = wh.getChain('Avalanche');

	// Get signer from local key but anything that implements
	// Signer interface (e.g. wrapper around web wallet) should work
	const source = await getSigner(sendChain);

	// Set this to the transfer txid of the initiating transaction to recover a token transfer
	// and attempt to fetch details about its progress.
	let recoverTxid = '';

	// Recover the transfer from the originating transaction ID
	await TokenTransfer.from(wh, {
		chain: source.chain.chain,
		txid: recoverTxid,
	});

	process.exit(0);
})();
