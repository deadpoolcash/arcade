use anchor_lang::prelude::*;
// use anchor_spl::token::{self, TokenAccount, Transfer, Token};
use sha3::{Digest, Sha3_256};
use solana_program::pubkey::Pubkey;
use solana_program::sysvar::slot_hashes::{SlotHashes};
use solana_program::sysvar::slot_hashes;
use arrayref::array_ref;


declare_id!("GPQoxR32g2heKCf5DeKWnR4CyGC1qnBVXzW8kiCR3pBz");

const DISCRIMINATOR_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
const TIMESTAMP_LENGTH: usize = 8;

#[program]
pub mod lottery {
    use std::hash::Hash;
    use solana_program::slot_hashes::SlotHash;
    use super::*;

    pub fn setup_lottery(ctx: Context<SetupLottery>,
                      lottery_num: u8,
                      initial_duration: u64,
                      duration_extension: u64,
                      min_deposit: u64,
                      burn_pct: u8,
                      last_depositor_pct: u8,
                      team_pct: u8,
                      winner_pct: u8,
                      burn_address: Pubkey,
                      burn_token: Pubkey,
                      team_address: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        // let seeds = &[
        //     b"round".as_ref(),
        //     &[lottery_num, 0, 0, 0, 0],
        //     &[1u8, 0, 0, 0, 0],
        // ];
        //
        // let (pda, bump_seed) = Pubkey::find_program_address(seeds, &ctx.program_id);
        //
        // // Print seed information for debugging
        // msg!("Seed 1: {:?}", seeds[0]);
        // msg!("Seed 2: {:?}", seeds[1]);
        // msg!("Seed 3: {:?}", seeds[2]);
        // msg!("PDA: {}", pda);
        // msg!("Bump seed: {}", bump_seed);


        config.lottery_num = lottery_num;
        config.initial_duration = initial_duration;
        config.duration_extension = duration_extension;
        config.min_deposit = min_deposit;
        config.burn_pct = burn_pct;
        config.last_depositor_pct = last_depositor_pct;
        config.team_pct = team_pct;
        config.winner_pct = winner_pct;
        config.burn_address = burn_address;
        config.burn_token = burn_token;
        config.team_address = team_address;
        require!(burn_pct + team_pct + winner_pct + last_depositor_pct == 90, ErrorCode::BadPercentages);
        require!(burn_pct < 100 && team_pct < 100 && winner_pct < 100 && last_depositor_pct < 100, ErrorCode::BadPercentages);

        let state = &mut ctx.accounts.state;
        state.num_rounds = 1;
        state.tickets_bought = 0;

        let first_round = &mut ctx.accounts.first_round;
        first_round.bump = ctx.bumps.first_round;
        initialize_round(lottery_num, 1, 0, config.initial_duration, 0, first_round);

        Ok(())
    }

    pub fn close_round(ctx: Context<CloseRound>, user_seed: u64) -> Result<()> {
        let previous_round = &mut ctx.accounts.previous_round;
        let next_round = &mut ctx.accounts.next_round;
        let state = &mut ctx.accounts.state;
        let config = &mut ctx.accounts.config;

        let recent_slot_hashes = &ctx.accounts.slot_hashes;
        let data = recent_slot_hashes.data.borrow();
        let most_recent = array_ref![data, 12, 8];
        let clock = Clock::get()?;

        // generate random number
        let mut hasher = Sha3_256::new();
        hasher.update(user_seed.to_le_bytes());
        hasher.update(clock.unix_timestamp.to_le_bytes());
        hasher.update(*most_recent);
        let hashed_data = hasher.finalize();
        let hash_bytes = hashed_data[..8].try_into().map_err(|_| ErrorCode::HashConversionFailed)?;
        let winning_number = u64::from_le_bytes(hash_bytes);
        previous_round.winning_number = winning_number % state.tickets_bought;

        // initialize next round
        state.num_rounds = state.num_rounds.checked_add(1).unwrap();
        initialize_round(
            config.lottery_num,
            state.num_rounds,
            state.tickets_bought,
            config.initial_duration,
            previous_round.pot_size / 10,
            next_round
        );
        // next_round.bump = ctx.bumps.next_round;

        Ok(())
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>, round_num: u64) -> Result<()> {
        let ticket : &mut Account<LotteryTicket> = &mut ctx.accounts.ticket;
        let round: &mut Account<LotteryRound> = &mut ctx.accounts.round;
        let state = &mut ctx.accounts.state;
        require!(check_ticket(ticket, round.winning_number, round.round_num - ticket.round_num), ErrorCode::NotWinningTicket);
        require!(round.winning_depositor == Pubkey::default(), ErrorCode::RoundAlreadyClaimed);

        // TODO: transfer loot

        round.winning_depositor = ticket.owner;

        Ok(())
    }

