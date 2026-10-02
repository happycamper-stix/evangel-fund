//! Squads v4 is the signer. Revalidate quorum and timelock on every governed action.
use crate::{check, AccountInfo, BorshDeserialize, ProgramError, Pubkey, NOTICE};
pub const SQUADS: Pubkey = solana_program::pubkey!("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf");
pub const FOUNDATION: Pubkey =
    solana_program::pubkey!("92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc");
#[derive(BorshDeserialize)]
struct Member {
    key: Pubkey,
    permissions: u8,
}
#[derive(BorshDeserialize)]
struct Multisig {
    create_key: Pubkey,
    config_authority: Pubkey,
    threshold: u16,
    time_lock: u32,
    _transaction_index: u64,
    _stale_transaction_index: u64,
    _rent_collector: Option<Pubkey>,
    bump: u8,
    members: Vec<Member>,
}
pub fn validate(account: &AccountInfo, authority: &Pubkey) -> Result<Vec<Pubkey>, ProgramError> {
    check(*account.owner == SQUADS && account.data_len() <= 1024)?;
    let data = account.try_borrow_data()?;
    check(
        data.len() >= 8
            && data[..8] == solana_program::hash::hash(b"account:Multisig").to_bytes()[..8],
    )?;
    let state =
        Multisig::deserialize(&mut &data[8..]).map_err(|_| ProgramError::InvalidAccountData)?;
    let (address, bump) = Pubkey::find_program_address(
        &[b"multisig", b"multisig", state.create_key.as_ref()],
        &SQUADS,
    );
    let vault = Pubkey::find_program_address(
        &[b"multisig", account.key.as_ref(), b"vault", &[0]],
        &SQUADS,
    )
    .0;
    check(address == *account.key && bump == state.bump && vault == *authority)?;
    check(
        state.config_authority == Pubkey::default()
            && state.threshold == 2
            && state.time_lock >= NOTICE as u32
            && state.members.len() == 3,
    )?;
    check(
        state.members.iter().all(|m| m.permissions == 7)
            && state.members.iter().any(|m| m.key == FOUNDATION)
            && state.members.windows(2).all(|m| m[0].key < m[1].key),
    )?;
    Ok(state.members.into_iter().map(|m| m.key).collect())
}
