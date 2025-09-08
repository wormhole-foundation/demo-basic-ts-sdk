import {
    Wormhole,
    chains,
    signSendWait,
    wormhole,
} from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import { inspect } from 'util';
import { getSigner } from '../helpers/helpers';

(async function () {
    const wh = await wormhole('Mainnet', [evm], {
        chains: {
            XRPLEVM: {
                rpc: 'https://rpc.xrplevm.org',
            },
        },
    });
    // Define the source and destination chains
    const origChain = wh.getChain('Ethereum');

    // funds on the destination chain needed!
    const destChain = wh.getChain('XRPLEVM');

    // Retrieve the token ID from the source chain
    const tokenId = await origChain.getNativeWrappedTokenId();

    // Destination chain signer setup
    const gasLimit = BigInt(2_500_000); // Optional for EVM Chains
    const { signer: destSigner } = await getSigner(destChain, gasLimit);
    const tbDest = await destChain.getTokenBridge();

    // Check if the token is already wrapped on the destination chain
    try {
        const wrapped = await tbDest.getWrappedAsset(tokenId);
        console.log(
            `Token already wrapped on ${destChain.chain}. Skipping attestation.`
        );

        return { chain: destChain.chain, address: wrapped };
    } catch (e) {
        console.log(
            `No wrapped token found on ${destChain.chain}. Proceeding with attestation.`
        );
    }

    // Use existing transaction ID if available (replace with your actual txid)
    const existingTxid = process.env.ATTESTATION_TXID || null; // You can set this in .env file
    // Or hardcode it: const existingTxid = "0xYOUR_TXID_HERE";

    let txid: string;

    if (existingTxid) {
        console.log('Using existing attestation txid:', existingTxid);
        txid = existingTxid;
    } else {
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
        txid = txids[0]!.txid;
        console.log('Created attestation (save this): ', txid);
    }

    // Retrieve the Wormhole message ID from the attestation transaction
    const msgs = await origChain.parseTransaction(txid);
    console.log('Parsed Messages:', msgs);

    // Fetch the signed VAA
    const timeout = 25 * 60 * 1000;
    const vaa = await wh.getVaa(msgs[0]!, 'TokenBridge:AttestMeta', timeout);

    if (!vaa) {
        throw new Error(
            'VAA not found after retries exhausted. Try extending the timeout.'
        );
    }

    console.log('Token Address: ', vaa.payload.token.address);

    // Submit the attestation on the destination chain
    console.log('Attesting asset on destination chain...');

    const subAttestation = tbDest.submitAttestation(
        vaa,
        Wormhole.parseAddress(destSigner.chain(), destSigner.address())
    );

    // Send attestation transaction and log the transaction hash
    const tsx = await signSendWait(destChain, subAttestation, destSigner);
    console.log('Transaction hash: ', tsx);

    // Poll for the wrapped asset until it's available
    async function waitForIt() {
        do {
            try {
                const wrapped = await tbDest.getWrappedAsset(tokenId);
                return { chain: destChain.chain, address: wrapped };
            } catch (e) {
                console.error('Wrapped asset not found yet. Retrying...');
            }
            console.log('Waiting before checking again...');
            await new Promise((r) => setTimeout(r, 2000));
        } while (true);
    }

    console.log('Wrapped Asset: ', await waitForIt());
})().catch((e) => console.error(e));
