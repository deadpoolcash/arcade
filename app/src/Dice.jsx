// src/Solana.js
import React, { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, web3, BN, utils } from '@coral-xyz/anchor';
import { Button, MenuItem, Select, InputLabel, FormControl, Typography, Container } from '@mui/material';
import { useAnchorWallet, useWallet, useConnection } from '@solana/wallet-adapter-react';
import idl from './idl.json';
import theme from './theme.jsx'


const betSizes = [0.001, 0.01, 0.1, 1];
const multipliers = [2, 3, 5, 10];
const SLOT_HASHES_SYSVAR = new PublicKey("SysvarS1otHashes111111111111111111111111111");
const network = 'https://api.devnet.solana.com';
const house = new PublicKey('Gt74tMkBPNXoUQSYGm8SzBBaqPCVXHsSQ9JwWPZcbay1');
const programId = new PublicKey('5GEGV7oBhx4XWBsTQYoWWRdaELNN7hmt5cZ8vQZ4W65r');
const reservePDA = new PublicKey('57h97DdXfDWWFJU5to4Bea9HJuQxGcRedVyE8nwdvZWe')
const reserveBump = 252
const reserveKeyPDA = new PublicKey('CAXq2t6G4F7LqdZRXiqgNdQYgbf1cyhakPczMG9qsKGf')
const reserveKeyBump = 255
const edge = 0.01


const Dice = () => {
    const [betSize, setBetSize] = useState(1);
    const [multiplier, setMultiplier] = useState(2);
    const [probability, setProbability] = useState(0);
    const [message, setMessage] = useState('');
    const [userBalance, setUserBalance] = useState('?')
    const [program, setProgram] = useState(null);
    const wallet = useAnchorWallet();
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

    const handlePlaceBet = async () => {
        if (!program) {
            setMessage('Please select a wallet')
            return
        }
        console.log("handlePlaceBet")
        setMessage('Placing bet...');
        try {
            console.log({reservePDA, reserveKeyPDA, house, wallet, SLOT_HASHES_SYSVAR})
            console.log(web3.SystemProgram.programId)
            const seed = new BN(randomInteger(1, 10000))
            const bet = new BN(betSize * web3.LAMPORTS_PER_SOL)
            const mult = new BN(multiplier * 10_000)

            // Call the roll_dice function
            const tx = await program.methods.rollDice(seed, mult, bet, reserveKeyBump).accounts({
                player: wallet.publicKey,
                reserve: reservePDA,
                reserveKey: reserveKeyPDA,
                house: house,
                systemProgram: web3.SystemProgram.programId,
                slotHashes: SLOT_HASHES_SYSVAR
            }).signers([]).rpc()

            console.log('Transaction signature:', tx);
            setMessage('Bet placed successfully!');
        } catch (error) {
            console.error('Error placing bet:', error);
            setMessage('Error placing bet.');
        }
    };

    useEffect(() => {
        console.log({wallet, connection})
        if (wallet && connection) {
            const provider = new AnchorProvider(connection, wallet);
            const program = new Program(idl, provider);
            setProgram(program);

            connection.getBalance(wallet.publicKey).then(balance => {
                console.log('Balance:', balance);
                setUserBalance(balance)
            });

        }
    }, [wallet, connection]);

    useEffect(() => {
        recomputeProbability()
    }, [betSize, multiplier])

    return (
        <Container>
            <Typography variant="h4" gutterBottom>
                Dice Game
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
                    Win Probability: {probability}
                </Typography>
            )}
            <Button variant="contained" color="primary" onClick={handlePlaceBet} fullWidth>
                Place Bet
            </Button>
            {message && (
                <Typography variant="body1" color="textSecondary" align="center" margin="normal">
                    {message}
                </Typography>
            )}
        </Container>
    )
};

export default Dice;
