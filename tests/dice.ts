import * as anchor from "@coral-xyz/anchor";
import {getProvider, Program} from "@coral-xyz/anchor";
import { Dice } from "../target/types/dice";
import * as assert from "assert";
import { Keypair, PublicKey } from "@solana/web3.js";

const SLOT_HASHES_SYSVAR = new PublicKey("SysvarS1otHashes111111111111111111111111111");

describe("dice", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    let program = anchor.workspace.Dice as Program<Dice>;

    function randomInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function getReserveKeyPDA() {
        const [reserveKeyPDA, reserveKeyBump] = PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("reserve-key-1")
            ],
            program.programId
        );

        console.log({reserveKeyPDA, reserveKeyBump})
        return {reserveKeyPDA, reserveKeyBump}
    }

    function getReservePDA() {
        const [reservePDA, reserveBump] = PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("reserve-1")
            ],
            program.programId
        );

        console.log({reservePDA, reserveBump})
        return {reservePDA, reserveBump}
    }

    async function getRentExemption(space) {
        const lamports = await getProvider().connection.getMinimumBalanceForRentExemption(space);
        return lamports;
    }

    async function get_max_bet(reserve_key, reserve_ratio, multiplier_bp) {
        const balance = await getBalance(reserve_key);
        const rent_exemption = await getRentExemption(0)
        return (balance - rent_exemption) * 10000 / (multiplier_bp * reserve_ratio);
    }

    function getMaxDepletion(multiplier_bp, bet_size) {
        return multiplier_bp * bet_size / 10000
    }

    async function getBalance(publicKey) {
        return await anchor.getProvider().connection.getBalance(publicKey);
    }

    function getThresholdBP(edge_bp, multiplier_bp) {
        // p =  1 / (m + e)
        // p = 1 / ((mbp / 10000) + (ebp / 10000))
        // p = 10000 / (mbp + ebp)
        // p = pbp / 10000
        const edge = edge_bp / 10_000
        const multiplier = multiplier_bp / 10_000
        const thresh_bp = 10000 / (multiplier + edge)
        const thresh = thresh_bp / 10_000

        const comp = (10000 * 10000) / (multiplier_bp + edge_bp);
        console.log({edge, edge_bp, multiplier, multiplier_bp, thresh, thresh_bp, comp})
        return thresh_bp
    }

    async function getAirdrop(addr, amount) {
        const airdropSignature = await getProvider().connection.requestAirdrop(
            addr,
            amount * anchor.web3.LAMPORTS_PER_SOL
        );
        await getProvider().connection.confirmTransaction(airdropSignature, 'confirmed');

    }

    const house = Keypair.generate()

    it("Is initialized!", async () => {
        const {reservePDA, reserveBump} = getReservePDA();
        const {reserveKeyPDA, reserveKeyBump} = getReserveKeyPDA();
        const wallet = program.provider.wallet
        const edge_bp = new anchor.BN(5000) // == 0.5
        const ratio = new anchor.BN(5)
        const initial_funding = new anchor.BN(anchor.web3.LAMPORTS_PER_SOL)
        const reserveKeyBalanceBefore = await getBalance(reserveKeyPDA)
        const walletBalanceBefore = await getBalance(wallet.publicKey)

        await getAirdrop(house.publicKey, 5)

        // console.log({reservePDA, reserveKeyPDA, reserveKeyBalanceBefore})
        const txSignature = await program.methods.setupDice(
            edge_bp,
            ratio,
            house.publicKey,
            wallet.publicKey,
            initial_funding,
            reserveKeyBump
        ).accounts({
            reserve: reservePDA,
            reserveKey: reserveKeyPDA,
            creator: wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId
        }).signers([wallet.payer]).rpc()

        await getProvider().connection.confirmTransaction(txSignature, 'confirmed');

        const txDetails = await getProvider().connection.getConfirmedTransaction(txSignature, 'confirmed');
        const transactionFee = txDetails.meta.fee;

        const reserveRent = await getRentExemption(program.account.reserve.size)
        const reserveKeyRent = await getRentExemption(0)

        const reserveAccount = await program.account.reserve.fetch(reservePDA);
        const reserveKeyBalanceAfter = await getBalance(reserveKeyPDA)
        const walletBalanceAfter = await getBalance(wallet.publicKey)
        // console.log({walletBalanceBefore, walletBalanceAfter, reserveRent, reserveKeyRent, transactionFee, reserveKeyBalanceBefore, reserveKeyBalanceAfter}, initial_funding.toNumber())

        assert.ok(reserveAccount.edgeBp.eq(edge_bp));
        assert.ok(reserveAccount.ratio.eq(ratio));
        assert.ok(reserveAccount.house.equals(house.publicKey))
        assert.ok(reserveAccount.bump == reserveBump)
        assert.ok(reserveKeyBalanceBefore + initial_funding.toNumber() + reserveKeyRent == reserveKeyBalanceAfter)
        assert.equal(walletBalanceBefore, initial_funding.toNumber() + transactionFee + reserveKeyRent + reserveRent + walletBalanceAfter)
    });

    it("Cannot double initialize", async () => {
        const {reservePDA, reserveBump} = getReservePDA();
        const {reserveKeyPDA, reserveKeyBump} = getReserveKeyPDA();
        const wallet = program.provider.wallet
        const edge_bp = new anchor.BN(5000) // == 0.5
        const ratio = new anchor.BN(5)
        const initial_funding = new anchor.BN(anchor.web3.LAMPORTS_PER_SOL)
        const reserveKeyBalanceBefore = await getBalance(reserveKeyPDA)
        const walletBalanceBefore = await getBalance(wallet.publicKey)

        await getAirdrop(house.publicKey, 5)

        try {
            // console.log({reservePDA, reserveKeyPDA, reserveKeyBalanceBefore})
            const txSignature = await program.methods.setupDice(edge_bp, ratio, house.publicKey, wallet.publicKey, initial_funding, reserveKeyBump).accounts({
                reserve: reservePDA,
                reserveKey: reserveKeyPDA,
                creator: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            }).signers([wallet.payer]).rpc()
            assert.fail("Should have failed")
        } catch (error) {
            // console.log({error})
        }
    });


    it("Lets you play!", async () => {
        const {reservePDA, reserveBump} = getReservePDA();
        const {reserveKeyPDA, reserveKeyBump} = getReserveKeyPDA();
        const wallet = program.provider.wallet
        const ratio = new anchor.BN(5)

        const seed = new anchor.BN(randomInteger(1, 10000))
        const multiplier_num = randomInteger(10_000, 100_000)
        const multiplier_bp = new anchor.BN(multiplier_num)
        const max_bet = await get_max_bet(reserveKeyPDA, ratio, multiplier_bp)
        const bet_num = randomInteger(1, max_bet)
        const bet_size = new anchor.BN(bet_num)
        const depletion = getMaxDepletion(multiplier_bp, bet_size)
        const reserveKeyBalanceBefore = await getBalance(reserveKeyPDA)
        const houseBalanceBefore = await getBalance(house.publicKey)
        const walletBalanceBefore = await getBalance(wallet.publicKey)

        // console.log({threshold, reservePDA, reserveKeyPDA, max_bet, wallet, depletion}, "bet_size", bet_size.toNumber(), "multiplier", multiplier_bp.toNumber(), house.publicKey)

        const tx = await program.methods.rollDice(seed, multiplier_bp, bet_size, reserveKeyBump).accounts({
            player: wallet.publicKey,
            reserve: reservePDA,
            reserveKey: reserveKeyPDA,
            house: house.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            slotHashes: SLOT_HASHES_SYSVAR
        }).signers([]).rpc()

        const reserveKeyBalanceAfter = await getBalance(reserveKeyPDA)
        const houseBalanceAfter = await getBalance(house.publicKey)
        const walletBalanceAfter = await getBalance(wallet.publicKey)

        // console.log({reserveKeyBalanceBefore, reserveKeyBalanceAfter, houseBalanceBefore, houseBalanceAfter, walletBalanceBefore, walletBalanceAfter})
        await getProvider().connection.confirmTransaction(tx, 'confirmed');

        // Fetch the transaction details
        const txDetails = await getProvider().connection.getTransaction(tx, {
            commitment: "confirmed",
        });

        // Inspect the logs
        const logs = txDetails.meta.logMessages;
        // console.log("Transaction logs:", logs);
        const transactionFee = txDetails.meta.fee;

        // Determine which path was taken
        const winLog = logs.find(log => log.includes("Win!"));
        const loseLog = logs.find(log => log.includes("Lose!"));

        if (winLog) {
            // console.log("Win path was taken");
            // TODO: make this exact
            assert.ok(walletBalanceBefore + (bet_num * multiplier_num / 10_000) - bet_num - transactionFee - walletBalanceAfter < 100 )
            assert.ok(reserveKeyBalanceAfter - Math.round(reserveKeyBalanceBefore - depletion + bet_num) <= 1)
            assert.ok(houseBalanceBefore == houseBalanceAfter)
        } else if (loseLog) {
            // console.log("Lose path was taken", { houseBalanceAfter}, houseBalanceBefore + Math.floor(bet_size.divn(10).toNumber()));
            // console.log("Lose path was taken", { reserveKeyBalanceAfter}, reserveKeyBalanceBefore + Math.ceil(bet_size.muln(9).divn(10).toNumber()));
            assert.ok(reserveKeyBalanceAfter - (reserveKeyBalanceBefore + Math.ceil(bet_size.muln(9).divn(10).toNumber())) < 2);
            assert.ok(houseBalanceAfter - (houseBalanceBefore + Math.floor(bet_size.divn(10).toNumber())) < 2);
        } else {
            console.log("Unexpected path");
        }
    });

    it("Prevents incorrect house", async () => {
        const {reservePDA, reserveBump} = getReservePDA();
        const {reserveKeyPDA, reserveKeyBump} = getReserveKeyPDA();
        const wallet = program.provider.wallet
        const edge_bp = new anchor.BN(5000)
        const ratio = new anchor.BN(5)
        const fakeHouseKey = wallet

        const seed = new anchor.BN(randomInteger(1, 10000))
        const multiplier_num = randomInteger(10_000, 100_000)
        const multiplier_bp = new anchor.BN(multiplier_num)
        const max_bet = await get_max_bet(reserveKeyPDA, ratio, multiplier_bp)
        const bet_num = randomInteger(1, max_bet)
        const bet_size = new anchor.BN(bet_num)
        const depletion = getMaxDepletion(multiplier_bp, bet_size)
        const reserveKeyBalanceBefore = await getBalance(reserveKeyPDA)
        const houseBalanceBefore = await getBalance(house.publicKey)
        const walletBalanceBefore = await getBalance(wallet.publicKey)

        // console.log({threshold, reservePDA, reserveKeyPDA, max_bet, wallet, depletion}, "bet_size", bet_size.toNumber(), "multiplier", multiplier_bp.toNumber(), house.publicKey)

        try {
            const tx = await program.methods.rollDice(seed, multiplier_bp, bet_size, reserveKeyBump).accounts({
                player: wallet.publicKey,
                reserve: reservePDA,
                reserveKey: reserveKeyPDA,
                house: fakeHouseKey.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                slotHashes: SLOT_HASHES_SYSVAR
            }).signers([]).rpc()
        } catch (error) {
            // console.log({error})
            assert.equal(error.error.errorMessage, "An address constraint was violated");
        }
    });

    it("Prevents incorrect reserve-key", async () => {
        const {reservePDA, reserveBump} = getReservePDA();
        const {reserveKeyPDA, reserveKeyBump} = getReserveKeyPDA();
        const wallet = program.provider.wallet
        const edge_bp = new anchor.BN(5000)
        const ratio = new anchor.BN(5)
        const fakeReserveKey = Keypair.generate();

        await getAirdrop(fakeReserveKey.publicKey, 10)

        const seed = new anchor.BN(randomInteger(1, 10000))
        const multiplier_num = randomInteger(10_000, 100_000)
        const multiplier_bp = new anchor.BN(multiplier_num)
        const max_bet = await get_max_bet(reserveKeyPDA, ratio, multiplier_bp)
        const bet_num = randomInteger(1, max_bet)
        const bet_size = new anchor.BN(bet_num)
        const depletion = getMaxDepletion(multiplier_bp, bet_size)
        const reserveKeyBalanceBefore = await getBalance(reserveKeyPDA)
        const houseBalanceBefore = await getBalance(house.publicKey)
        const walletBalanceBefore = await getBalance(wallet.publicKey)

        // console.log({threshold, reservePDA, reserveKeyPDA, max_bet, wallet, depletion}, "bet_size", bet_size.toNumber(), "multiplier", multiplier_bp.toNumber(), house.publicKey)

        try {
            const tx = await program.methods.rollDice(seed, multiplier_bp, bet_size, reserveKeyBump).accounts({
                player: wallet.publicKey,
                reserve: reservePDA,
                reserveKey: fakeReserveKey.publicKey,
                house: house.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                slotHashes: SLOT_HASHES_SYSVAR
            }).signers([]).rpc()
        } catch (error) {
            // console.log({error})
            assert.equal(error.error.errorMessage, "An address constraint was violated");
        }
    });

    it("Prevents incorrect slot-hashes", async () => {
        const {reservePDA, reserveBump} = getReservePDA();
        const {reserveKeyPDA, reserveKeyBump} = getReserveKeyPDA();
        const wallet = program.provider.wallet
        const edge_bp = new anchor.BN(5000)
        const ratio = new anchor.BN(5)
        const fakeSlotHashesKey = Keypair.generate();

        await getAirdrop(fakeSlotHashesKey.publicKey, 10)

        const seed = new anchor.BN(randomInteger(1, 10000))
        const multiplier_num = randomInteger(10_000, 100_000)
        const multiplier_bp = new anchor.BN(multiplier_num)
        const max_bet = await get_max_bet(reserveKeyPDA, ratio, multiplier_bp)
        const bet_num = randomInteger(1, max_bet)
        const bet_size = new anchor.BN(bet_num)
        const depletion = getMaxDepletion(multiplier_bp, bet_size)
        const reserveKeyBalanceBefore = await getBalance(reserveKeyPDA)
        const houseBalanceBefore = await getBalance(house.publicKey)
        const walletBalanceBefore = await getBalance(wallet.publicKey)

        // console.log({threshold, reservePDA, reserveKeyPDA, max_bet, wallet, depletion}, "bet_size", bet_size.toNumber(), "multiplier", multiplier_bp.toNumber(), house.publicKey)

        try {
            const tx = await program.methods.rollDice(seed, multiplier_bp, bet_size, reserveKeyBump).accounts({
                player: wallet.publicKey,
                reserve: reservePDA,
                reserveKey: reserveKeyPDA,
                house: house.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                slotHashes: fakeSlotHashesKey
            }).signers([]).rpc()
        } catch (error) {
            // console.log({error})
            assert.equal(error.error.errorMessage, "An address constraint was violated");
        }
    });

    it("Allows updating config by authority", async () => {
        const {reservePDA, reserveBump} = getReservePDA();
        const old_wallet = program.provider.wallet
        const fake_wallet = Keypair.generate();
        const old_edge_bp = new anchor.BN(5000) // == 0.5
        const new_edge_bp = new anchor.BN(10000)
        const old_ratio = new anchor.BN(5)
        const new_ratio = new anchor.BN(6)
        const old_house = house;
        const new_house = Keypair.generate();

        const reserveAccountBefore = await program.account.reserve.fetch(reservePDA);
        assert.equal(reserveAccountBefore.edgeBp.toNumber(), old_edge_bp.toNumber())
        assert.equal(reserveAccountBefore.ratio.toNumber(), old_ratio.toNumber())
        assert.ok(reserveAccountBefore.house.equals(old_house.publicKey))

        program.provider.wallet = new anchor.Wallet(fake_wallet);
        await getAirdrop(fake_wallet.publicKey, 5)

        try {
            const tx = await program.methods.changeConfig(new_edge_bp, new_ratio, new_house.publicKey).accounts({
                reserve: reservePDA,
            }).signers([]).rpc()
        } catch (error) {
            // console.log(error.error.errorMessage)
            assert.equal(error.error.errorMessage, "A raw constraint was violated");
        }
        const reserveAccountBetween = await program.account.reserve.fetch(reservePDA);
        assert.equal(reserveAccountBetween.edgeBp.toNumber(), old_edge_bp.toNumber())
        assert.equal(reserveAccountBetween.ratio.toNumber(), old_ratio.toNumber())
        assert.ok(reserveAccountBetween.house.equals(old_house.publicKey))
        program.provider.wallet = new anchor.Wallet(old_wallet.payer);


        const tx2 = await program.methods.changeConfig(new_edge_bp, new_ratio, new_house.publicKey).accounts({
            reserve: reservePDA
        }).signers([]).rpc()

        const reserveAccountAfter = await program.account.reserve.fetch(reservePDA);
        assert.equal(reserveAccountAfter.edgeBp.toNumber(), new_edge_bp.toNumber())
        assert.equal(reserveAccountAfter.ratio.toNumber(), new_ratio.toNumber())
        assert.ok(reserveAccountAfter.house.equals(new_house.publicKey))

        const tx3 = await program.methods.changeConfig(old_edge_bp, old_ratio, old_house.publicKey).accounts({
            reserve: reservePDA,
        }).signers([]).rpc()

        const reserveAccountLast = await program.account.reserve.fetch(reservePDA);
        assert.equal(reserveAccountLast.edgeBp.toNumber(), old_edge_bp.toNumber())
        assert.equal(reserveAccountLast.ratio.toNumber(), old_ratio.toNumber())
        assert.ok(reserveAccountLast.house.equals(old_house.publicKey))

    });

    it("Probabilities match up", async () => {
        const {reservePDA, reserveBump} = getReservePDA();
        const {reserveKeyPDA, reserveKeyBump} = getReserveKeyPDA();
        const wallet = program.provider.wallet
        const edge_bp = 5000
        const ratio = new anchor.BN(5)
        const epsilon = 0.02
        const multiplier_num = 200_000 // 20x
        const multiplier_bp = new anchor.BN(multiplier_num)

        const threshold_bp = getThresholdBP(edge_bp, multiplier_num)

        const seed = new anchor.BN(randomInteger(1, 10000))
        let win_count = 0
        let lose_count = 0
        let unknown_count = 0
        const runs = 200

        // console.log({reservePDA, reserveKeyPDA, wallet}, "bet_size", "multiplier", house.publicKey)

        for (let i = 1; i <= runs; i++) {
            const max_bet = await get_max_bet(reserveKeyPDA, ratio, multiplier_bp)
            const bet_num = randomInteger(1, max_bet)
            const bet_size = new anchor.BN(bet_num)
            const depletion = getMaxDepletion(multiplier_bp, bet_size)
            console.log({max_bet, bet_num})

            const reserveKeyBalanceBefore = await getBalance(reserveKeyPDA)
            const houseBalanceBefore = await getBalance(house.publicKey)
            const walletBalanceBefore = await getBalance(wallet.publicKey)

            const tx = await program.methods.rollDice(seed, multiplier_bp, bet_size, reserveKeyBump).accounts({
                player: wallet.publicKey,
                reserve: reservePDA,
                reserveKey: reserveKeyPDA,
                house: house.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                slotHashes: SLOT_HASHES_SYSVAR
            }).signers([]).rpc()

            const reserveKeyBalanceAfter = await getBalance(reserveKeyPDA)
            const houseBalanceAfter = await getBalance(house.publicKey)
            const walletBalanceAfter = await getBalance(wallet.publicKey)

            // console.log({reserveKeyBalanceBefore, reserveKeyBalanceAfter, houseBalanceBefore, houseBalanceAfter, walletBalanceBefore, walletBalanceAfter})
            await getProvider().connection.confirmTransaction(tx, 'confirmed');

            // Fetch the transaction details
            const txDetails = await getProvider().connection.getTransaction(tx, {
                commitment: "confirmed",
            });

            // Inspect the logs
            const logs = txDetails.meta.logMessages;
            console.log(i, " - Transaction logs:", logs);
            const transactionFee = txDetails.meta.fee;

            // Determine which path was taken
            const winLog = logs.find(log => log.includes("Win!"));
            const loseLog = logs.find(log => log.includes("Lose!"));

            if (winLog) {
                win_count++
                // TODO: make this exact
                assert.ok(walletBalanceBefore + (bet_num * multiplier_num / 10_000) - bet_num - transactionFee - walletBalanceAfter < 100 )
                assert.equal(reserveKeyBalanceAfter, reserveKeyBalanceBefore - depletion + bet_num)
                assert.ok(houseBalanceBefore == houseBalanceAfter)
            } else if (loseLog) {
                lose_count++
                assert.ok(reserveKeyBalanceAfter - (reserveKeyBalanceBefore + Math.ceil(bet_size.muln(9).divn(10).toNumber())) < 2);
                assert.ok(houseBalanceAfter - (houseBalanceBefore + Math.floor(bet_size.divn(10).toNumber())) < 2);
            } else {
                unknown_count++
                console.log("Unexpected path");
            }
        }
        const deviation = ((win_count / runs) - (threshold_bp / 10_000))

        console.log({win_count, lose_count, unknown_count, threshold_bp, epsilon, deviation})
        assert.ok(deviation <= epsilon)
        assert.ok(deviation >= -epsilon)
        assert.ok(win_count + lose_count == runs)
        assert.ok(unknown_count == 0)
    });

    it("Should make money", async () => {
        const {reservePDA, reserveBump} = getReservePDA();
        const {reserveKeyPDA, reserveKeyBump} = getReserveKeyPDA();
        const wallet = program.provider.wallet
        const ratio = new anchor.BN(5)

        const seed = new anchor.BN(randomInteger(1, 10000))
        const runs = 100
        const reserveKeyBalanceBefore = await getBalance(reserveKeyPDA)
        const houseBalanceBefore = await getBalance(house.publicKey)
        // console.log({reservePDA, reserveKeyPDA, wallet}, "bet_size", "multiplier", house.publicKey)

        for (let i = 1; i <= runs; i++) {
            const multiplier_num = randomInteger(50000, 100000) // 5-10x
            const multiplier_bp = new anchor.BN(multiplier_num)

            const max_bet = await get_max_bet(reserveKeyPDA, ratio, multiplier_bp)
            const bet_num = randomInteger(1, max_bet)
            const bet_size = new anchor.BN(bet_num)
            const depletion = getMaxDepletion(multiplier_bp, bet_size)
            console.log({max_bet, bet_num})

            const reserveKeyBalanceBefore = await getBalance(reserveKeyPDA)
            const houseBalanceBefore = await getBalance(house.publicKey)
            const walletBalanceBefore = await getBalance(wallet.publicKey)

            const tx = await program.methods.rollDice(seed, multiplier_bp, bet_size, reserveKeyBump).accounts({
                player: wallet.publicKey,
                reserve: reservePDA,
                reserveKey: reserveKeyPDA,
                house: house.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                slotHashes: SLOT_HASHES_SYSVAR
            }).signers([]).rpc()

            const reserveKeyBalanceAfter = await getBalance(reserveKeyPDA)
            const houseBalanceAfter = await getBalance(house.publicKey)
            const walletBalanceAfter = await getBalance(wallet.publicKey)

            // console.log({reserveKeyBalanceBefore, reserveKeyBalanceAfter, houseBalanceBefore, houseBalanceAfter, walletBalanceBefore, walletBalanceAfter})
            await getProvider().connection.confirmTransaction(tx, 'confirmed');

            // Fetch the transaction details
            const txDetails = await getProvider().connection.getTransaction(tx, {
                commitment: "confirmed",
            });

            // Inspect the logs
            const logs = txDetails.meta.logMessages;
            console.log(i, " - Transaction logs:", logs);
        }

        const reserveKeyBalanceAfter = await getBalance(reserveKeyPDA)
        const houseBalanceAfter = await getBalance(house.publicKey)

        console.log({reserveKeyBalanceBefore, reserveKeyBalanceAfter})
        assert.ok(reserveKeyBalanceAfter > reserveKeyBalanceBefore)
        assert.ok(houseBalanceAfter > houseBalanceBefore)
    });


})