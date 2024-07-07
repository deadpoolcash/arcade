// src/Solana.js
import React, { useEffect, useState } from 'react';
import {PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import { AnchorProvider, Program, web3, BN, utils } from '@coral-xyz/anchor';
import { Button, MenuItem, Select, InputLabel, FormControl, Typography, Container } from '@mui/material';
import {useAnchorWallet, useConnection, useWallet} from '@solana/wallet-adapter-react';
import { clusterApiUrl } from '@solana/web3.js';
import idl from './idl.json';


const multipliers = [2, 3, 5, 10];
const SLOT_HASHES_SYSVAR = new PublicKey("SysvarS1otHashes111111111111111111111111111");
const house = new PublicKey('Gt74tMkBPNXoUQSYGm8SzBBaqPCVXHsSQ9JwWPZcbay1');
const programId = new PublicKey('5GEGV7oBhx4XWBsTQYoWWRdaELNN7hmt5cZ8vQZ4W65r');
const reservePDA = new PublicKey('57h97DdXfDWWFJU5to4Bea9HJuQxGcRedVyE8nwdvZWe')
const reserveBump = 252
const reserveKeyPDA = new PublicKey('CAXq2t6G4F7LqdZRXiqgNdQYgbf1cyhakPczMG9qsKGf')
const reserveKeyBump = 255
const edge = 0.01
const ratio = 5


const Dice = () => {
    const [betSizes, setBetSizes] = useState([0.0001])
    const [betSize, setBetSize] = useState(0.0001);
    const [multiplier, setMultiplier] = useState(2);
    const [probability, setProbability] = useState(0);
    const [message, setMessage] = useState('');
    const [userBalance, setUserBalance] = useState(null)
    const [reserveKeyBalance, setReserveKeyBalance] = useState(null)
    const [program, setProgram] = useState(null);
    const [isTestnet, setIsTestnet] = useState(false);

    const wallet = useAnchorWallet();
    const { connected } = useWallet();
    const { connection } = useConnection();

    const handleBetSizeChange = (event) => {
        setBetSize(event.target.value);
    };

    const handleMultiplierChange = (event) => {
        setMultiplier(event.target.value);
    };

    function recomputeProbability() {
        // p =  (1 - e) / (m + 1)
        const prob = (1 - edge) / (multiplier + 1)
        setProbability(prob)
        return prob
    }

    function randomInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function getMaxBetSize(reserveKeyBalance) {
        return reserveKeyBalance / ratio / 2;
    }

    const handlePlaceBet = async () => {
        if (!program) {
            setMessage('Please select a wallet')
            return
        }
        setMessage('Placing bet...');
        try {
            console.log({reservePDA, reserveKeyPDA, house, wallet, SLOT_HASHES_SYSVAR})
            console.log(web3.SystemProgram.programId)
            const seed = new BN(randomInteger(1, 10000))
            const bet = new BN(betSize * web3.LAMPORTS_PER_SOL)
            const mult = new BN(multiplier * 10_000)
            const accounts = {
                player: wallet.publicKey,
                reserve: reservePDA,
                reserveKey: reserveKeyPDA,
                house: house,
                systemProgram: web3.SystemProgram.programId,
                slotHashes: SLOT_HASHES_SYSVAR
            }

            // Call the roll_dice function
            const setup = await program.methods.rollDice(seed, mult, bet, reserveKeyBump).accounts(accounts)

            // simulate tx
            const ix = await setup.instruction();
            const recentBlockhash = (await connection.getLatestBlockhash()).blockhash
            console.log({recentBlockhash, seed, bet, mult})
            // Create the message
            const message = new TransactionMessage({
                payerKey: wallet.publicKey,
                recentBlockhash: recentBlockhash,
                instructions: [ix],
            }).compileToV0Message();

            const tx = new VersionedTransaction(message);

            const config = {
                // sigVerify: false,
                accounts: {
                    addresses: [
                        wallet.publicKey.toBase58(),
                        reservePDA.toBase58(),
                        reserveKeyPDA.toBase58(),
                        house.toBase58(),
                        web3.SystemProgram.programId.toBase58(),
                        SLOT_HASHES_SYSVAR.toBase58()
                    ],
                    encoding: "base64"
                },
                commitment: 'confirmed',
                replaceRecentBlockhash: true
            }
            console.log({tx, config})
            const { value } = await connection.simulateTransaction(tx, config);
            console.log({value})

            if (value.err) {
                if (typeof value.err === 'object') {
                    for (const [key, val] of Object.entries(value.err)) {
                        if (value.err.hasOwnProperty(key)) {
                            console.error(`${key}: ${val}`);
                            setMessage('Error: ' + key)
                        }
                    }
                    console.error(value.logs)
                }
            } else {
                const tx = await setup.signers([]).rpc();
                setMessage('Bet placed successfully!');
                console.log('Transaction signature:', tx);
            }

            // const tx = await setup.signers([]).rpc();

        } catch (error) {
            console.error('Error placing bet:', error);
            setMessage('Error placing bet.');
        }
    };

    useEffect(() => {
        console.log({wallet, connection, connected})
        if (wallet && connection) {
            const provider = new AnchorProvider(connection, wallet);
            const program = new Program(idl, provider);
            setProgram(program);

            connection.getBalance(wallet.publicKey).then(balance => {
                console.log('User balance:', balance);
                setUserBalance(balance)
            });

            connection.getBalance(reserveKeyPDA).then(balance => {
                console.log('Reserve key balance:', balance);
                setReserveKeyBalance(balance)
            })
        }
    }, [wallet, connection]);

    useEffect(() => {
        recomputeProbability()
    }, [betSize, multiplier])

    useEffect(() => {
        const numIntervals = 6;
        const maxBet = getMaxBetSize(reserveKeyBalance)
        // Calculate the logarithmic step size
        const logMaxBet = Math.log(maxBet);
        const logMinBet = Math.log(100000);
        const stepSize = (logMaxBet - logMinBet) / (numIntervals - 1);

        console.log({logMaxBet, logMinBet, stepSize})
        // Generate the bet sizes
        const sizes = [];
        for (let i = 0; i < numIntervals; i++) {
            const logBetSize = logMinBet + i * stepSize;
            const betSize = Math.round(Math.exp(logBetSize));
            sizes.push(betSize / web3.LAMPORTS_PER_SOL);
        }

        setBetSizes(sizes)
        // TODO: make this more reload after every bet
    }, [reserveKeyBalance])

    useEffect(() => {
        const checkNetwork = async () => {
            // try {
            //     const genesisHash = await connection.getGenesisHash();
            //     switch (genesisHash) {
            //         case '5eykt4UsFv8P8NJdTREpStqxDsh5mJbyomd9T7wv2y1D':
            //             setNetwork('Mainnet');
            //             break;
            //         case '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY':
            //             setNetwork('Testnet');
            //             break;
            //         case 'EtWTRABZaYq6iMFeYKouRu166VU2B5mtDZvA9jyY6yAy':
            //             setNetwork('Devnet');
            //             break;
            //         default:
            //             setNetwork('Unknown');
            //             break;
            //     }
            // } catch (error) {
            //     console.error('Failed to check network:', error);
            // }


            try {
                // const version = await connection.getVersion();
                const endpoint = clusterApiUrl('testnet');
                if (connection.rpcEndpoint === endpoint) {
                    setIsTestnet(true);
                } else {
                    setIsTestnet(false);
                }
                console.log(connection.rpcEndpoint)
            } catch (error) {
                console.error('Failed to check network:', error);
            }
        };

        checkNetwork();
    }, [connection]);


    return (
        <Container>
            <Typography variant="h4" gutterBottom>
                Dice Game (Testnet)
            </Typography>
            <FormControl fullWidth margin="normal">
                <InputLabel>Bet Size (SOL)</InputLabel>
                <Select value={betSize} onChange={handleBetSizeChange}>
                    {betSizes.map((size) => (
                        <MenuItem key={size} value={size}>
                            {size}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
                <InputLabel>Multiplier</InputLabel>
                <Select value={multiplier} onChange={handleMultiplierChange}>
                    {multipliers.map((mult) => (
                        <MenuItem key={mult} value={mult}>
                            {mult}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            {probability && (
                <Typography variant="body1" color="textSecondary" align="center" margin="normal">
                    Win Probability: {probability * 100}%
                </Typography>
            )}
            {userBalance && (
                <Typography variant="body1" color="textSecondary" align="center" margin="normal">
                    User Balance: {userBalance / web3.LAMPORTS_PER_SOL}
                </Typography>
            )}
            { isTestnet && connected ? (
                <Button variant="contained" color="primary" onClick={handlePlaceBet} fullWidth>
                    Place Bet
                </Button> )
                : (
                <Typography variant="body1" color="textSecondary" align="center" margin="normal">
                    Please connect your wallet to testnet
                </Typography>
            )}
            {message && (
                <Typography variant="body1" color="textSecondary" align="center" margin="normal">
                    {message}
                </Typography>
            )}
        </Container>
    )
};

export default Dice;
