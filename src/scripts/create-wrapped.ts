import { Wormhole, signSendWait, wormhole } from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import { inspect } from 'util';
import { getSigner } from '../helpers/helpers';

(async function () {
	const wh = await wormhole('Testnet', [evm, solana]);

	// Get the source chain and signer
	const origChain = wh.getChain('ArbitrumSepolia');
	const token = await origChain.getNativeWrappedTokenId();
	const { signer: origSigner } = await getSigner(origChain);

	// Transaction ID (txid) - If attestation was previously created, set txid manually
	let txid = undefined;

	if (!txid) {
		// Create an attestation for the token on the source chain
		const tb = await origChain.getTokenBridge();
		const attestTxns = tb.createAttestation(
			token.address,
			Wormhole.parseAddress(origSigner.chain(), origSigner.address())
		);

		// Send attestation transaction and store the transaction ID
		const txids = await signSendWait(origChain, attestTxns, origSigner);
		console.log('txids: ', inspect(txids, { depth: null }));
		txid = txids[0]!.txid;
		console.log('Created attestation (save this): ', txid);
	}

	// Parse transaction logs to retrieve the Wormhole message ID
	const msgs = await origChain.parseTransaction(txid);
	console.log('Parsed Messages:', msgs);

	// Retrieve the Signed VAA from the API
	const timeout = 25 * 60 * 1000;
	const vaa = await wh.getVaa(msgs[0]!, 'TokenBridge:AttestMeta', timeout);
	if (!vaa) throw new Error('VAA not found after retries exhausted, try extending the timeout');

	console.log('Token Address: ', vaa.payload.token.address);

	// Destination chain setup
	const chain = 'BaseSepolia';
	const destChain = wh.getChain(chain);
	const gasLimit = BigInt(2_500_000); // Optional for EVM Chains
	const { signer } = await getSigner(destChain, gasLimit);

	const tb = await destChain.getTokenBridge();
	try {
		// Check if the token is already wrapped on the destination chain
		const wrapped = await tb.getWrappedAsset(token);
		console.log(`Token already wrapped on ${chain}`);
		return { chain, address: wrapped };
	} catch (e) {
		console.log(`No wrapped token found on ${chain}, proceeding with attestation.`);
	}

	// Submit the attestation on the destination chain
	console.log('Attesting asset...');

	const subAttestation = tb.submitAttestation(
		vaa,
		Wormhole.parseAddress(signer.chain(), signer.address())
	);

	// Send attestation transaction and log the transaction hash
	const tsx = await signSendWait(destChain, subAttestation, signer);

	console.log('Transaction hash: ', tsx);

	// Poll for the wrapped asset until it's available
	async function waitForIt() {
		do {
			try {
				const wrapped = await tb.getWrappedAsset(token);
				return { chain, address: wrapped };
			} catch (e) {
				console.error('Wrapped asset not found yet. Retrying...');
			}
			console.log('Waiting before checking again...');
			await new Promise((r) => setTimeout(r, 2000));
		} while (true);
	}

	console.log('Wrapped Asset: ', await waitForIt());
})().catch((e) => console.error(e));