    pub fn buy_ticket(ctx: Context<BuyTicket>, amount: u64, user_ticket_num: u8) -> Result<()> {
        let ticket: &mut Account<LotteryTicket> = &mut ctx.accounts.lottery_ticket;
        let round: &mut Account<LotteryRound> = &mut ctx.accounts.round;
        let config: &mut Account<LotteryConfig> = &mut ctx.accounts.config;
        let state: &mut Account<LotteryState> = &mut ctx.accounts.state;
        let owner: &Signer = &ctx.accounts.owner;

        let clock: Clock = Clock::get().unwrap();
        require!((clock.unix_timestamp as u64) < round.end_time, ErrorCode::RoundAlreadyEnded);
        require!(config.min_deposit <= amount, ErrorCode::DepositTooSmall);

        ticket.owner = *owner.key;
        ticket.user_ticket_num = user_ticket_num;
        ticket.round_num = round.round_num;
        ticket.window_start = round.pot_size;
        ticket.window_end = ticket.window_start.checked_add(amount).unwrap();
        // ticket.bump = ctx.bumps.lottery_ticket;

        state.tickets_bought = state.tickets_bought.checked_add(1).unwrap();
        // track pot size
        round.pot_size = round.pot_size.checked_add(amount).unwrap();
        // increment tickets bought
        round.tickets_bought = round.tickets_bought.checked_add(1).unwrap();
        // set last depositor
        round.last_depositor = *owner.key;
        // extend round end time
        round.end_time = round.end_time.checked_add(config.duration_extension).unwrap();

        // Invoke the transfer
        solana_program::program::invoke(
            &solana_program::system_instruction::transfer(
                owner.to_account_info().key,
                round.to_account_info().key,
                amount,
            ),
            &[
                owner.to_account_info(),
                round.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        Ok(())
    }
}

fn initialize_round(lottery_num: u8, round_num: u32, previous_pot_size: u64, initial_duration: u64, pot_size: u64, round: &mut LotteryRound) {
    let clock: Clock = Clock::get().unwrap();
    round.lottery_num = lottery_num;
    round.round_num = round_num;
    round.tickets_bought = 0;
    round.start_time = clock.unix_timestamp as u64;
    round.end_time = round.start_time.checked_add(initial_duration).unwrap();
    round.winning_number = 0;
    round.previous_pot_size = previous_pot_size;
    round.pot_size = pot_size;
    // round.last_depositor
}

pub fn check_ticket(ticket: &LotteryTicket, winning_number: u64, rounds_past: u32) -> bool {
    let start = ticket.window_start / 10u64.pow(rounds_past);
    let end = ticket.window_end / 10u64.pow(rounds_past);
    return start <= winning_number && winning_number < end;
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account()]
    pub config: Account<'info, LotteryConfig>,
    #[account(mut)]
    pub state: Account<'info, LotteryState>,
    #[account(
        mut,
        seeds = [
            b"buy-ticket",
            ticket.owner.key().as_ref(),
            &round.round_num.to_le_bytes(),
            &round.tickets_bought.to_le_bytes()
        ],
        bump = ticket.bump
    )]
    pub ticket: Account<'info, LotteryTicket>,
    #[account(mut)]
    pub round: Account<'info, LotteryRound>
}

#[derive(Accounts)]
pub struct CloseRound<'info> {
    #[account(
        seeds = [
            b"round",
            &(config.lottery_num as u32).to_le_bytes()[..4],
            &(previous_round.round_num).to_le_bytes()[..4]
        ],
        bump = previous_round.bump
    )]
    pub previous_round: Account<'info, LotteryRound>,
    #[account(
        init,
        payer = closer,
        space = LotteryRound::LEN,
        seeds = [
            b"round",
            &(config.lottery_num as u32).to_le_bytes()[..4],
            &(previous_round.round_num + 1u32).to_le_bytes()[..4]
        ],
        bump
    )]
    pub next_round: Account<'info, LotteryRound>,
    #[account(mut)]
    pub state: Account<'info, LotteryState>,
    #[account()]
    pub config: Account<'info, LotteryConfig>,
    #[account(mut)]
    pub closer: Signer<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: we check the address matches in the constraint below
    #[account(address = slot_hashes::id())]
    slot_hashes: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(amount: u64, user_ticket_num: u8)]
