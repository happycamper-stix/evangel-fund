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
mod bpf_loader_upgradeable {
    pub fn id() -> solana_program::pubkey::Pubkey {
        solana_program::pubkey!("BPFLoaderUpgradeab1e11111111111111111111111")
    }
}

mod fees;
mod governance;
mod venue;
entrypoint!(process_instruction);
const TOKEN: Pubkey = solana_program::pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const REAL_EACC: Pubkey = solana_program::pubkey!("CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU");
const SUPPLY: u64 = 21_000_000_000_000;
const LIQUIDITY: u64 = 14_700_000_000_000;
const DEV_CAP: u64 = 4_200_000_000_000;
const RESERVE: u64 = 6_300_000_000_000;
const CAP: u64 = 210_000_000_000;
const WINDOW: i64 = 21 * 86400;
const NOTICE: i64 = 2 * 86400;
const FACTORY_SIZE: usize = 512;
const PROJECT_SIZE: usize = 8192;
const MILESTONE_SIZE: usize = 2048;
const SUBMISSION_SIZE: usize = 160;
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Factory {
    pub tag: u8,
    pub authority: Pubkey,
    pub quote_mint: Pubkey,
    pub test_mode: bool,
    pub count: u64,
    pub fees: u64,
    pub retired_budget: u64,
    pub oss_budget: u64,
    pub governance_budget: u64,
    pub foundation_budget: u64,
    pub governance_multisig: Pubkey,
    pub expense_committed: u64,
    pub expense_next_at: i64,
}
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Release {
    pub at: i64,
    pub amount: u64,
}
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Project {
    pub tag: u8,
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub adopted: bool,
    pub adoption_at: i64,
    pub adoption_nonce: u64,
    pub adoption_hash: [u8; 32],
    pub adoption_challenged: bool,
    pub virtual_quote: u64,
    pub token_reserve: u64,
    pub quote_reserve: u64,
    pub dev_released: u64,
    pub worker_released: u64,
    pub dev_committed: u64,
    pub worker_committed: u64,
    pub milestone_count: u64,
    pub tokenless: bool,
    pub sol_available: u64,
    pub sol_committed: u64,
    pub refundable: u64,
    pub sol_funded: u64,
    pub awards: Vec<Pubkey>,
    pub releases: Vec<Release>,
    pub name: String,
    pub symbol: String,
    pub source: String,
}
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Milestone {
    pub tag: u8,
    pub project: Pubkey,
    pub id: u64,
    pub community: bool,
    pub amount: u64,
    pub deadline: i64,
    pub terms: [u8; 32],
    pub uri: String,
    pub status: u8,
    pub ready_at: i64,
    pub worker: Pubkey,
    pub evidence: [u8; 32],
    pub revision: u64,
    pub report: [u8; 32],
    pub award_order: u64,
    pub sol_reward: bool,
    pub quote_day: i64,
    pub challenged: bool,
    pub failed_worker: Pubkey,
}
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Submission {
    pub tag: u8,
    pub milestone: Pubkey,
    pub worker: Pubkey,
    pub revision: u64,
    pub evidence: [u8; 32],
}
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Sponsorship {
    pub tag: u8,
    pub project: Pubkey,
    pub sponsor: Pubkey,
    pub nonce: u64,
    pub amount: u64,
    pub until: i64,
    pub settled: bool,
}
#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdoptionCandidate {
    pub tag: u8,
    pub project: Pubkey,
    pub owner: Pubkey,
    pub terms: [u8; 32],
}
// Status: 0 proposed, 1 approved plan, 2 approved completion, 3 challenged, 4 paid, 5 rejected.
#[derive(BorshSerialize, BorshDeserialize)]
pub enum Action {
    Initialize {
        authority: Pubkey,
        quote_mint: Pubkey,
        test_mode: bool,
        governance_multisig: Pubkey,
    },
    Launch {
        name: String,
        symbol: String,
        source: String,
        virtual_quote: u64,
    },
    RequestAdoption {
        terms: [u8; 32],
    },
    ApproveAdoption {
        nonce: u64,
        owner: Pubkey,
        terms: [u8; 32],
        report: [u8; 32],
    },
    FinalizeAdoption,
    Swap {
        buy: bool,
        amount: u64,
        min_out: u64,
        deadline: i64,
    },
    ProposeMilestone {
        community: bool,
        sol_reward: bool,
        amount: u64,
        deadline: i64,
        terms: [u8; 32],
        uri: String,
    },
    ReviewMilestone {
        approve: bool,
        terms: [u8; 32],
        report: [u8; 32],
    },
    SubmitWork {
        evidence: [u8; 32],
    },
    Award {
        revision: u64,
        evidence: [u8; 32],
        report: [u8; 32],
    },
    Reopen {
        revision: u64,
        report: [u8; 32],
    },
    Pay,
    Challenge {
        reason: [u8; 32],
    },
    Resolve {
        revision: u64,
        uphold: bool,
        report: [u8; 32],
    },
    FundOss {
        amount: u64,
        evidence: [u8; 32],
    },
    BuyBurn {
        sol: u64,
        tokens: u64,
        report: [u8; 32],
    },
    RegisterFund {
        name: String,
        source: String,
    },
    Sponsor {
        amount: u64,
        nonce: u64,
    },
    SettleSponsorship {
        refund: bool,
    },
    RejectAdoption {
        report: [u8; 32],
    },
    ApproveExpense {
        amount: u64,
        invoice: [u8; 32],
        report: [u8; 32],
    },
    ClaimExpense,
    ClaimFoundation,
    Governed {
        expires_at: i64,
        action: Vec<u8>,
    },
    InitializeFeeDay {
        day: i64,
    },
    SettleFeeDay {
        day: i64,
    },
    ClaimDevelopment {
        day: i64,
    },
    ClaimQuoteFoundation {
        day: i64,
    },
    ApproveQuoteExpense {
        day: i64,
        amount: u64,
        invoice: [u8; 32],
        report: [u8; 32],
    },
    ClaimQuoteExpense {
        day: i64,
    },
    CancelQuoteExpense {
        day: i64,
    },
    ProposeQuoteMilestone {
        day: i64,
        amount: u64,
        deadline: i64,
        terms: [u8; 32],
        uri: String,
    },
    // Append-only ABI: independently verified candidate selection may supersede
    // an unverified claim. Only governance can select or advance this epoch.
    SelectAdopter {
        nonce: u64,
        owner: Pubkey,
        terms: [u8; 32],
        report: [u8; 32],
    },
    SubmitAdoptionCandidate {
        terms: [u8; 32],
    },
    LaunchVenue {
        name: String,
        symbol: String,
        source: String,
        sqrt_min: u128,
        sqrt_max: u128,
        liquidity: u128,
    },
    CollectVenue,
}
fn check(ok: bool) -> ProgramResult {
    if ok {
        Ok(())
    } else {
        Err(ProgramError::InvalidArgument)
    }
}
fn signed(a: &AccountInfo) -> ProgramResult {
    check(a.is_signer)
}
fn hash(h: &[u8; 32]) -> ProgramResult {
    check(*h != [0; 32])
}
fn load<T: BorshDeserialize>(a: &AccountInfo, pid: &Pubkey, tag: u8) -> Result<T, ProgramError> {
    check(a.owner == pid && a.data_len() > 0 && a.try_borrow_data()?[0] == tag)?;
    T::deserialize(&mut &a.try_borrow_data()?[..]).map_err(|_| ProgramError::InvalidAccountData)
}
fn save<T: BorshSerialize>(a: &AccountInfo, v: &T) -> ProgramResult {
    let bytes = borsh::to_vec(v).map_err(|_| ProgramError::InvalidAccountData)?;
    check(bytes.len() <= a.data_len())?;
    a.try_borrow_mut_data()?[..bytes.len()].copy_from_slice(&bytes);
    Ok(())
}
fn pda(pid: &Pubkey, a: &AccountInfo, seeds: &[&[u8]]) -> Result<u8, ProgramError> {
    let (key, bump) = Pubkey::find_program_address(seeds, pid);
    check(*a.key == key)?;
    Ok(bump)
}
fn factory(a: &AccountInfo, pid: &Pubkey) -> Result<Factory, ProgramError> {
    pda(pid, a, &[b"factory"])?;
    load(a, pid, 10)
}
fn project(a: &AccountInfo, pid: &Pubkey) -> Result<Project, ProgramError> {
    let p: Project = load(a, pid, 2)?;
    pda(pid, a, &[b"project", p.mint.as_ref()])?;
    Ok(p)
}
fn governor(who: &AccountInfo, f: &Factory) -> ProgramResult {
    signed(who)?;
    check(*who.key == f.authority)
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
fn debit(from: &AccountInfo, to: &AccountInfo, amount: u64) -> ProgramResult {
    check(
        from.key != to.key
            && from.lamports()
                >= Rent::get()?
                    .minimum_balance(from.data_len())
                    .checked_add(amount)
                    .ok_or(ProgramError::ArithmeticOverflow)?,
    )?;
    **from.try_borrow_mut_lamports()? -= amount;
    **to.try_borrow_mut_lamports()? = to
        .lamports()
        .checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    Ok(())
}
fn tok<'a>(
    program: &AccountInfo<'a>,
    data: Vec<u8>,
    accounts: Vec<AccountMeta>,
    infos: &[AccountInfo<'a>],
    seeds: &[&[u8]],
) -> ProgramResult {
    check(*program.key == TOKEN)?;
    let mut all = infos.to_vec();
    all.push(program.clone());
    if seeds.is_empty() {
        invoke(
            &Instruction {
                program_id: TOKEN,
                accounts,
                data,
            },
            &all,
        )
    } else {
        invoke_signed(
            &Instruction {
                program_id: TOKEN,
                accounts,
                data,
            },
            &all,
            &[seeds],
        )
    }
}
fn token_account(a: &AccountInfo, mint: &Pubkey, owner: &Pubkey) -> ProgramResult {
    check(*a.owner == TOKEN && a.data_len() >= 165)?;
    let d = a.try_borrow_data()?;
    check(&d[0..32] == mint.as_ref() && &d[32..64] == owner.as_ref() && d[108] == 1)
}
fn amount_data(op: u8, amount: u64) -> Vec<u8> {
    let mut d = vec![op];
    d.extend_from_slice(&amount.to_le_bytes());
    d.push(6);
    d
}
fn transfer<'a>(
    program: &AccountInfo<'a>,
    from: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    amount: u64,
    seeds: &[&[u8]],
) -> ProgramResult {
    tok(
        program,
        amount_data(12, amount),
        vec![
            AccountMeta::new(*from.key, false),
            AccountMeta::new_readonly(*mint.key, false),
            AccountMeta::new(*to.key, false),
            AccountMeta::new_readonly(*authority.key, true),
        ],
        &[from.clone(), mint.clone(), to.clone(), authority.clone()],
        seeds,
    )
}
fn release(p: &mut Project, amount: u64, now: i64) -> ProgramResult {
    p.releases.retain(|r| r.at + WINDOW > now);
    let used = p
        .releases
        .iter()
        .try_fold(0u64, |n, r| n.checked_add(r.amount))
        .ok_or(ProgramError::ArithmeticOverflow)?;
    check(
        used.checked_add(amount)
            .ok_or(ProgramError::ArithmeticOverflow)?
            <= CAP,
    )?;
    if let Some(last) = p.releases.last_mut() {
        if last.at == now {
            last.amount += amount;
            return Ok(());
        }
    }
    check(p.releases.len() < 256)?;
    p.releases.push(Release { at: now, amount });
    Ok(())
}
fn reopen(
    p: &mut Project,
    m: &mut Milestone,
    ma: &Pubkey,
    now: i64,
    report: [u8; 32],
) -> ProgramResult {
    hash(&report)?;
    check(m.status == 1 || m.status == 2 || m.status == 3)?;
    if !m.community && !m.sol_reward && m.quote_day < 0 {
        p.dev_committed = p
            .dev_committed
            .checked_sub(m.amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        p.worker_committed = p
            .worker_committed
            .checked_add(m.amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;
    }
    p.awards.retain(|key| key != ma);
    m.failed_worker = m.worker;
    m.challenged = false;
    m.community = true;
    m.status = 1;
    m.ready_at = now + NOTICE;
    m.deadline = m.ready_at + WINDOW;
    m.worker = Pubkey::default();
    m.evidence = [0; 32];
    m.revision += 1;
    m.report = report;
    Ok(())
}
fn milestone(a: &AccountInfo, p: &AccountInfo, pid: &Pubkey) -> Result<Milestone, ProgramError> {
    let m: Milestone = load(a, pid, 3)?;
    check(m.project == *p.key)?;
    pda(pid, a, &[b"milestone", p.key.as_ref(), &m.id.to_le_bytes()])?;
    Ok(m)
}

pub fn process_instruction(pid: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let decoded = Action::try_from_slice(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    let now = Clock::get()?.unix_timestamp;
    let quote_day = match &decoded {
        Action::ProposeQuoteMilestone { day, .. } => *day,
        _ => -1,
    };
    let decoded = if let Action::ProposeQuoteMilestone {
        day: _,
        amount,
        deadline,
        terms,
        uri,
    } = decoded
    {
        check(quote_day >= 0)?;
        Action::ProposeMilestone {
            community: true,
            sol_reward: false,
            amount,
            deadline,
            terms,
            uri,
        }
    } else {
        decoded
    };
    let (action, enveloped) = if let Action::Governed { expires_at, action } = decoded {
        check(expires_at >= now && expires_at <= now + 7 * 86400 && action.len() <= 900)?;
        let inner =
            Action::try_from_slice(&action).map_err(|_| ProgramError::InvalidInstructionData)?;
        check(matches!(
            inner,
            Action::ApproveAdoption { .. }
                | Action::SelectAdopter { .. }
                | Action::RejectAdoption { .. }
                | Action::ReviewMilestone { .. }
                | Action::Award { .. }
                | Action::Reopen { .. }
                | Action::Resolve { .. }
                | Action::FundOss { .. }
                | Action::ApproveQuoteExpense { .. }
                | Action::CancelQuoteExpense { .. }
        ))?;
        (inner, true)
    } else {
        (decoded, false)
    };
    let venue_params = match &action {
        Action::LaunchVenue {
            sqrt_min,
            sqrt_max,
            liquidity,
            ..
        } => Some((*sqrt_min, *sqrt_max, *liquidity)),
        _ => None,
    };
    let action = if let Action::LaunchVenue {
        name,
        symbol,
        source,
        ..
    } = action
    {
        Action::Launch {
            name,
            symbol,
            source,
            virtual_quote: 0,
        }
    } else {
        action
    };
    let it = &mut accounts.iter();
    let who = next_account_info(it)?;
    signed(who)?;
    let fa = next_account_info(it)?;
    if let Action::Initialize {
        authority,
        quote_mint,
        test_mode,
        governance_multisig,
    } = action
    {
        let sys = next_account_info(it)?;
        let programdata = next_account_info(it)?;
        // Only the deployed program's upgrade authority may initialize its singleton factory.
        let expected =
            Pubkey::find_program_address(&[pid.as_ref()], &bpf_loader_upgradeable::id()).0;
        check(*programdata.key == expected && *programdata.owner == bpf_loader_upgradeable::id())?;
        let d = programdata.try_borrow_data()?;
        check(
            d.len() >= 45 && d[..4] == [3, 0, 0, 0] && d[12] == 1 && &d[13..45] == who.key.as_ref(),
        )?;
        drop(d);
        check(
            test_mode
                && quote_mint != REAL_EACC
                && quote_mint != Pubkey::default()
                && authority != Pubkey::default(),
        )?;
        if governance_multisig == Pubkey::default() {
            check(cfg!(feature = "venue-candidate") || cfg!(feature = "test-fixtures"))?;
        } else {
            let multisig = next_account_info(it)?;
            check(*multisig.key == governance_multisig)?;
            governance::validate(multisig, &authority)?;
        }
        let bump = pda(pid, fa, &[b"factory"])?;
        create(who, fa, sys, pid, FACTORY_SIZE, &[b"factory", &[bump]])?;
        return save(
            fa,
            &Factory {
                tag: 10,
                authority,
                quote_mint,
                test_mode,
                count: 0,
                fees: 0,
                retired_budget: 0,
                oss_budget: 0,
                governance_budget: 0,
                foundation_budget: 0,
                governance_multisig,
                expense_committed: 0,
                expense_next_at: 0,
            },
        );
    }
    let mut f = factory(fa, pid)?;
    let mut governance_members = Vec::new();
    if f.governance_multisig != Pubkey::default()
        && (*who.key == f.authority || matches!(action, Action::SubmitWork { .. } | Action::Pay))
    {
        let multisig = accounts.last().ok_or(ProgramError::NotEnoughAccountKeys)?;
        check(*multisig.key == f.governance_multisig)?;
        governance_members = governance::validate(multisig, &f.authority)?;
        if *who.key == f.authority {
            check(enveloped)?;
        }
    }
    if matches!(action, Action::Launch { .. } | Action::Swap { .. }) {
        check(if venue_params.is_some() {
            cfg!(feature = "venue-adapter") && f.test_mode
        } else {
            cfg!(feature = "test-fixtures")
        })?;
    }
    if matches!(
        action,
        Action::FundOss { .. }
            | Action::BuyBurn { .. }
            | Action::ApproveExpense { .. }
            | Action::ClaimExpense
            | Action::ClaimFoundation
    ) {
        // Permanently retired legacy SOL-fee and buy/burn opcodes. Never reinterpret old transactions.
        return Err(ProgramError::InvalidInstructionData);
    }
    let pa = next_account_info(it)?;
    if let Action::RegisterFund { name, source } = action {
        check(
            !name.is_empty()
                && name.len() <= 64
                && source.starts_with("https://github.com/")
                && source.len() <= 512,
        )?;
        let key = Pubkey::new_from_array(solana_program::hash::hash(source.as_bytes()).to_bytes());
        let bump = pda(pid, pa, &[b"project", key.as_ref()])?;
        let sys = next_account_info(it)?;
        create(
            who,
            pa,
            sys,
            pid,
            PROJECT_SIZE,
            &[b"project", key.as_ref(), &[bump]],
        )?;
        let p = Project {
            tag: 2,
            mint: key,
            owner: Pubkey::default(),
            adopted: false,
            adoption_at: 0,
            adoption_nonce: 0,
            adoption_hash: [0; 32],
            adoption_challenged: false,
            virtual_quote: 0,
            token_reserve: 0,
            quote_reserve: 0,
            dev_released: 0,
            worker_released: 0,
            dev_committed: 0,
            worker_committed: 0,
            milestone_count: 0,
            tokenless: true,
            sol_available: 0,
            sol_committed: 0,
            refundable: 0,
            sol_funded: 0,
            awards: vec![],
            releases: vec![],
            name,
            symbol: String::new(),
            source,
        };
        return save(pa, &p);
    }
    if let Action::Launch {
        name,
        symbol,
        source,
        virtual_quote,
    } = action
    {
        check(
            !name.is_empty()
                && name.len() <= 64
                && !symbol.is_empty()
                && symbol.len() <= 12
                && symbol.bytes().all(|b| b.is_ascii_uppercase())
                && source.starts_with("https://")
                && source.len() <= 512
                && (venue_params.is_some()
                    || (virtual_quote >= 1_000_000_000
                        && virtual_quote <= 1_000_000_000_000_000_000)),
        )?;
        let mint = next_account_info(it)?;
        let pool = next_account_info(it)?;
        let reserve = next_account_info(it)?;
        let sys = next_account_info(it)?;
        let tp = next_account_info(it)?;
        let quote_mint = next_account_info(it)?;
        let quote_pool = next_account_info(it)?;
        fees::validate_mint(quote_mint, &f)?;
        let mint_bump = pda(
            pid,
            mint,
            &[b"mint", who.key.as_ref(), &f.count.to_le_bytes()],
        )?;
        let pb = pda(pid, pa, &[b"project", mint.key.as_ref()])?;
        let ps: &[&[u8]] = &[b"project", mint.key.as_ref(), &[pb]];
        create(who, pa, sys, pid, PROJECT_SIZE, ps)?;
        create(
            who,
            mint,
            sys,
            &TOKEN,
            82,
            &[
                b"mint",
                who.key.as_ref(),
                &f.count.to_le_bytes(),
                &[mint_bump],
            ],
        )?;
        let mut init = vec![20, 6];
        init.extend_from_slice(pa.key.as_ref());
        init.push(0);
        tok(
            tp,
            init,
            vec![AccountMeta::new(*mint.key, false)],
            &[mint.clone()],
            &[],
        )?;
        for (a, seed) in [(pool, b"pool".as_slice()), (reserve, b"reserve".as_slice())] {
            let bump = pda(pid, a, &[seed, pa.key.as_ref()])?;
            create(who, a, sys, &TOKEN, 165, &[seed, pa.key.as_ref(), &[bump]])?;
            let mut d = vec![18];
            d.extend_from_slice(pa.key.as_ref());
            tok(
                tp,
                d,
                vec![
                    AccountMeta::new(*a.key, false),
                    AccountMeta::new_readonly(*mint.key, false),
                ],
                &[a.clone(), mint.clone()],
                &[],
            )?;
        }
        tok(
            tp,
            amount_data(14, SUPPLY),
            vec![
                AccountMeta::new(*mint.key, false),
                AccountMeta::new(*reserve.key, false),
                AccountMeta::new_readonly(*pa.key, true),
            ],
            &[mint.clone(), reserve.clone(), pa.clone()],
            ps,
        )?;
        transfer(tp, reserve, mint, pool, pa, LIQUIDITY, ps)?;
        tok(
            tp,
            vec![6, 0, 0],
            vec![
                AccountMeta::new(*mint.key, false),
                AccountMeta::new_readonly(*pa.key, true),
            ],
            &[mint.clone(), pa.clone()],
            ps,
        )?;
        fees::create_token_vault(pid, who, quote_pool, quote_mint, pa, sys, tp, b"quote-pool")?;
        if let Some((min, max, liquidity)) = venue_params {
            venue::initialize(
                pid, who, pa, mint, pool, quote_mint, quote_pool, sys, tp, it, min, max, liquidity,
                ps,
            )?;
            check(fees::token_balance(reserve)? == RESERVE && fees::token_balance(pool)? == 0)?;
        }
        let p = Project {
            tag: 2,
            mint: *mint.key,
            owner: Pubkey::default(),
            adopted: false,
            adoption_at: 0,
            adoption_nonce: 0,
            adoption_hash: [0; 32],
            adoption_challenged: false,
            virtual_quote,
            token_reserve: if venue_params.is_some() { 0 } else { LIQUIDITY },
            quote_reserve: 0,
            dev_released: 0,
            worker_released: 0,
            dev_committed: 0,
            worker_committed: 0,
            milestone_count: 0,
            tokenless: false,
            sol_available: 0,
            sol_committed: 0,
            refundable: 0,
            sol_funded: 0,
            awards: vec![],
            releases: vec![],
            name,
            symbol,
            source,
        };
        f.count = f
            .count
            .checked_add(1)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        save(fa, &f)?;
        return save(pa, &p);
    }
    let mut p = project(pa, pid)?;
    let pb = pda(pid, pa, &[b"project", p.mint.as_ref()])?;
    let mint_key = p.mint;
    let ps: &[&[u8]] = &[b"project", mint_key.as_ref(), &[pb]];
    if matches!(action, Action::CollectVenue) {
        return venue::collect(pid, pa, &p, &f, it, now, ps);
    }
    if fees::process(pid, who, pa, &p, &f, &action, it, now)? {
        return Ok(());
    }
    match action {
        Action::RequestAdoption { terms } => {
            hash(&terms)?;
            check(!p.adopted && p.owner == Pubkey::default() && p.adoption_at == 0)?;
            // Claimants cannot keep changing the epoch to invalidate queued votes.
            // Rejection advances it; a request merely fills the vacant claim slot.
            if p.adoption_nonce == 0 {
                p.adoption_nonce = 1;
            }
            p.owner = *who.key;
            p.adoption_hash = terms;
            p.adoption_at = 0;
            p.adoption_challenged = false;
        }
        Action::ApproveAdoption {
            nonce,
            owner,
            terms,
            report,
        } => {
            governor(who, &f)?;
            hash(&report)?;
            check(
                !p.adopted
                    && p.adoption_nonce == nonce
                    && p.owner == owner
                    && owner != Pubkey::default()
                    && p.adoption_hash == terms,
            )?;
            p.adoption_at = now + NOTICE;
        }
        Action::SubmitAdoptionCandidate { terms } => {
            hash(&terms)?;
            check(!p.adopted)?;
            let candidate = next_account_info(it)?;
            let sys = next_account_info(it)?;
            let bump = pda(
                pid,
                candidate,
                &[b"adopter", pa.key.as_ref(), who.key.as_ref(), &terms],
            )?;
            create(
                who,
                candidate,
                sys,
                pid,
                128,
                &[
                    b"adopter",
                    pa.key.as_ref(),
                    who.key.as_ref(),
                    &terms,
                    &[bump],
                ],
            )?;
            // Immutable, candidate-specific acceptance. Other claimants cannot replace it.
            return save(
                candidate,
                &AdoptionCandidate {
                    tag: 11,
                    project: *pa.key,
                    owner: *who.key,
                    terms,
                },
            );
        }
        Action::SelectAdopter {
            nonce,
            owner,
            terms,
            report,
        } => {
            governor(who, &f)?;
            hash(&report)?;
            hash(&terms)?;
            check(
                !p.adopted
                    && p.adoption_at == 0
                    && !p.adoption_challenged
                    && p.adoption_nonce == nonce
                    && owner != Pubkey::default(),
            )?;
            let candidate = next_account_info(it)?;
            pda(
                pid,
                candidate,
                &[b"adopter", pa.key.as_ref(), owner.as_ref(), &terms],
            )?;
            let accepted: AdoptionCandidate = load(candidate, pid, 11)?;
            check(
                accepted.project == *pa.key && accepted.owner == owner && accepted.terms == terms,
            )?;
            p.owner = owner;
            p.adoption_hash = terms;
            p.adoption_at = now
                .checked_add(NOTICE)
                .ok_or(ProgramError::ArithmeticOverflow)?;
        }
        Action::FinalizeAdoption => {
            check(!p.adopted && p.adoption_at > 0 && now >= p.adoption_at)?;
            if p.tokenless {
                p.adopted = true;
                return save(pa, &p);
            }
            let mint = next_account_info(it)?;
            let reserve = next_account_info(it)?;
            let recipient = next_account_info(it)?;
            let tp = next_account_info(it)?;
            check(*mint.key == p.mint)?;
            pda(pid, reserve, &[b"reserve", pa.key.as_ref()])?;
            token_account(recipient, &p.mint, &p.owner)?;
            release(&mut p, CAP, now)?;
            p.adopted = true;
            p.dev_released = CAP;
            transfer(tp, reserve, mint, recipient, pa, CAP, ps)?;
        }
        Action::Swap {
            buy,
            amount,
            min_out,
            deadline,
        } => {
            check(!p.tokenless && amount > 0 && min_out > 0 && now <= deadline)?;
            let mint = next_account_info(it)?;
            let pool = next_account_info(it)?;
            let user = next_account_info(it)?;
            let sys = next_account_info(it)?;
            let tp = next_account_info(it)?;
            check(*mint.key == p.mint && *sys.key == system_program::id())?;
            pda(pid, pool, &[b"pool", pa.key.as_ref()])?;
            token_account(user, &p.mint, who.key)?;
            token_account(pool, &p.mint, pa.key)?;
            let quote_mint = next_account_info(it)?;
            let quote_pool = next_account_info(it)?;
            let user_quote = next_account_info(it)?;
            let day_account = next_account_info(it)?;
            let fee_vault = next_account_info(it)?;
            fees::validate_mint(quote_mint, &f)?;
            pda(pid, quote_pool, &[b"quote-pool", pa.key.as_ref()])?;
            token_account(quote_pool, &f.quote_mint, pa.key)?;
            token_account(user_quote, &f.quote_mint, who.key)?;
            let mut daily = fees::daily(pid, day_account, pa.key, now.div_euclid(86400))?;
            check(!daily.settled)?;
            fees::vault(pid, fee_vault, day_account, &f)?;
            let before = (p.token_reserve as u128)
                .checked_mul(p.virtual_quote as u128 + p.quote_reserve as u128)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            let fee;
            let out;
            if buy {
                fee = amount.div_ceil(20);
                let net = amount - fee;
                out = ((p.token_reserve as u128) * (net as u128)
                    / ((p.virtual_quote as u128) + (p.quote_reserve as u128) + (net as u128)))
                    as u64;
                check(out > 0 && out >= min_out)?;
                transfer(tp, user_quote, quote_mint, quote_pool, who, net, &[])?;
                transfer(tp, user_quote, quote_mint, fee_vault, who, fee, &[])?;
                p.quote_reserve = p
                    .quote_reserve
                    .checked_add(net)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
                p.token_reserve -= out;
                transfer(tp, pool, mint, user, pa, out, ps)?;
            } else {
                let gross = (((p.virtual_quote as u128) + (p.quote_reserve as u128))
                    * (amount as u128)
                    / ((p.token_reserve as u128) + (amount as u128)))
                    as u64;
                check(gross <= p.quote_reserve)?;
                fee = gross.div_ceil(20);
                out = gross - fee;
                check(out > 0 && out >= min_out)?;
                transfer(tp, user, mint, pool, who, amount, &[])?;
                p.token_reserve = p
                    .token_reserve
                    .checked_add(amount)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
                p.quote_reserve -= gross;
                transfer(tp, quote_pool, quote_mint, user_quote, pa, out, ps)?;
                transfer(tp, quote_pool, quote_mint, fee_vault, pa, fee, ps)?;
            }
            let after = (p.token_reserve as u128)
                .checked_mul(p.virtual_quote as u128 + p.quote_reserve as u128)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            check(after >= before)?;
            fees::allocate(&mut daily, fee)?;
            save(day_account, &daily)?;
            check(fees::token_balance(quote_pool)? >= p.quote_reserve)?;
        }
        Action::ProposeMilestone {
            community,
            sol_reward,
            amount,
            deadline,
            terms,
            uri,
        } => {
            check(
                p.adopted
                    && p.owner == *who.key
                    && amount > 0
                    && (if sol_reward {
                        amount <= 1_000_000_000
                    } else {
                        amount <= CAP
                    })
                    && (!p.tokenless || sol_reward)
                    && deadline > now + NOTICE
                    && uri.starts_with("https://")
                    && uri.len() <= 512,
            )?;
            hash(&terms)?;
            let ma = next_account_info(it)?;
            let sys = next_account_info(it)?;
            let id = p.milestone_count + 1;
            let bump = pda(pid, ma, &[b"milestone", pa.key.as_ref(), &id.to_le_bytes()])?;
            create(
                who,
                ma,
                sys,
                pid,
                MILESTONE_SIZE,
                &[b"milestone", pa.key.as_ref(), &id.to_le_bytes(), &[bump]],
            )?;
            save(
                ma,
                &Milestone {
                    tag: 3,
                    project: *pa.key,
                    id,
                    community,
                    amount,
                    deadline,
                    terms,
                    uri,
                    status: 0,
                    ready_at: 0,
                    worker: Pubkey::default(),
                    evidence: [0; 32],
                    revision: 0,
                    report: [0; 32],
                    award_order: 0,
                    sol_reward,
                    quote_day,
                    challenged: false,
                    failed_worker: Pubkey::default(),
                },
            )?;
            p.milestone_count = id;
        }
        Action::ReviewMilestone {
            approve,
            terms,
            report,
        } => {
            governor(who, &f)?;
            hash(&report)?;
            let ma = next_account_info(it)?;
            let mut m = milestone(ma, pa, pid)?;
            check(m.status == 0 && m.terms == terms)?;
            if approve {
                check(m.deadline > now + NOTICE)?;
                if m.quote_day >= 0 {
                    let da = next_account_info(it)?;
                    let mut d = fees::daily(pid, da, pa.key, m.quote_day)?;
                    check(m.community && m.amount <= d.community)?;
                    d.community -= m.amount;
                    d.community_committed = d
                        .community_committed
                        .checked_add(m.amount)
                        .ok_or(ProgramError::ArithmeticOverflow)?;
                    save(da, &d)?;
                } else if m.sol_reward {
                    check(m.amount <= p.sol_available)?;
                    p.sol_available -= m.amount;
                    p.sol_committed += m.amount;
                } else {
                    check(
                        p.dev_released
                            + p.worker_released
                            + p.dev_committed
                            + p.worker_committed
                            + m.amount
                            <= RESERVE,
                    )?;
                    if m.community {
                        p.worker_committed += m.amount;
                    } else {
                        check(p.dev_released + p.dev_committed + m.amount <= DEV_CAP)?;
                        p.dev_committed += m.amount;
                    }
                }
                m.status = 1;
                m.ready_at = now + NOTICE;
            } else {
                m.status = 5;
            }
            m.report = report;
            save(ma, &m)?;
        }
        Action::SubmitWork { evidence } => {
            hash(&evidence)?;
            let ma = next_account_info(it)?;
            let m = milestone(ma, pa, pid)?;
            check(m.status == 1 && now >= m.ready_at && now <= m.deadline)?;
            check(*who.key != m.failed_worker)?;
            check(if m.community {
                *who.key != p.owner
                    && *who.key != f.authority
                    && *who.key != governance::FOUNDATION
                    && !governance_members.contains(who.key)
            } else {
                *who.key == p.owner
            })?;
            let sa = next_account_info(it)?;
            let sys = next_account_info(it)?;
            let rev = m.revision.to_le_bytes();
            let bump = pda(pid, sa, &[b"work", ma.key.as_ref(), who.key.as_ref(), &rev])?;
            if sa.owner == &system_program::id() && sa.data_is_empty() {
                create(
                    who,
                    sa,
                    sys,
                    pid,
                    SUBMISSION_SIZE,
                    &[b"work", ma.key.as_ref(), who.key.as_ref(), &rev, &[bump]],
                )?;
            } else {
                let old: Submission = load(sa, pid, 4)?;
                check(
                    old.worker == *who.key
                        && old.milestone == *ma.key
                        && old.revision == m.revision,
                )?;
            }
            save(
                sa,
                &Submission {
                    tag: 4,
                    milestone: *ma.key,
                    worker: *who.key,
                    revision: m.revision,
                    evidence,
                },
            )?;
        }
        Action::Award {
            revision,
            evidence,
            report,
        } => {
            governor(who, &f)?;
            hash(&report)?;
            let ma = next_account_info(it)?;
            let mut m = milestone(ma, pa, pid)?;
            let sa = next_account_info(it)?;
            let s: Submission = load(sa, pid, 4)?;
            if m.community {
                check(!governance_members.contains(&s.worker))?;
            }
            check(
                m.status == 1
                    && m.revision == revision
                    && s.revision == revision
                    && s.milestone == *ma.key
                    && s.evidence == evidence,
            )?;
            pda(
                pid,
                sa,
                &[
                    b"work",
                    ma.key.as_ref(),
                    s.worker.as_ref(),
                    &revision.to_le_bytes(),
                ],
            )?;
            check(if m.community {
                s.worker != p.owner && s.worker != f.authority
            } else {
                s.worker == p.owner
            })?;
            if m.community && !m.sol_reward && m.quote_day < 0 {
                check(p.awards.len() < 64)?;
                p.awards.push(*ma.key);
            }
            m.challenged = false;
            m.status = 2;
            m.ready_at = now + NOTICE;
            m.worker = s.worker;
            m.evidence = evidence;
            m.report = report;
            save(ma, &m)?;
        }
        Action::Reopen { revision, report } => {
            governor(who, &f)?;
            let ma = next_account_info(it)?;
            let mut m = milestone(ma, pa, pid)?;
            check(m.status != 3 && m.revision == revision)?;
            reopen(&mut p, &mut m, ma.key, now, report)?;
            save(ma, &m)?;
        }
        Action::Challenge { reason } => {
            hash(&reason)?;
            // Adoption challenge: pass the project itself as the subject, reopening identity review.
            let ma = next_account_info(it)?;
            if ma.key == pa.key {
                check(!p.adopted && !p.adoption_challenged && p.adoption_at > now)?;
                p.adoption_at = 0;
                p.adoption_challenged = true;
            } else {
                let mut m = milestone(ma, pa, pid)?;
                check(!m.challenged && (m.status == 1 || m.status == 2) && now < m.ready_at)?;
                m.challenged = true;
                m.award_order = m.status as u64;
                m.status = 3;
                m.report = reason;
                save(ma, &m)?;
            }
        }
        Action::Resolve {
            revision,
            uphold,
            report,
        } => {
            governor(who, &f)?;
            hash(&report)?;
            let ma = next_account_info(it)?;
            let mut m = milestone(ma, pa, pid)?;
            check(m.status == 3 && m.revision == revision)?;
            if uphold {
                m.status = m.award_order as u8;
                m.ready_at = now + NOTICE;
                m.report = report;
            } else {
                reopen(&mut p, &mut m, ma.key, now, report)?;
            }
            save(ma, &m)?;
        }
        Action::Pay => {
            let ma = next_account_info(it)?;
            let mut m = milestone(ma, pa, pid)?;
            check(m.status == 2 && now >= m.ready_at)?;
            if m.community {
                check(!governance_members.contains(&m.worker))?;
            }
            if m.quote_day >= 0 {
                let da = next_account_info(it)?;
                let vault = next_account_info(it)?;
                let mint = next_account_info(it)?;
                let recipient = next_account_info(it)?;
                let tp = next_account_info(it)?;
                let mut d = fees::daily(pid, da, pa.key, m.quote_day)?;
                check(m.community)?;
                d.community_committed = d
                    .community_committed
                    .checked_sub(m.amount)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
                fees::pay(
                    pid, da, vault, mint, recipient, tp, &f, &d, &m.worker, m.amount,
                )?;
                m.status = 4;
                save(da, &d)?;
                return save(ma, &m);
            }
            if m.sol_reward {
                let recipient = next_account_info(it)?;
                check(*recipient.key == m.worker)?;
                p.sol_committed -= m.amount;
                m.status = 4;
                debit(pa, recipient, m.amount)?;
                save(ma, &m)?;
                return save(pa, &p);
            }
            if m.community {
                check(p.awards.first() == Some(ma.key))?;
                p.awards.remove(0);
            } else {
                check(p.awards.is_empty())?;
            }
            let mint = next_account_info(it)?;
            let reserve = next_account_info(it)?;
            let recipient = next_account_info(it)?;
            let tp = next_account_info(it)?;
            check(*mint.key == p.mint)?;
            pda(pid, reserve, &[b"reserve", pa.key.as_ref()])?;
            token_account(recipient, &p.mint, &m.worker)?;
            release(&mut p, m.amount, now)?;
            if m.community {
                p.worker_committed -= m.amount;
                p.worker_released += m.amount;
            } else {
                check(p.dev_released + m.amount <= DEV_CAP)?;
                p.dev_committed -= m.amount;
                p.dev_released += m.amount;
            }
            check(p.dev_released + p.worker_released <= RESERVE)?;
            m.status = 4;
            transfer(tp, reserve, mint, recipient, pa, m.amount, ps)?;
            save(ma, &m)?;
        }
        Action::Sponsor { amount, nonce } => {
            check(
                p.adopted
                    && amount > 0
                    && p.sol_funded
                        .checked_add(amount)
                        .is_some_and(|n| n <= 10_000_000_000),
            )?;
            p.sol_funded += amount;
            let receipt = next_account_info(it)?;
            let sys = next_account_info(it)?;
            let bump = pda(
                pid,
                receipt,
                &[
                    b"sponsor",
                    pa.key.as_ref(),
                    who.key.as_ref(),
                    &nonce.to_le_bytes(),
                ],
            )?;
            create(
                who,
                receipt,
                sys,
                pid,
                160,
                &[
                    b"sponsor",
                    pa.key.as_ref(),
                    who.key.as_ref(),
                    &nonce.to_le_bytes(),
                    &[bump],
                ],
            )?;
            invoke(
                &system_instruction::transfer(who.key, pa.key, amount),
                &[who.clone(), pa.clone(), sys.clone()],
            )?;
            p.refundable = p
                .refundable
                .checked_add(amount)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            save(
                receipt,
                &Sponsorship {
                    tag: 5,
                    project: *pa.key,
                    sponsor: *who.key,
                    nonce,
                    amount,
                    until: now + 86400,
                    settled: false,
                },
            )?;
        }
        Action::SettleSponsorship { refund } => {
            let receipt = next_account_info(it)?;
            let mut r: Sponsorship = load(receipt, pid, 5)?;
            check(r.project == *pa.key && !r.settled)?;
            pda(
                pid,
                receipt,
                &[
                    b"sponsor",
                    pa.key.as_ref(),
                    r.sponsor.as_ref(),
                    &r.nonce.to_le_bytes(),
                ],
            )?;
            if refund {
                check(*who.key == r.sponsor && now < r.until)?;
                debit(pa, who, r.amount)?;
                p.sol_funded -= r.amount;
            } else {
                check(now >= r.until)?;
                p.sol_available = p
                    .sol_available
                    .checked_add(r.amount)
                    .ok_or(ProgramError::ArithmeticOverflow)?;
            }
            p.refundable -= r.amount;
            r.settled = true;
            save(receipt, &r)?;
        }
        Action::RejectAdoption { report } => {
            governor(who, &f)?;
            hash(&report)?;
            check(!p.adopted)?;
            p.adoption_nonce = p
                .adoption_nonce
                .checked_add(1)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            p.adoption_challenged = false;
            p.owner = Pubkey::default();
            p.adoption_at = 0;
            p.adoption_hash = [0; 32];
        }
        _ => return Err(ProgramError::InvalidInstructionData),
    }
    check(
        (pa.lamports() as u128)
            >= (Rent::get()?.minimum_balance(pa.data_len()) as u128)
                + (p.sol_available as u128)
                + (p.sol_committed as u128)
                + (p.refundable as u128),
    )?;
    save(pa, &p)
}
