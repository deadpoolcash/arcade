// src/Solana.js
import React, { useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import idl from './idl.json'; // Replace with actual path to your IDL JSON

const Dice = () => {
    useEffect(() => {
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const provider = new AnchorProvider(connection, window.solana, {
            preflightCommitment: 'processed',
        });

        console.log({provider})
        const programId = new PublicKey('5GEGV7oBhx4XWBsTQYoWWRdaELNN7hmt5cZ8vQZ4W65r');
        console.log({programId})
        const program = new Program(idl, provider);
        console.log('Program instantiated:', program);

        const publicKey = new PublicKey('11111111111111111111111111111111');
        connection.getBalance(publicKey).then(balance => {
            console.log('Balance:', balance);
        });

        // Example call to a program function
        // program.rpc.exampleFunction().then(result => {
        //     console.log('Program call result:', result);
        // });
    }, []);

    return <div>Check the console for Solana and program interactions.</div>;
};

export default Dice;
