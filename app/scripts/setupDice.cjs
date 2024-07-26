const anchor = require('@coral-xyz/anchor');
const { clusterApiUrl, Connection, Keypair, PublicKey } = require('@solana/web3.js');
const idl = require('../../target/idl/dice.json');

// Configure the cluster
const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

// Load the wallet keypair
const wallet = anchor.Wallet.local(); // Assumes you have a local wallet keypair at ~/.config/solana/id.json

// Configure the provider
const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: 'processed',
});
anchor.setProvider(provider);

// Load the program
const programId = new PublicKey('7Ah8WAJw7CDxwbPQono7rKaRAmZ4ymjguouz1CfHScXY');
const program = new anchor.Program(idl, provider);

// Define parameters for setupDice
const house = new PublicKey('Gt74tMkBPNXoUQSYGm8SzBBaqPCVXHsSQ9JwWPZcbay1');
// const programId = new PublicKey('5GEGV7oBhx4XWBsTQYoWWRdaELNN7hmt5cZ8vQZ4W65r');
const reservePDA = new PublicKey('DUPoC5h6LAwGUuAoLzkWdnEShHPJx2bmvPqkZQU5hWbg')
// const reserveBump = 255
const reserveKeyPDA = new PublicKey('3gx2Mi1ze8VJWmUAAAEYhGeakXwGBMU2xwE6jKCNtfLM')
const updateAuthority = new PublicKey('73NW3yAewSmh8FHpk4fXiaZ7CVawnedakrnpHYckTFoB')
const reserveKeyBump = 253
const edgeBp = new anchor.BN(5000);
const initialFunding = new anchor.BN(anchor.web3.LAMPORTS_PER_SOL * 0.1)
const ratio = new anchor.BN(5);


(async () => {
    try {
        // Call the setupDice function
        const tx = await program.methods.setupDice(edgeBp, ratio, house, updateAuthority, initialFunding, reserveKeyBump).accounts({
            reserve: reservePDA,
            reserveKey: reserveKeyPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
            creator: wallet.publicKey,
        }).rpc();

        console.log('Transaction successful with signature:', tx);
    } catch (error) {
        console.error('Error calling setupDice:', error);
    }
})();
