use anchor_lang::prelude::*;

declare_id!("5i4cV3G5eJRTa4CK8rbw8Nf15JpKgZCa7fG98mcuFt5X");

#[program]
pub mod casino {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
