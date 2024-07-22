use anchor_lang::prelude::*;
use arrayref::array_ref;
use solana_program::sysvar::slot_hashes;
use solana_program::program::{invoke, invoke_signed};
use solana_program::system_instruction::{transfer, create_account};

declare_id!("5GEGV7oBhx4XWBsTQYoWWRdaELNN7hmt5cZ8vQZ4W65r");

const DISCRIMINATOR_LENGTH: usize = 8;
const U64_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
const U8_LENGTH: usize = 1;
const TIMESTAMP_LENGTH: usize = 8;


#[program]
pub mod dice {
    use std::hash::Hash;
    use sha3::{Digest, Sha3_256};
    use super::*;

    pub fn setup_dice(ctx: Context<SetupDice>, edge_bp: u64, ratio: u64, house: Pubkey, initial_funds: u64, bump: u8) -> Result<()> {
        let creator = &mut ctx.accounts.creator;
        let reserve = &mut ctx.accounts.reserve;
        let reserve_key = &mut ctx.accounts.reserve_key;

        reserve.edge_bp = edge_bp;
        reserve.ratio = ratio;
        reserve.house = house;
        reserve.reserve_key = reserve_key.key();
        reserve.bump = ctx.bumps.reserve;

        let rent = Rent::get()?;
        let minimum_balance = rent.minimum_balance(0); // No data, only lamports

        let seeds = &[b"reserve-key".as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        // create reserve key account
        invoke_signed(
            &create_account(
                &creator.key(),
                &reserve_key.key(),
                minimum_balance,
                0, // No space needed, pure system account
                &ctx.accounts.system_program.key(),
            ),
            &[
                creator.to_account_info(),
                reserve_key.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        invoke(
            &transfer(
                &creator.key(),
                &reserve_key.key(),
                initial_funds
            ),
            &[
                creator.to_account_info(),
                reserve_key.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        Ok(())
    }

    pub fn roll_dice(ctx: Context<RollDice>, user_seed: u64, multiplier_bp: u64, bet_size: u64, bump: u8) -> Result<()> {
        let player = &ctx.accounts.player;
        let reserve = &ctx.accounts.reserve;
        let house = &ctx.accounts.house;
        let reserve_key = & ctx.accounts.reserve_key;
        let slot_hashes = &ctx.accounts.slot_hashes;

        let rent = Rent::get()?;
        let minimum_balance = rent.minimum_balance(0); // Account needs to have the minimum balance for rent-exemption
        let balance: u64 = reserve_key.to_account_info().lamports();

        let minimum_balance_reserve = rent.minimum_balance(Reserve::LEN);
        let reserve_balance = reserve.to_account_info().lamports();
        let house_balance = house.to_account_info().lamports();

        let max_bet = get_max_bet(reserve, balance - minimum_balance, multiplier_bp);
        require!(max_bet >= bet_size, ErrorCode::BetTooBig);

        // transfer sol from player to reserve
        invoke(
            &transfer(
                player.key,
                reserve_key.key,
                bet_size,
            ),
            &[
                player.to_account_info(),
                reserve_key.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let seeds = &[b"reserve-key".as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        let data = slot_hashes.data.borrow();
        let most_recent = array_ref![data, 12, 8];
        let clock = Clock::get()?;
        let timestamp = clock.unix_timestamp;

        // generate random number
        let mut hasher = Sha3_256::new();
        hasher.update(user_seed.to_le_bytes());
        hasher.update(timestamp.to_le_bytes());
        hasher.update(*most_recent);
        let hashed_data = hasher.finalize();
        let hash_bytes = hashed_data[..8].try_into().map_err(|_| ErrorCode::HashConversionFailed)?;
        let winning_number = u64::from_le_bytes(hash_bytes);
        let p = winning_number % 10_000; // 1m bp == 100
        let threshold_bp = get_threshold_bp(reserve, multiplier_bp);

        msg!("p: {:?} - edge_bp: {:?} - threshold_bp: {:?} multiplier_bp: {:?}", p, reserve.edge_bp, threshold_bp, multiplier_bp);
        msg!("hash inputs: user_seed {:?} - timestamp {:?} - most_recent: {:?}", user_seed, timestamp, most_recent);
        msg!("Reserve key balance - {:?} minimum_balance - {:?}", balance, minimum_balance);
        msg!("House rent: {:?} house balance: {:?}", minimum_balance, house_balance);

        if p < threshold_bp {
            // transfer sol from reserve to player
            msg!("Win!");
            invoke_signed(
                &transfer(
                    &reserve_key.key(),
                    &player.key(),
                    (bet_size * multiplier_bp) / 10_000,
                ),
                &[
                    player.to_account_info(),
                    reserve_key.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                signer_seeds,
            )?;
        } else {
            // transfer 10% of the bet to the house
            msg!("Lose!");
            invoke_signed(
                &transfer(
                    &reserve_key.key(),
                    &house.key(),
                    bet_size / 10,
                ),
                &[
                    reserve_key.to_account_info(),
                    house.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                signer_seeds,
            )?;
        }

        Ok(())
    }
}

fn get_max_bet(reserve: &Account<Reserve>, balance: u64, multiplier_bp: u64) -> u64 {

    return (balance * 10_000) / (multiplier_bp * reserve.ratio);
}

fn get_threshold_bp(reserve: &Account<Reserve>, multiplier_bp: u64) -> u64 {

    return (10_000 * 10_000) / (multiplier_bp + reserve.edge_bp);
}

#[derive(Accounts)]
pub struct SetupDice<'info> {
    #[account(
        init,
        payer = creator,
        space = Reserve::LEN,
        seeds = [
            b"reserve"
        ],
        bump
    )]
    pub reserve: Account<'info, Reserve>,
    /// CHECK: this is ok
    #[account(mut)]
    pub reserve_key: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub creator: Signer<'info>,
}

#[account]
pub struct Reserve {
    pub ratio: u64,
    pub edge_bp: u64,
    pub house: Pubkey,
    pub reserve_key: Pubkey,
    pub bump: u8
}

impl Reserve {
    const LEN: usize = DISCRIMINATOR_LENGTH + (U64_LENGTH * 2) + (PUBLIC_KEY_LENGTH * 2) + U8_LENGTH;
}

#[derive(Accounts)]
pub struct RollDice<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        mut,
        seeds = [
            b"reserve"
        ],
        bump = reserve.bump
    )]
    pub reserve: Account<'info, Reserve>,
    /// CHECK: this is checked against the pubkey in the reserve struct
    #[account(mut, address = reserve.house)]
    pub house: AccountInfo<'info>,
    /// CHECK: This is checked against the pubkey in the reserve struct
    #[account(mut, address = reserve.reserve_key)]
    pub reserve_key: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: the address is constrained
    #[account(address = slot_hashes::id())]
    slot_hashes: UncheckedAccount<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Failed to convert hash")]
    HashConversionFailed,
    #[msg("Bet too big")]
    BetTooBig,
    #[msg("Mismatched house address")]
    MismatchedHouse,
    #[msg("Mismatched reserve-key address")]
    MismatchedReserveKey,
    #[msg("Mismatched slot-hashes key")]
    MismatchedSlotHashes
}