pub struct BuyTicket<'info> {
    #[account(
        init,
        payer = owner,
        space = LotteryTicket::LEN,
        seeds = [
            b"buy-ticket",
            owner.key().as_ref(),
            round.round_num.to_le_bytes().as_ref(),
            &[user_ticket_num, 0, 0, 0],
            &[config.lottery_num, 0, 0, 0]
        ],
        bump
    )]
    pub lottery_ticket: Account<'info, LotteryTicket>,
    #[account(mut)]
    pub state: Account<'info, LotteryState>,
    #[account(mut)]
    pub config: Account<'info, LotteryConfig>,
    #[account(mut)]
    pub round: Account<'info, LotteryRound>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(lottery_num: u8)]
pub struct SetupLottery<'info> {
    #[account(
        init,
        payer = creator,
        space = LotteryConfig::LEN,
        seeds = [
            b"lottery",
            &[lottery_num, 0, 0, 0, 0, 0, 0]
        ],
        bump
    )]
    pub config: Account<'info, LotteryConfig>,
    #[account(init, payer = creator, space = LotteryState::LEN)]
    pub state: Account<'info, LotteryState>,
    #[account(
        init,
        payer = creator,
        space = LotteryRound::LEN,
        seeds = [
            b"round",
            &(lottery_num as u32).to_le_bytes()[..4],
            &(1u32.to_le_bytes())[..4]
        ],
        bump
    )]
    pub first_round: Account<'info, LotteryRound>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[account]
pub struct LotteryConfig {
    pub lottery_num: u8,
    pub initial_duration: u64,
    pub duration_extension: u64,
    pub min_deposit: u64,
    pub burn_pct: u8,
    pub last_depositor_pct: u8,
    pub team_pct: u8,
    pub winner_pct: u8,
    pub burn_address: Pubkey,
    pub burn_token: Pubkey,
    pub team_address: Pubkey,
}

impl LotteryConfig {
    const LEN: usize = DISCRIMINATOR_LENGTH + 1 + (8 * 3) + 4 + (PUBLIC_KEY_LENGTH * 3);
}

#[account]
pub struct LotteryRound {
    pub lottery_num: u8,
    pub round_num: u32,
    pub tickets_bought: u64,
    pub start_time: u64,
    pub end_time: u64,
    pub winning_number: u64,
    pub previous_pot_size: u64,
    pub pot_size: u64,
    pub bump: u8,
    pub last_depositor: Pubkey,
    pub winning_depositor: Pubkey
}

impl LotteryRound {
    const LEN: usize = DISCRIMINATOR_LENGTH + 1 + 4 + (8 * 8) + 1 + (2 * PUBLIC_KEY_LENGTH);
}

#[account]
pub struct LotteryState {
    pub num_rounds: u32,
    pub tickets_bought: u64
}

impl LotteryState {
    const LEN: usize = DISCRIMINATOR_LENGTH + 4 + 8;
}

#[account]
pub struct LotteryTicket {
    pub round_num: u32,
    pub user_ticket_num: u8,
    pub window_start: u64,
    pub window_end: u64,
    pub owner: Pubkey,
    pub bump: u8
}

impl LotteryTicket {
    const LEN: usize = DISCRIMINATOR_LENGTH + 4 + 1 + (8 * 2) + PUBLIC_KEY_LENGTH + 1;
}


#[error_code]
pub enum ErrorCode {
    #[msg("The lottery has not ended yet.")]
    LotteryNotEnded,
    #[msg("Percentages should add to 90%")]
    BadPercentages,
    #[msg("Round already ended")]
    RoundAlreadyEnded,
    #[msg("Deposit too small")]
    DepositTooSmall,
    #[msg("Unable to retrieve blockhash")]
    NoBlockhash,
    #[msg("Failed to convert hash")]
    HashConversionFailed,
    #[msg("Not the winning ticket")]
    NotWinningTicket,
    #[msg("Round already claimed")]
    RoundAlreadyClaimed
}
