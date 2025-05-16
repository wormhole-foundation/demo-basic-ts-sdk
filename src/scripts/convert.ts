import bs58 from 'bs58';
//TODO: replace with your key
const byteArray = [89,245,12,33];

try {
    const base58Key = bs58.encode(Buffer.from(byteArray));
    console.log('Base58 encoded private key:');
    console.log(base58Key);
} catch (error) {
    console.error('Error converting private key:', error);
    process.exit(1);
}