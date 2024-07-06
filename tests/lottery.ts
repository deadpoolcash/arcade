import * as anchor from "@coral-xyz/anchor";
import {getProvider, Program} from "@coral-xyz/anchor";
import { Lottery } from "../target/types/lottery";
import * as assert from "assert";
import { Keypair, PublicKey } from "@solana/web3.js";

const incinerator = new anchor.web3.PublicKey("1nc1nerator11111111111111111111111111111111")
const token_address = new anchor.web3.PublicKey("9qywujQCJyECybwpNsM4YTBRnakjDS23MdJHGRYVeLm6")
const team_address = new anchor.web3.PublicKey("2X9Pq1me5aWXvci6QjAy5nPDTNZLTWawUKq1nYtFf2gG")

const SLOT_HASHES_SYSVAR = new PublicKey("SysvarS1otHashes111111111111111111111111111");


describe("lottery", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Lottery as Program<Lottery>;

  function getLotteryPDA(lotteryNum) {
    const lotterySeed = Buffer.alloc(7)
    lotterySeed.writeUInt32LE(lotteryNum, 0)
    // console.log({lotterySeed})
    const [lotteryPDA, _] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("lottery"),
          lotterySeed,
        ],
        program.programId
    );
    return lotteryPDA
  }

  function getRoundPDA(lotteryNum, roundNum) {
    const lotterySeed = Buffer.alloc(4)
    lotterySeed.writeUInt32LE(lotteryNum, 0)
    const roundSeed = Buffer.alloc(4)
    roundSeed.writeUInt32LE(roundNum, 0)
    // console.log({lotterySeed, roundSeed})
    const [roundPDA, _] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("round"),
          lotterySeed,
          roundSeed,
        ],
        program.programId
    );
    return roundPDA
  }

  function getTicketPDA(owner, lottery_num, round_num, ticket_num) {
    const lotterySeed = Buffer.alloc(4)
    lotterySeed.writeUInt32LE(lottery_num, 0)
    const roundSeed = Buffer.alloc(4)
    roundSeed.writeUInt32LE(round_num, 0)
    const ticketSeed = Buffer.alloc(4)
    ticketSeed.writeUInt32LE(ticket_num, 0)


    const [ticketPDA, ticketBump] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("buy-ticket"),
          owner.publicKey.toBuffer(),
          roundSeed,
          ticketSeed,
          lotterySeed
        ],
        program.programId
    );

    // console.log(anchor.utils.bytes.utf8.encode("buy-ticket"), owner.publicKey, owner.publicKey.toBuffer(), roundSeed, ticketSeed, ticketBump)
    return ticketPDA
  }

  // Utility function to get SOL balance
  async function getBalance(publicKey) {
    return await anchor.getProvider().connection.getBalance(publicKey);
  }

  // Utility function to calculate rent exemption
  async function getRentExemption(space) {
    const lamports = await getProvider().connection.getMinimumBalanceForRentExemption(space);
    return lamports;
  }

  function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Utility function to introduce a delay
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  it("Is initialized!", async () => {
    const state = Keypair.generate();
    const wallet = program.provider.wallet
    const lottery_num = 1
    const initial_duration = new anchor.BN(1000)
    const duration_extension = new anchor.BN(10)
    const min_deposit = new anchor.BN(1)
    const burn_pct = 10
    const last_depositor_pct = 15
    const team_pct = 15
    const winner_pct = 50

    const configPDA = getLotteryPDA(lottery_num)
    const firstRoundPDA = getRoundPDA(lottery_num, 1)

    // console.log(configPDA, firstRoundPDA, wallet.publicKey, state.publicKey)

    await program.methods.setupLottery(
        lottery_num,
        initial_duration,
        duration_extension,   // duration_extension
        min_deposit,          // min_deposit
        burn_pct,             // burn_pct
        last_depositor_pct,   // last_depositor_pct
        team_pct,             // team_pct
        winner_pct,           // winner_pct
        incinerator,    // burn_address
        token_address,  // burn_token
        team_address,   // team_address
    ).accounts({
      config: configPDA,
      state: state.publicKey,
      firstRound: firstRoundPDA,
      creator: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    }).signers([state, wallet.payer]).rpc();

    const configAccount = await program.account.lotteryConfig.fetch(configPDA);
    const stateAccount = await program.account.lotteryState.fetch(state.publicKey);
    const roundAccount = await program.account.lotteryRound.fetch(firstRoundPDA);

    assert.ok(configAccount.lotteryNum == lottery_num)
    assert.ok(configAccount.initialDuration.eq(initial_duration))
    assert.ok(configAccount.durationExtension.eq(duration_extension))
    assert.ok(configAccount.minDeposit.eq(min_deposit))
    assert.ok(burn_pct == configAccount.burnPct)
    assert.ok(last_depositor_pct == configAccount.lastDepositorPct)
    assert.ok(team_pct == configAccount.teamPct)
    assert.ok(winner_pct == configAccount.winnerPct)
    assert.equal(configAccount.burnAddress.toBase58(), incinerator)
    assert.equal(configAccount.burnToken.toBase58(), token_address)
    assert.equal(configAccount.teamAddress.toBase58(), team_address)

    assert.ok(stateAccount.numRounds == 1)
    assert.ok(stateAccount.ticketsBought.eqn(0))
    assert.ok(roundAccount.endTime.sub(roundAccount.startTime).eq(initial_duration))
    assert.ok(roundAccount.roundNum == 1)
    assert.ok(roundAccount.winningNumber.eqn(0))
    assert.ok(roundAccount.potSize.eqn(0))
    assert.ok(roundAccount.ticketsBought.eqn(0))
  });

  it("Prevents bad percentages", async () => {
    const state = Keypair.generate();
    const wallet = program.provider.wallet
    let lottery_num = 2
    const initial_duration = new anchor.BN(1000)
    const duration_extension = new anchor.BN(10)
    const min_deposit = new anchor.BN(1)
    let burn_pct = 100
    const last_depositor_pct = 15
    const team_pct = 15
    const winner_pct = 50

    const configPDA = getLotteryPDA(lottery_num)
    const firstRoundPDA = getRoundPDA(lottery_num, 1)

    try {
      await program.methods.setupLottery(
          lottery_num,
          initial_duration,
          duration_extension,   // duration_extension
          min_deposit,          // min_deposit
          burn_pct,             // burn_pct
          last_depositor_pct,   // last_depositor_pct
          team_pct,             // team_pct
          winner_pct,           // winner_pct
          incinerator,    // burn_address
          token_address,  // burn_token
          team_address,   // team_address
      ).accounts({
        config: configPDA,
        state: state.publicKey,
        firstRound: firstRoundPDA,
        creator: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      }).signers([state]).rpc();
    } catch (error) {
      // console.log({error})
      assert.equal(error.error.errorMessage, "Percentages should add to 90%");
    }

    burn_pct = 11

    try {
      await program.methods.setupLottery(
          lottery_num,
          initial_duration,
          duration_extension,   // duration_extension
          min_deposit,          // min_deposit
          burn_pct,             // burn_pct
          last_depositor_pct,   // last_depositor_pct
          team_pct,             // team_pct
          winner_pct,           // winner_pct
          incinerator,    // burn_address
          token_address,  // burn_token
          team_address,   // team_address
      ).accounts({
        config: configPDA,
        state: state.publicKey,
        firstRound: firstRoundPDA,
        creator: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      }).signers([state]).rpc();
    } catch (error) {
      assert.equal(error.error.errorMessage, "Percentages should add to 90%");
    }
  });

  it("Cannot double initialize", async () => {
    const state = Keypair.generate();
    const wallet = program.provider.wallet
    const lottery_num = 2
    const initial_duration = new anchor.BN(1000)
    const duration_extension = new anchor.BN(10)
    const min_deposit = new anchor.BN(1)
    const burn_pct = 10
    const last_depositor_pct = 15
    const team_pct = 15
    const winner_pct = 50

    const configPDA = getLotteryPDA(lottery_num)
    const firstRoundPDA = getRoundPDA(lottery_num, 1)

    await program.methods.setupLottery(
        lottery_num,
        initial_duration,
        duration_extension,   // duration_extension
        min_deposit,          // min_deposit
        burn_pct,             // burn_pct
        last_depositor_pct,   // last_depositor_pct
        team_pct,             // team_pct
        winner_pct,           // winner_pct
        incinerator,    // burn_address
        token_address,  // burn_token
        team_address,   // team_address
    ).accounts({
      config: configPDA,
      state: state.publicKey,
      firstRound: firstRoundPDA,
      creator: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    }).signers([state]).rpc();

    try {
      await program.methods.setupLottery(
          lottery_num,
          initial_duration,
          duration_extension,   // duration_extension
          min_deposit,          // min_deposit
          burn_pct,             // burn_pct
          last_depositor_pct,   // last_depositor_pct
          team_pct,             // team_pct
          winner_pct,           // winner_pct
          incinerator,    // burn_address
          token_address,  // burn_token
          team_address,   // team_address
      ).accounts({
        config: configPDA,
        state: state.publicKey,
        firstRound: firstRoundPDA,
        creator: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      }).signers([state]).rpc();
    } catch (error) {
      return
    }
    assert.fail("Double initialized")
  });

  it("Allows deposits", async () => {
    const state = Keypair.generate();
    const wallet = program.provider.wallet
    const lottery_num = 3
    const initial_duration = new anchor.BN(1000)
    const duration_extension = new anchor.BN(10)
    const min_deposit = new anchor.BN(1)
    const burn_pct = 10
    const last_depositor_pct = 15
    const team_pct = 15
    const winner_pct = 50

    const configPDA = getLotteryPDA(lottery_num)
    const firstRoundPDA = getRoundPDA(lottery_num, 1)

    await program.methods.setupLottery(
        lottery_num,
        initial_duration,
        duration_extension,   // duration_extension
        min_deposit,          // min_deposit
        burn_pct,             // burn_pct
        last_depositor_pct,   // last_depositor_pct
        team_pct,             // team_pct
        winner_pct,           // winner_pct
        incinerator,    // burn_address
        token_address,  // burn_token
        team_address,   // team_address
    ).accounts({
      config: configPDA,
      state: state.publicKey,
      firstRound: firstRoundPDA,
      creator: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    }).signers([state]).rpc();

    const purchase_amount = new anchor.BN(5)
    const round_account_before = await program.account.lotteryRound.fetch(firstRoundPDA);

    const wallet_balance_before = await getBalance(wallet.publicKey)
    const round_balance_before = await getBalance(firstRoundPDA)
    const end_time_before = round_account_before.endTime
    const ticket_num = 0
    const lotteryTicketPDA = getTicketPDA(wallet, lottery_num,1, ticket_num)
    // console.log(state.publicKey, firstRoundPDA, configPDA, wallet.publicKey, lotteryTicketPDA)

    const txSignature = await program.methods.buyTicket(purchase_amount, ticket_num).accounts({
      lotteryTicket: lotteryTicketPDA,
      state: state.publicKey,
      config: configPDA,
      round: firstRoundPDA,
      owner: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    }).signers([]).rpc();

    await getProvider().connection.confirmTransaction(txSignature, 'confirmed');

    // Fetch the transaction details
    const txDetails = await getProvider().connection.getConfirmedTransaction(txSignature, 'confirmed');
    const transactionFee = txDetails.meta.fee;

    const rent = await getRentExemption(program.account.lotteryTicket.size);

    const wallet_balance_after = await getBalance(wallet.publicKey)
    const round_balance_after = await getBalance(firstRoundPDA)
    const round_account_after = await program.account.lotteryRound.fetch(firstRoundPDA);
    const end_time_after = round_account_after.endTime

    // console.log({transactionFee, wallet_balance_after, wallet_balance_before, round_balance_after, round_balance_before, rent})
    assert.equal(round_balance_before, round_balance_after - purchase_amount.toNumber())
    // TODO: make this exact
    assert.ok(wallet_balance_after - (wallet_balance_before - purchase_amount.toNumber() - transactionFee - rent) < 100);

    const stateAccount = await program.account.lotteryState.fetch(state.publicKey);
    const configAccount = await program.account.lotteryConfig.fetch(configPDA);

    assert.ok(stateAccount.ticketsBought.eqn(1))
    assert.ok(round_account_after.ticketsBought.eqn(1))
    // console.log({end_time_before, end_time_after}, configAccount.durationExtension.toNumber())
    assert.ok(end_time_before.eq(end_time_after.sub(configAccount.durationExtension)));
    assert.ok(round_account_before.potSize.eq(round_account_after.potSize.sub(purchase_amount)))
    // console.log(round_account_after.lastDepositor.toBase58())
    assert.equal(round_account_after.lastDepositor.toBase58(), wallet.publicKey)

    const ticketAccount = await program.account.lotteryTicket.fetch(lotteryTicketPDA)
    assert.equal(ticketAccount.owner.toBase58(), wallet.publicKey)
    assert.equal(ticketAccount.roundNum, 1)
    assert.ok(ticketAccount.windowStart.eqn(0))
    assert.ok(ticketAccount.windowEnd.eq(purchase_amount))
  });

  it("Allows multiple deposits", async () => {
    const state = Keypair.generate();
    const wallet = program.provider.wallet
    const lottery_num = 4
    const initial_duration = new anchor.BN(3)
    const duration_extension = new anchor.BN(1)
    const min_deposit = new anchor.BN(1)
    const burn_pct = 10
    const last_depositor_pct = 15
    const team_pct = 15
    const winner_pct = 50

    const configPDA = getLotteryPDA(lottery_num)
    const firstRoundPDA = getRoundPDA(lottery_num, 1)

    await program.methods.setupLottery(
        lottery_num,
        initial_duration,
        duration_extension,   // duration_extension
        min_deposit,          // min_deposit
        burn_pct,             // burn_pct
        last_depositor_pct,   // last_depositor_pct
        team_pct,             // team_pct
        winner_pct,           // winner_pct
        incinerator,    // burn_address
        token_address,  // burn_token
        team_address,   // team_address
    ).accounts({
      config: configPDA,
      state: state.publicKey,
      firstRound: firstRoundPDA,
      creator: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    }).signers([state]).rpc();

    const max_tickets = 5
    for (let i = 1; i <= max_tickets; i++) {
      // console.log({i})
      const ticket_num = i
      const purchase_amount = new anchor.BN(randomInteger(100, 10000))

      const round_account_before = await program.account.lotteryRound.fetch(firstRoundPDA);

      const wallet_balance_before = await getBalance(wallet.publicKey)
      const round_balance_before = await getBalance(firstRoundPDA)
      const end_time_before = round_account_before.endTime


      const lotteryTicketPDA = getTicketPDA(wallet, lottery_num, 1, ticket_num)
      // console.log(state.publicKey, firstRoundPDA, configPDA, wallet.publicKey, lotteryTicketPDA)

      const txSignature = await program.methods.buyTicket(purchase_amount, ticket_num).accounts({
        lotteryTicket: lotteryTicketPDA,
        state: state.publicKey,
        config: configPDA,
        round: firstRoundPDA,
        owner: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      }).signers([]).rpc();

      await getProvider().connection.confirmTransaction(txSignature, 'confirmed');

      // Fetch the transaction details
      const txDetails = await getProvider().connection.getConfirmedTransaction(txSignature, 'confirmed');
      const transactionFee = txDetails.meta.fee;

      const rent = await getRentExemption(program.account.lotteryTicket.size);

      const wallet_balance_after = await getBalance(wallet.publicKey)
      const round_balance_after = await getBalance(firstRoundPDA)
      const round_account_after = await program.account.lotteryRound.fetch(firstRoundPDA);
      const end_time_after = round_account_after.endTime

      // console.log({transactionFee, wallet_balance_after, wallet_balance_before, round_balance_after, round_balance_before, rent})
      assert.equal(round_balance_before, round_balance_after - purchase_amount.toNumber())
      // TODO: make this exact
      assert.ok(wallet_balance_after - (wallet_balance_before - purchase_amount.toNumber() - transactionFee - rent) < 100);

      const stateAccount = await program.account.lotteryState.fetch(state.publicKey);
      const configAccount = await program.account.lotteryConfig.fetch(configPDA);

      assert.ok(stateAccount.ticketsBought.eqn(i))
      assert.ok(round_account_after.ticketsBought.eqn(i))
      // console.log({end_time_before, end_time_after}, configAccount.durationExtension.toNumber())
      assert.ok(end_time_before.eq(end_time_after.sub(configAccount.durationExtension)));
      assert.ok(round_account_before.potSize.eq(round_account_after.potSize.sub(purchase_amount)))
      // console.log(round_account_after.lastDepositor.toBase58())
      assert.equal(round_account_after.lastDepositor.toBase58(), wallet.publicKey)

      const ticketAccount = await program.account.lotteryTicket.fetch(lotteryTicketPDA)
      assert.equal(ticketAccount.owner.toBase58(), wallet.publicKey)
      assert.equal(ticketAccount.roundNum, 1)
      assert.ok(ticketAccount.windowStart.eq(round_account_before.potSize))
      assert.ok(ticketAccount.windowEnd.eq(round_account_before.potSize.add(purchase_amount)))
      assert.ok(ticketAccount.windowEnd.eq(round_account_after.potSize))
    }

    await sleep(8000);
    try {
      const ticket_num = max_tickets + 1
      const purchase_amount = new anchor.BN(randomInteger(100, 10000))
      const lotteryTicketPDA = getTicketPDA(wallet, lottery_num, 1, ticket_num)

      await program.methods.buyTicket(purchase_amount, ticket_num).accounts({
        lotteryTicket: lotteryTicketPDA,
        state: state.publicKey,
        config: configPDA,
        round: firstRoundPDA,
        owner: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      }).signers([]).rpc();

    } catch (error) {
      // console.log({error})
      assert.equal(error.error.errorMessage, "Round already ended");
    }
  });

  it("Allows continuing to next round", async () => {
    const state = Keypair.generate();
    const wallet = program.provider.wallet
    const lottery_num = 5
    const initial_duration = new anchor.BN(3)
    const duration_extension = new anchor.BN(1)
    const min_deposit = new anchor.BN(1)
    const burn_pct = 10
    const last_depositor_pct = 15
    const team_pct = 15
    const winner_pct = 50

    const configPDA = getLotteryPDA(lottery_num)
    const firstRoundPDA = getRoundPDA(lottery_num, 1)

    await program.methods.setupLottery(
        lottery_num,
        initial_duration,
        duration_extension,   // duration_extension
        min_deposit,          // min_deposit
        burn_pct,             // burn_pct
        last_depositor_pct,   // last_depositor_pct
        team_pct,             // team_pct
        winner_pct,           // winner_pct
        incinerator,    // burn_address
        token_address,  // burn_token
        team_address,   // team_address
    ).accounts({
      config: configPDA,
      state: state.publicKey,
      firstRound: firstRoundPDA,
      creator: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    }).signers([state]).rpc();

    const max_tickets = 5
    for (let i = 1; i <= max_tickets; i++) {
      // console.log({i})
      const ticket_num = i
      const purchase_amount = new anchor.BN(randomInteger(100, 10000))

      const round_account_before = await program.account.lotteryRound.fetch(firstRoundPDA);

      const wallet_balance_before = await getBalance(wallet.publicKey)
      const round_balance_before = await getBalance(firstRoundPDA)
      const end_time_before = round_account_before.endTime


      const lotteryTicketPDA = getTicketPDA(wallet, lottery_num, 1, ticket_num)
      // console.log(state.publicKey, firstRoundPDA, configPDA, wallet.publicKey, lotteryTicketPDA)

      const txSignature = await program.methods.buyTicket(purchase_amount, ticket_num).accounts({
        lotteryTicket: lotteryTicketPDA,
        state: state.publicKey,
        config: configPDA,
        round: firstRoundPDA,
        owner: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      }).signers([]).rpc();

      await getProvider().connection.confirmTransaction(txSignature, 'confirmed');

      // Fetch the transaction details
      const txDetails = await getProvider().connection.getConfirmedTransaction(txSignature, 'confirmed');
      const transactionFee = txDetails.meta.fee;

      const rent = await getRentExemption(program.account.lotteryTicket.size);

      const wallet_balance_after = await getBalance(wallet.publicKey)
      const round_balance_after = await getBalance(firstRoundPDA)
      const round_account_after = await program.account.lotteryRound.fetch(firstRoundPDA);
      const end_time_after = round_account_after.endTime

      // console.log({transactionFee, wallet_balance_after, wallet_balance_before, round_balance_after, round_balance_before, rent})
      assert.equal(round_balance_before, round_balance_after - purchase_amount.toNumber())
      // TODO: make this exact
      assert.ok(wallet_balance_after - (wallet_balance_before - purchase_amount.toNumber() - transactionFee - rent) < 100);

      const stateAccount = await program.account.lotteryState.fetch(state.publicKey);
      const configAccount = await program.account.lotteryConfig.fetch(configPDA);

      assert.ok(stateAccount.ticketsBought.eqn(i))
      assert.ok(round_account_after.ticketsBought.eqn(i))
      // console.log({end_time_before, end_time_after}, configAccount.durationExtension.toNumber())
      assert.ok(end_time_before.eq(end_time_after.sub(configAccount.durationExtension)));
      assert.ok(round_account_before.potSize.eq(round_account_after.potSize.sub(purchase_amount)))
      // console.log(round_account_after.lastDepositor.toBase58())
      assert.equal(round_account_after.lastDepositor.toBase58(), wallet.publicKey)

      const ticketAccount = await program.account.lotteryTicket.fetch(lotteryTicketPDA)
      assert.equal(ticketAccount.owner.toBase58(), wallet.publicKey)
      assert.equal(ticketAccount.roundNum, 1)
      assert.ok(ticketAccount.windowStart.eq(round_account_before.potSize))
      assert.ok(ticketAccount.windowEnd.eq(round_account_before.potSize.add(purchase_amount)))
      assert.ok(ticketAccount.windowEnd.eq(round_account_after.potSize))
    }

    await sleep(5000);

    const secondRoundPDA = getRoundPDA(lottery_num, 2)
    const round = Keypair.generate();

    const random = new anchor.BN(randomInteger(1, 1000000))
    const txSignature = await program.methods.closeRound(random).accounts({
      previousRound: firstRoundPDA,
      nextRound: secondRoundPDA,
      state: state.publicKey,
      config: configPDA,
      closer: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      slotHashes: SLOT_HASHES_SYSVAR
    }).signers([]).rpc();
  })
})
