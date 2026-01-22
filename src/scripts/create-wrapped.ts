import { Wormhole, signSendWait, wormhole } from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import sui from '@wormhole-foundation/sdk/sui';
import { inspect } from 'util';
import { getSigner, loadKeypairAsBase58, waitForWrappedAsset } from '../helpers/helpers';

// Set keypair path here, or leave undefined to use SOL_PRIVATE_KEY env
const KEYPAIR_PATH: string | undefined = undefined;

(async function () {
	const wh = await wormhole('Testnet', [evm, solana, sui]);
	// Define the source and destination chains
	const origChain = wh.getChain('Solana');

	// funds on the destination chain needed!
	const destChain = wh.getChain('Berachain');

	// Retrieve the token ID from the source chain
    const tokenId = Wormhole.tokenId(origChain.chain, "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
	console.log(`token ID for ${origChain.chain}: `, tokenId);

	// Retrieve the token ID(for native)from the source chain
	// const tokenId = await origChain.getNativeWrappedTokenId();

	// Destination chain signer setup
	const gasLimit = BigInt(2_500_000); // Optional for EVM Chains
	const destSigner = KEYPAIR_PATH
		? await (await solana()).getSigner(await destChain.getRpc(), loadKeypairAsBase58(KEYPAIR_PATH))
		: (await getSigner(destChain, gasLimit)).signer;
	const tbDest = await destChain.getTokenBridge();


	// Check if the token is already wrapped on the destination chain
	try {
		const wrapped = await tbDest.getWrappedAsset(tokenId);
		console.log(`Token already wrapped on ${destChain.chain}. Skipping attestation.`);
		console.log('Wrapped token address:', wrapped.toString());

		return { chain: destChain.chain, address: wrapped };
	} catch (e) {
		console.log(`No wrapped token found on ${destChain.chain}. Proceeding with attestation.`);
	}

	// Source chain signer setup
	const { signer: origSigner } = await getSigner(origChain);

	// Create an attestation transaction on the source chain
	const tbOrig = await origChain.getTokenBridge();
	const attestTxns = tbOrig.createAttestation(
		tokenId.address,
		Wormhole.parseAddress(origSigner.chain(), origSigner.address())
	);

	// Submit the attestation transaction
	const txids = await signSendWait(origChain, attestTxns, origSigner);
	console.log('txids: ', inspect(txids, { depth: null }));
	const txid = txids[0]!.txid;
	console.log('Created attestation (save this): ', txid);

	// Retrieve the Wormhole message ID from the attestation transaction
	const msgs = await origChain.parseTransaction(txid);
	console.log('Parsed Messages:', msgs);

	// Fetch the signed VAA
	const timeout = 25 * 60 * 1000;
	const vaa = await wh.getVaa(msgs[0]!, 'TokenBridge:AttestMeta', timeout);

	if (!vaa) {
		throw new Error('VAA not found after retries exhausted. Try extending the timeout.');
	}

	console.log('Token Address: ', vaa.payload.token.address);

	// Submit the attestation on the destination chain
	console.log('Attesting asset on destination chain...');

	const subAttestation = tbDest.submitAttestation(
		vaa,
		Wormhole.parseAddress(destChain.chain, destSigner.address())
	);

	// Send attestation transaction and log the transaction hash
	const tsx = await signSendWait(destChain, subAttestation, destSigner);
	console.log('Transaction hash: ', tsx);

	const wrapped = await waitForWrappedAsset(tbDest, tokenId);
	console.log('Wrapped Asset:', { chain: destChain.chain, address: wrapped.toString() });
})().catch((e) => console.error(e));
