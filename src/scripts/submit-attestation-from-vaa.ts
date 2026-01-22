import { Wormhole, signSendWait, wormhole, deserialize } from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import sui from '@wormhole-foundation/sdk/sui';
import { getSigner } from '../helpers/helpers';

const DEST_CHAIN = 'Solana' as const;
const NETWORK = 'Mainnet' as const;

// From: https://api.wormholescan.io/api/v1/operations?txHash=YOUR_TX_HASH
// Use emitterChain, emitterAddress.hex, and sequence from the response
const VAA_SOURCE = {
	chain: 15,
	emitter: '148410499d3fcda4dcfd68a1ebfcdddda16ab28326448d4aae4d2f0465cdfcb7',
	sequence: 6237n,
};

// From the same response: content.standarizedProperties.tokenChain and tokenAddress
const ORIGINAL_TOKEN = {
	chain: 'Near' as const,
	address: '0x8e4cb3f8feea536220153560228b7dc074fee23363164a108821d6f274dac910',
};

async function fetchVaa(chain: number, emitter: string, sequence: bigint): Promise<string> {
	const url = `https://api.wormholescan.io/api/v1/vaas/${chain}/${emitter}/${sequence}`;
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to fetch VAA: ${response.status}`);
	const data = await response.json();
	return data.data.vaa;
}

(async function () {
	const wh = await wormhole(NETWORK, [evm, solana, sui]);
	const destChain = wh.getChain(DEST_CHAIN);
	const { signer: destSigner } = await getSigner(destChain, BigInt(2_500_000));
	const tbDest = await destChain.getTokenBridge();
	const tokenId = Wormhole.tokenId(ORIGINAL_TOKEN.chain, ORIGINAL_TOKEN.address);

	try {
		const wrapped = await tbDest.getWrappedAsset(tokenId);
		console.log(`Already wrapped on ${destChain.chain}: ${wrapped.toString()}`);
		return;
	} catch {
		console.log(`Not wrapped on ${destChain.chain}, submitting attestation...`);
	}

	const vaaBase64 = await fetchVaa(VAA_SOURCE.chain, VAA_SOURCE.emitter, VAA_SOURCE.sequence);
	const vaa = deserialize('TokenBridge:AttestMeta', Buffer.from(vaaBase64, 'base64'));

	console.log(`Token: ${vaa.payload.symbol} (${vaa.payload.name}), decimals: ${vaa.payload.decimals}`);

	const subAttestation = tbDest.submitAttestation(
		vaa,
		Wormhole.parseAddress(destChain.chain, destSigner.address())
	);
	const txs = await signSendWait(destChain, subAttestation, destSigner);
	console.log('Submitted:', txs.map((t) => t.txid).join(', '));

	for (let i = 0; i < 30; i++) {
		try {
			const wrapped = await tbDest.getWrappedAsset(tokenId);
			console.log(`Wrapped token on ${destChain.chain}: ${wrapped.toString()}`);
			return;
		} catch {
			await new Promise((r) => setTimeout(r, 2000));
		}
	}
	console.log('Timeout waiting for wrapped asset');
})().catch(console.error);
