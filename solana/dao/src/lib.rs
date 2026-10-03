//! Candidate upgrade guard. Must be immutable before it receives loader authority.
#![allow(unexpected_cfgs)]
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
};
use solana_system_interface::{instruction as system_instruction, program as system_program};
const TOKEN: Pubkey = solana_program::pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const LOADER: Pubkey = solana_program::pubkey!("BPFLoaderUpgradeab1e11111111111111111111111");
const DAY: i64 = 86400;
const MATURITY: i64 = 7 * DAY;
const VOTE: i64 = 3 * DAY;
const EXECUTION: i64 = 7 * DAY;
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Config {
    pub tag: u8,
    pub developer: Pubkey,
    pub target: Pubkey,
    pub mint: Pubkey,
    pub supply: u64,
    pub reviewers: [Pubkey; 3],
    pub treasury: Pubkey,
    pub nonce: u64,
    pub generation: u64,
}
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Stake {
    pub tag: u8,
    pub config: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub deposited: i64,
    pub locked_until: i64,
}
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Proposal {
    pub tag: u8,
    pub config: Pubkey,
    pub nonce: u64,
    pub buffer: Pubkey,
    pub code: [u8; 32],
    pub base: [u8; 32],
    pub generation: u64,
    pub review: [u8; 32],
    pub uri: String,
    pub created: i64,
    pub opened: i64,
    pub approvals: u8,
    pub challenges: u64,
    pub yes: u64,
    pub no: u64,
    pub status: u8,
}
#[derive(BorshSerialize, BorshDeserialize)]
pub struct Ballot {
    pub tag: u8,
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub challenged: bool,
    pub voted: bool,
    pub evidence: [u8; 32],
}
// Draft(0), challenge(1), approved(2), rejected(3), executed(4), canceled(5).
#[derive(BorshSerialize, BorshDeserialize)]
pub enum Action {
    Initialize {
        developer: Pubkey,
        reviewers: [Pubkey; 3],
        treasury: Pubkey,
    },
    Deposit {
        amount: u64,
    },
    Withdraw,
    Propose {
        code: [u8; 32],
        review: [u8; 32],
        uri: String,
    },
    Attest,
    Challenge {
        evidence: [u8; 32],
    },
    Vote {
        approve: bool,
    },
    Finalize,
    Cancel,
    Execute,
}
fn check(v: bool) -> ProgramResult {
    if v {
        Ok(())
    } else {
        Err(ProgramError::InvalidArgument)
    }
}
fn signed(a: &AccountInfo) -> ProgramResult {
    check(a.is_signer)
}
fn add(a: i64, b: i64) -> Result<i64, ProgramError> {
    a.checked_add(b).ok_or(ProgramError::ArithmeticOverflow)
}
fn sum(a: u64, b: u64) -> Result<u64, ProgramError> {
    a.checked_add(b).ok_or(ProgramError::ArithmeticOverflow)
}
fn nonzero(h: &[u8; 32]) -> ProgramResult {
    check(*h != [0; 32])
}
fn load<T: BorshDeserialize>(a: &AccountInfo, pid: &Pubkey, tag: u8) -> Result<T, ProgramError> {
    check(a.owner == pid && !a.data_is_empty() && a.try_borrow_data()?[0] == tag)?;
    T::deserialize(&mut &a.try_borrow_data()?[..]).map_err(|_| ProgramError::InvalidAccountData)
}
fn save<T: BorshSerialize>(a: &AccountInfo, v: &T) -> ProgramResult {
    let b = borsh::to_vec(v).map_err(|_| ProgramError::InvalidAccountData)?;
    check(b.len() <= a.data_len())?;
    a.try_borrow_mut_data()?[..b.len()].copy_from_slice(&b);
    Ok(())
}
fn pda(pid: &Pubkey, a: &AccountInfo, seeds: &[&[u8]]) -> Result<u8, ProgramError> {
    let (k, b) = Pubkey::find_program_address(seeds, pid);
    check(k == *a.key)?;
    Ok(b)
}
fn create<'a>(
    payer: &AccountInfo<'a>,
    a: &AccountInfo<'a>,
    sys: &AccountInfo<'a>,
    owner: &Pubkey,
    size: usize,
    seeds: &[&[u8]],
) -> ProgramResult {
    check(
        *sys.key == system_program::id() && a.owner == &system_program::id() && a.data_is_empty(),
    )?;
    let rent = Rent::get()?.minimum_balance(size);
    if a.lamports() == 0 {
        invoke_signed(
            &system_instruction::create_account(payer.key, a.key, rent, size as u64, owner),
            &[payer.clone(), a.clone(), sys.clone()],
            &[seeds],
        )
    } else {
        if a.lamports() < rent {
            invoke(
                &system_instruction::transfer(payer.key, a.key, rent - a.lamports()),
                &[payer.clone(), a.clone(), sys.clone()],
            )?;
        }
        invoke_signed(
            &system_instruction::allocate(a.key, size as u64),
            &[a.clone(), sys.clone()],
            &[seeds],
        )?;
        invoke_signed(
            &system_instruction::assign(a.key, owner),
            &[a.clone(), sys.clone()],
            &[seeds],
        )
    }
}
fn token(a: &AccountInfo, mint: &Pubkey, owner: &Pubkey) -> ProgramResult {
    check(*a.owner == TOKEN && a.data_len() == 165)?;
    let d = a.try_borrow_data()?;
    check(
        &d[..32] == mint.as_ref()
            && &d[32..64] == owner.as_ref()
            && d[108] == 1
            && d[72..76] == [0; 4]
            && d[129..133] == [0; 4],
    )
}
fn mint(a: &AccountInfo) -> Result<u64, ProgramError> {
    check(*a.owner == TOKEN && a.data_len() == 82)?;
    let d = a.try_borrow_data()?;
    check(d[..4] == [0; 4] && d[46..50] == [0; 4] && d[44] == 6 && d[45] == 1)?;
    let n = u64::from_le_bytes(d[36..44].try_into().unwrap());
    check(n > 0)?;
    Ok(n)
}
fn transfer<'a>(
    from: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    owner: &AccountInfo<'a>,
    program: &AccountInfo<'a>,
    n: u64,
    seeds: &[&[u8]],
) -> ProgramResult {
    check(*program.key == TOKEN)?;
    let mut data = vec![12];
    data.extend(n.to_le_bytes());
    data.push(6);
    let ix = Instruction {
        program_id: TOKEN,
        accounts: vec![
            AccountMeta::new(*from.key, false),
            AccountMeta::new_readonly(*mint.key, false),
            AccountMeta::new(*to.key, false),
            AccountMeta::new_readonly(*owner.key, true),
        ],
        data,
    };
    let infos = [
        from.clone(),
        mint.clone(),
        to.clone(),
        owner.clone(),
        program.clone(),
    ];
    if seeds.is_empty() {
        invoke(&ix, &infos)
    } else {
        invoke_signed(&ix, &infos, &[seeds])
    }
}
fn buffer(a: &AccountInfo, authority: &Pubkey, code: &[u8; 32]) -> ProgramResult {
    check(*a.owner == LOADER && a.data_len() > 37)?;
    let d = a.try_borrow_data()?;
    check(d[..4] == 1u32.to_le_bytes() && d[4] == 1 && &d[5..37] == authority.as_ref())?;
    check(solana_program::hash::hash(&d[37..]).to_bytes() == *code)
}
fn proposal(a: &AccountInfo, pid: &Pubkey, config: &Pubkey) -> Result<Proposal, ProgramError> {
    let p: Proposal = load(a, pid, 3)?;
    check(p.config == *config)?;
    pda(
        pid,
        a,
        &[b"proposal", config.as_ref(), &p.nonce.to_le_bytes()],
    )?;
    Ok(p)
}
fn stake(
    a: &AccountInfo,
    pid: &Pubkey,
    config: &Pubkey,
    owner: &Pubkey,
) -> Result<Stake, ProgramError> {
    pda(pid, a, &[b"stake", config.as_ref(), owner.as_ref()])?;
    let s: Stake = load(a, pid, 2)?;
    check(s.config == *config && s.owner == *owner)?;
    Ok(s)
}
fn percent(n: u64, supply: u64, bps: u64) -> bool {
    (n as u128) * 10000 >= (supply as u128) * (bps as u128)
}
pub fn outcome(p: &Proposal, c: &Config, now: i64) -> Result<u8, ProgramError> {
    check(p.status == 1 && now >= add(p.opened, DAY)?)?;
    if !percent(p.challenges, c.supply, 100) {
        return Ok(2);
    }
    check(now >= add(p.opened, DAY + VOTE)?)?;
    // An escalated change needs affirmative quorum and a strict majority. Ties/abstention fail closed.
    Ok(
        if percent(sum(p.yes, p.no)?, c.supply, 1000) && p.yes > p.no {
            2
        } else {
            3
        },
    )
}
entrypoint!(process_instruction);
pub fn process_instruction(pid: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let action = Action::try_from_slice(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    let it = &mut accounts.iter();
    let who = next_account_info(it)?;
    signed(who)?;
    let ca = next_account_info(it)?;
    let now = Clock::get()?.unix_timestamp;
    if let Action::Initialize {
        developer,
        reviewers,
        treasury,
    } = action
    {
        let target = next_account_info(it)?;
        let pd = next_account_info(it)?;
        let ma = next_account_info(it)?;
        let sys = next_account_info(it)?;
        let guard_data = next_account_info(it)?;
        pda(&LOADER, guard_data, &[pid.as_ref()])?;
        {
            check(*guard_data.owner == LOADER)?;
            let d = guard_data.try_borrow_data()?;
            check(d.len() >= 45 && d[..4] == 3u32.to_le_bytes() && d[12] == 0)?;
        }
        check(
            target.executable
                && *target.owner == LOADER
                && *pd.owner == LOADER
                && reviewers[0] < reviewers[1]
                && reviewers[1] < reviewers[2]
                && !reviewers.contains(&developer)
                && !reviewers.contains(&Pubkey::default())
                && developer != Pubkey::default()
                && treasury != Pubkey::default(),
        )?;
        {
            let d = target.try_borrow_data()?;
            check(d.len() == 36 && d[..4] == 2u32.to_le_bytes() && &d[4..36] == pd.key.as_ref())?;
        }
        {
            let d = pd.try_borrow_data()?;
            check(
                d.len() >= 45
                    && d[..4] == 3u32.to_le_bytes()
                    && d[12] == 1
                    && &d[13..45] == who.key.as_ref(),
            )?;
        }
        pda(&LOADER, pd, &[target.key.as_ref()])?;
        let bump = pda(pid, ca, &[b"dao", target.key.as_ref()])?;
        let supply = mint(ma)?;
        create(
            who,
            ca,
            sys,
            pid,
            512,
            &[b"dao", target.key.as_ref(), &[bump]],
        )?;
        return save(
            ca,
            &Config {
                tag: 1,
                developer,
                target: *target.key,
                mint: *ma.key,
                supply,
                reviewers,
                treasury,
                nonce: 0,
                generation: 0,
            },
        );
    }
    let mut c: Config = load(ca, pid, 1)?;
    pda(pid, ca, &[b"dao", c.target.as_ref()])?;
    match action {
        Action::Deposit { amount } => {
            check(amount > 0)?;
            let sa = next_account_info(it)?;
            let vault = next_account_info(it)?;
            let source = next_account_info(it)?;
            let ma = next_account_info(it)?;
            let tp = next_account_info(it)?;
            let sys = next_account_info(it)?;
            check(*ma.key == c.mint)?;
            mint(ma)?;
            token(source, &c.mint, who.key)?;
            let sb = pda(pid, sa, &[b"stake", ca.key.as_ref(), who.key.as_ref()])?;
            let vb = pda(pid, vault, &[b"escrow", ca.key.as_ref(), who.key.as_ref()])?;
            if sa.data_is_empty() {
                create(
                    who,
                    sa,
                    sys,
                    pid,
                    128,
                    &[b"stake", ca.key.as_ref(), who.key.as_ref(), &[sb]],
                )?;
            } else {
                let old = stake(sa, pid, ca.key, who.key)?;
                check(old.amount == 0 && now >= old.locked_until)?;
            }
            if vault.data_is_empty() {
                create(
                    who,
                    vault,
                    sys,
                    &TOKEN,
                    165,
                    &[b"escrow", ca.key.as_ref(), who.key.as_ref(), &[vb]],
                )?;
                check(*tp.key == TOKEN)?;
                let mut data = vec![18];
                data.extend_from_slice(sa.key.as_ref());
                invoke(
                    &Instruction {
                        program_id: TOKEN,
                        accounts: vec![
                            AccountMeta::new(*vault.key, false),
                            AccountMeta::new_readonly(*ma.key, false),
                        ],
                        data,
                    },
                    &[vault.clone(), ma.clone(), tp.clone()],
                )?;
            }
            token(vault, &c.mint, sa.key)?;
            transfer(source, ma, vault, who, tp, amount, &[])?;
            save(
                sa,
                &Stake {
                    tag: 2,
                    config: *ca.key,
                    owner: *who.key,
                    amount,
                    deposited: now,
                    locked_until: now,
                },
            )
        }
        Action::Withdraw => {
            let sa = next_account_info(it)?;
            let vault = next_account_info(it)?;
            let dest = next_account_info(it)?;
            let ma = next_account_info(it)?;
            let tp = next_account_info(it)?;
            let mut s = stake(sa, pid, ca.key, who.key)?;
            check(now >= s.locked_until && s.amount > 0 && *ma.key == c.mint)?;
            pda(pid, vault, &[b"escrow", ca.key.as_ref(), who.key.as_ref()])?;
            token(vault, &c.mint, sa.key)?;
            token(dest, &c.mint, who.key)?;
            let bump = pda(pid, sa, &[b"stake", ca.key.as_ref(), who.key.as_ref()])?;
            transfer(
                vault,
                ma,
                dest,
                sa,
                tp,
                s.amount,
                &[b"stake", ca.key.as_ref(), who.key.as_ref(), &[bump]],
            )?;
            s.amount = 0;
            save(sa, &s)
        }
        Action::Propose { code, review, uri } => {
            check(*who.key == c.developer && uri.starts_with("https://") && uri.len() <= 200)?;
            nonzero(&code)?;
            nonzero(&review)?;
            let pa = next_account_info(it)?;
            let ba = next_account_info(it)?;
            let authority = next_account_info(it)?;
            let sys = next_account_info(it)?;
            pda(pid, authority, &[b"authority", ca.key.as_ref()])?;
            buffer(ba, authority.key, &code)?;
            let pd = next_account_info(it)?;
            pda(&LOADER, pd, &[c.target.as_ref()])?;
            check(*pd.owner == LOADER && pd.data_len() >= 45)?;
            let base = solana_program::hash::hash(&pd.try_borrow_data()?[45..]).to_bytes();
            let bump = pda(
                pid,
                pa,
                &[b"proposal", ca.key.as_ref(), &c.nonce.to_le_bytes()],
            )?;
            create(
                who,
                pa,
                sys,
                pid,
                640,
                &[
                    b"proposal",
                    ca.key.as_ref(),
                    &c.nonce.to_le_bytes(),
                    &[bump],
                ],
            )?;
            save(
                pa,
                &Proposal {
                    tag: 3,
                    config: *ca.key,
                    nonce: c.nonce,
                    buffer: *ba.key,
                    code,
                    base,
                    generation: c.generation,
                    review,
                    uri,
                    created: now,
                    opened: 0,
                    approvals: 0,
                    challenges: 0,
                    yes: 0,
                    no: 0,
                    status: 0,
                },
            )?;
            c.nonce = sum(c.nonce, 1)?;
            save(ca, &c)
        }
        Action::Attest => {
            let pa = next_account_info(it)?;
            let mut p = proposal(pa, pid, ca.key)?;
            check(p.status == 0 && now < add(p.created, 7 * DAY)?)?;
            let index = c
                .reviewers
                .iter()
                .position(|v| v == who.key)
                .ok_or(ProgramError::InvalidArgument)?;
            check(p.approvals & (1 << index) == 0)?;
            p.approvals |= 1 << index;
            if p.approvals.count_ones() >= 2 {
                p.status = 1;
                p.opened = now;
            }
            save(pa, &p)
        }
        Action::Challenge { .. } | Action::Vote { .. } => {
            let pa = next_account_info(it)?;
            let sa = next_account_info(it)?;
            let ballot = next_account_info(it)?;
            let sys = next_account_info(it)?;
            let mut p = proposal(pa, pid, ca.key)?;
            let mut s = stake(sa, pid, ca.key, who.key)?;
            check(p.status == 1 && s.amount > 0 && add(s.deposited, MATURITY)? <= p.created)?;
            let bump = pda(pid, ballot, &[b"ballot", pa.key.as_ref(), who.key.as_ref()])?;
            let mut b = if ballot.data_is_empty() {
                create(
                    who,
                    ballot,
                    sys,
                    pid,
                    128,
                    &[b"ballot", pa.key.as_ref(), who.key.as_ref(), &[bump]],
                )?;
                Ballot {
                    tag: 4,
                    proposal: *pa.key,
                    voter: *who.key,
                    challenged: false,
                    voted: false,
                    evidence: [0; 32],
                }
            } else {
                load::<Ballot>(ballot, pid, 4)?
            };
            check(b.proposal == *pa.key && b.voter == *who.key)?;
            match action {
                Action::Challenge { evidence } => {
                    nonzero(&evidence)?;
                    check(now < add(p.opened, DAY)? && !b.challenged)?;
                    p.challenges = sum(p.challenges, s.amount)?;
                    check(p.challenges <= c.supply)?;
                    b.challenged = true;
                    b.evidence = evidence;
                    solana_program::msg!("challenge evidence: {:?}", evidence);
                }
                Action::Vote { approve } => {
                    check(
                        percent(p.challenges, c.supply, 100)
                            && now >= add(p.opened, DAY)?
                            && now < add(p.opened, DAY + VOTE)?
                            && !b.voted,
                    )?;
                    if approve {
                        p.yes = sum(p.yes, s.amount)?
                    } else {
                        p.no = sum(p.no, s.amount)?
                    };
                    check(sum(p.yes, p.no)? <= c.supply)?;
                    b.voted = true;
                }
                _ => unreachable!(),
            }
            s.locked_until = s.locked_until.max(add(p.opened, DAY + VOTE)?);
            save(sa, &s)?;
            save(ballot, &b)?;
            save(pa, &p)
        }
        Action::Finalize => {
            let pa = next_account_info(it)?;
            let mut p = proposal(pa, pid, ca.key)?;
            p.status = outcome(&p, &c, now)?;
            save(pa, &p)
        }
        Action::Cancel => {
            check(*who.key == c.developer)?;
            let pa = next_account_info(it)?;
            let mut p = proposal(pa, pid, ca.key)?;
            check(p.status <= 2)?;
            p.status = 5;
            save(pa, &p)
        }
        Action::Execute => {
            let pa = next_account_info(it)?;
            let mut p = proposal(pa, pid, ca.key)?;
            check(p.status == 2 && now < add(p.opened, DAY + VOTE + EXECUTION)?)?;
            let target = next_account_info(it)?;
            let pd = next_account_info(it)?;
            let ba = next_account_info(it)?;
            let treasury = next_account_info(it)?;
            let rent = next_account_info(it)?;
            let clock = next_account_info(it)?;
            let authority = next_account_info(it)?;
            let loader = next_account_info(it)?;
            check(
                *target.key == c.target
                    && *ba.key == p.buffer
                    && *treasury.key == c.treasury
                    && *loader.key == LOADER
                    && *rent.key == solana_program::sysvar::rent::id()
                    && *clock.key == solana_program::sysvar::clock::id(),
            )?;
            pda(&LOADER, pd, &[c.target.as_ref()])?;
            let bump = pda(pid, authority, &[b"authority", ca.key.as_ref()])?;
            buffer(ba, authority.key, &p.code)?;
            check(*pd.owner == LOADER && pd.data_len() >= 45 && p.generation == c.generation)?;
            check(solana_program::hash::hash(&pd.try_borrow_data()?[45..]).to_bytes() == p.base)?;
            c.generation = sum(c.generation, 1)?;
            save(ca, &c)?;
            // Persist before CPI. Runtime rollback restores this if the loader rejects the upgrade.
            p.status = 4;
            save(pa, &p)?;
            invoke_signed(
                &Instruction {
                    program_id: LOADER,
                    accounts: vec![
                        AccountMeta::new(*pd.key, false),
                        AccountMeta::new(*target.key, false),
                        AccountMeta::new(*ba.key, false),
                        AccountMeta::new(*treasury.key, false),
                        AccountMeta::new_readonly(*rent.key, false),
                        AccountMeta::new_readonly(*clock.key, false),
                        AccountMeta::new_readonly(*authority.key, true),
                    ],
                    data: 3u32.to_le_bytes().to_vec(),
                },
                &[
                    pd.clone(),
                    target.clone(),
                    ba.clone(),
                    treasury.clone(),
                    rent.clone(),
                    clock.clone(),
                    authority.clone(),
                    loader.clone(),
                ],
                &[&[b"authority", ca.key.as_ref(), &[bump]]],
            )
        }
        Action::Initialize { .. } => Err(ProgramError::InvalidInstructionData),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn setup() -> (Config, Proposal) {
        let c = Config {
            tag: 1,
            developer: Pubkey::default(),
            target: Pubkey::default(),
            mint: Pubkey::default(),
            supply: 21_000_000,
            reviewers: [Pubkey::default(); 3],
            treasury: Pubkey::default(),
            nonce: 0,
            generation: 0,
        };
        let p = Proposal {
            tag: 3,
            config: Pubkey::default(),
            nonce: 0,
            buffer: Pubkey::default(),
            code: [1; 32],
            base: [1; 32],
            generation: 0,
            review: [1; 32],
            uri: String::new(),
            created: 1,
            opened: 10,
            approvals: 3,
            challenges: 0,
            yes: 0,
            no: 0,
            status: 1,
        };
        (c, p)
    }
    #[test]
    fn unchallenged_waits_full_day() {
        let (c, p) = setup();
        assert!(outcome(&p, &c, 10 + DAY - 1).is_err());
        assert_eq!(outcome(&p, &c, 10 + DAY).unwrap(), 2);
    }
    #[test]
    fn qualifying_challenge_requires_vote() {
        let (c, mut p) = setup();
        p.challenges = 210_000;
        assert!(outcome(&p, &c, 10 + DAY).is_err());
        assert_eq!(outcome(&p, &c, 10 + DAY + VOTE).unwrap(), 3);
        p.yes = 2_100_000;
        assert_eq!(outcome(&p, &c, 10 + DAY + VOTE).unwrap(), 2);
    }
    #[test]
    fn ties_and_low_turnout_block() {
        let (c, mut p) = setup();
        p.challenges = 210_000;
        p.yes = 1_050_000;
        p.no = 1_050_000;
        assert_eq!(outcome(&p, &c, 10 + DAY + VOTE).unwrap(), 3);
        p.no = 0;
        assert_eq!(outcome(&p, &c, 10 + DAY + VOTE).unwrap(), 3);
    }
    #[test]
    fn threshold_boundaries_and_overflow() {
        assert!(!percent(209_999, 21_000_000, 100));
        assert!(percent(210_000, 21_000_000, 100));
        assert!(sum(u64::MAX, 1).is_err());
        assert!(add(i64::MAX, 1).is_err());
    }
}
