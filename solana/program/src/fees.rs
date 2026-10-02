//! Project-local quote-token custody. Days are UTC and settlement is permissionless.
use crate::*;
const DAY: i64 = 86400;
const MAX_DAILY_EXPENSE: u64 = 100_000_000; // Test pilot: 100 dummy quote tokens, not SOL.
#[derive(BorshSerialize, BorshDeserialize)]
pub struct FeeDay {
    pub tag: u8,
    pub project: Pubkey,
    pub day: i64,
    pub fees: u64,
    pub development: u64,
    pub community: u64,
    pub community_committed: u64,
    pub governance: u64,
    pub expense_committed: u64,
    pub expense_approved: u64,
    pub foundation: u64,
    pub settled: bool,
}
#[derive(BorshSerialize, BorshDeserialize)]
pub struct Expense {
    pub tag: u8,
    pub fee_day: Pubkey,
    pub invoice: [u8; 32],
    pub report: [u8; 32],
    pub amount: u64,
    pub ready_at: i64,
    pub status: u8, // 0 committed, 1 paid, 2 canceled
}
pub fn validate_mint(mint: &AccountInfo, f: &Factory) -> ProgramResult {
    check(*mint.key == f.quote_mint && *mint.owner == TOKEN && mint.data_len() == 82)?;
    let d = mint.try_borrow_data()?;
    // Unsupported extensions fail closed until explicitly reviewed. No mint/freeze authorities.
    check(d[..4] == [0; 4] && d[44] == 6 && d[45] == 1 && d[46..50] == [0; 4])
}
pub fn token_balance(a: &AccountInfo) -> Result<u64, ProgramError> {
    check(*a.owner == TOKEN && a.data_len() == 165)?;
    Ok(u64::from_le_bytes(
        a.try_borrow_data()?[64..72].try_into().unwrap(),
    ))
}
pub fn create_token_vault<'a>(
    pid: &Pubkey,
    payer: &AccountInfo<'a>,
    vault: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    owner: &AccountInfo<'a>,
    sys: &AccountInfo<'a>,
    tp: &AccountInfo<'a>,
    seed: &[u8],
) -> ProgramResult {
    let bump = pda(pid, vault, &[seed, owner.key.as_ref()])?;
    create(
        payer,
        vault,
        sys,
        &TOKEN,
        165,
        &[seed, owner.key.as_ref(), &[bump]],
    )?;
    let mut data = vec![18];
    data.extend_from_slice(owner.key.as_ref());
    tok(
        tp,
        data,
        vec![
            AccountMeta::new(*vault.key, false),
            AccountMeta::new_readonly(*mint.key, false),
        ],
        &[vault.clone(), mint.clone()],
        &[],
    )
}
pub fn daily(
    pid: &Pubkey,
    a: &AccountInfo,
    project: &Pubkey,
    day: i64,
) -> Result<FeeDay, ProgramError> {
    let d: FeeDay = load(a, pid, 8)?;
    check(day >= 0 && d.project == *project && d.day == day)?;
    pda(pid, a, &[b"fee-day", project.as_ref(), &day.to_le_bytes()])?;
    Ok(d)
}
pub fn vault(pid: &Pubkey, a: &AccountInfo, da: &AccountInfo, f: &Factory) -> ProgramResult {
    pda(pid, a, &[b"fee-vault", da.key.as_ref()])?;
    token_account(a, &f.quote_mint, da.key)?;
    check(a.data_len() == 165)
}
pub fn allocate(d: &mut FeeDay, fee: u64) -> ProgramResult {
    let next = d
        .fees
        .checked_add(fee)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    for (budget, weight) in [
        (&mut d.development, 60u128),
        (&mut d.community, 10),
        (&mut d.governance, 27),
        (&mut d.foundation, 3),
    ] {
        let increment = (next as u128 * weight / 100) - (d.fees as u128 * weight / 100);
        *budget = budget
            .checked_add(increment as u64)
            .ok_or(ProgramError::ArithmeticOverflow)?;
    }
    d.fees = next;
    Ok(())
}
pub fn pay<'a>(
    pid: &Pubkey,
    da: &AccountInfo<'a>,
    va: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    recipient: &AccountInfo<'a>,
    tp: &AccountInfo<'a>,
    f: &Factory,
    d: &FeeDay,
    owner: &Pubkey,
    amount: u64,
) -> ProgramResult {
    check(amount > 0)?;
    validate_mint(mint, f)?;
    vault(pid, va, da, f)?;
    token_account(recipient, &f.quote_mint, owner)?;
    check(va.key != recipient.key)?;
    let bump = pda(
        pid,
        da,
        &[b"fee-day", d.project.as_ref(), &d.day.to_le_bytes()],
    )?;
    transfer(
        tp,
        va,
        mint,
        recipient,
        da,
        amount,
        &[
            b"fee-day",
            d.project.as_ref(),
            &d.day.to_le_bytes(),
            &[bump],
        ],
    )
}
pub fn process<'a, 'b>(
    pid: &Pubkey,
    who: &AccountInfo<'a>,
    pa: &AccountInfo<'a>,
    p: &Project,
    f: &Factory,
    action: &Action,
    it: &mut std::slice::Iter<'b, AccountInfo<'a>>,
    now: i64,
) -> Result<bool, ProgramError> {
    let day = match action {
        Action::InitializeFeeDay { day }
        | Action::SettleFeeDay { day }
        | Action::ClaimDevelopment { day }
        | Action::ClaimQuoteFoundation { day }
        | Action::ApproveQuoteExpense { day, .. }
        | Action::ClaimQuoteExpense { day }
        | Action::CancelQuoteExpense { day } => *day,
        _ => return Ok(false),
    };
    check(day >= 0 && !p.tokenless)?;
    let da = next_account_info(it)?;
    if matches!(action, Action::InitializeFeeDay { .. }) {
        check(day == now.div_euclid(DAY))?;
        let va = next_account_info(it)?;
        let mint = next_account_info(it)?;
        let sys = next_account_info(it)?;
        let tp = next_account_info(it)?;
        validate_mint(mint, f)?;
        let bump = pda(pid, da, &[b"fee-day", pa.key.as_ref(), &day.to_le_bytes()])?;
        create(
            who,
            da,
            sys,
            pid,
            192,
            &[b"fee-day", pa.key.as_ref(), &day.to_le_bytes(), &[bump]],
        )?;
        create_token_vault(pid, who, va, mint, da, sys, tp, b"fee-vault")?;
        save(
            da,
            &FeeDay {
                tag: 8,
                project: *pa.key,
                day,
                fees: 0,
                development: 0,
                community: 0,
                community_committed: 0,
                governance: 0,
                expense_committed: 0,
                expense_approved: 0,
                foundation: 0,
                settled: false,
            },
        )?;
        return Ok(true);
    }
    let mut d = daily(pid, da, pa.key, day)?;
    match action {
        Action::SettleFeeDay { .. } => {
            check(!d.settled && day < now.div_euclid(DAY))?;
            let allocated: u128 = [60u128, 10, 27, 3]
                .iter()
                .map(|w| d.fees as u128 * w / 100)
                .sum();
            let dust = d.fees - (allocated as u64);
            let surplus = d
                .governance
                .checked_add(dust)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            d.development = d
                .development
                .checked_add(surplus)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            d.governance = 0;
            d.settled = true;
        }
        Action::ClaimDevelopment { .. } | Action::ClaimQuoteFoundation { .. } => {
            let dev = matches!(action, Action::ClaimDevelopment { .. });
            check(!dev || p.adopted)?;
            let va = next_account_info(it)?;
            let mint = next_account_info(it)?;
            let recipient = next_account_info(it)?;
            let tp = next_account_info(it)?;
            let (owner, amount) = if dev {
                (p.owner, d.development)
            } else {
                (governance::FOUNDATION, d.foundation)
            };
            if dev {
                d.development = 0
            } else {
                d.foundation = 0
            };
            pay(pid, da, va, mint, recipient, tp, f, &d, &owner, amount)?;
        }
        Action::ApproveQuoteExpense {
            amount,
            invoice,
            report,
            ..
        } => {
            governor(who, f)?;
            hash(invoice)?;
            hash(report)?;
            check(
                !d.settled && day == now.div_euclid(DAY) && *amount > 0 && *amount <= d.governance,
            )?;
            d.expense_approved = d
                .expense_approved
                .checked_add(*amount)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            check(d.expense_approved <= MAX_DAILY_EXPENSE)?;
            let receipt = next_account_info(it)?;
            let sys = next_account_info(it)?;
            // Global invoice identity prevents charging one invoice to multiple projects.
            let bump = pda(pid, receipt, &[b"quote-expense", invoice])?;
            create(
                who,
                receipt,
                sys,
                pid,
                160,
                &[b"quote-expense", invoice, &[bump]],
            )?;
            d.governance -= amount;
            d.expense_committed = d
                .expense_committed
                .checked_add(*amount)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            save(
                receipt,
                &Expense {
                    tag: 9,
                    fee_day: *da.key,
                    invoice: *invoice,
                    report: *report,
                    amount: *amount,
                    ready_at: now + NOTICE,
                    status: 0,
                },
            )?;
        }
        Action::ClaimQuoteExpense { .. } | Action::CancelQuoteExpense { .. } => {
            let receipt = next_account_info(it)?;
            let mut e: Expense = load(receipt, pid, 9)?;
            pda(pid, receipt, &[b"quote-expense", &e.invoice])?;
            check(e.status == 0 && e.fee_day == *da.key)?;
            d.expense_committed = d
                .expense_committed
                .checked_sub(e.amount)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            if matches!(action, Action::CancelQuoteExpense { .. }) {
                governor(who, f)?;
                if d.settled {
                    d.development = d
                        .development
                        .checked_add(e.amount)
                        .ok_or(ProgramError::ArithmeticOverflow)?
                } else {
                    d.governance = d
                        .governance
                        .checked_add(e.amount)
                        .ok_or(ProgramError::ArithmeticOverflow)?
                };
                e.status = 2;
            } else {
                check(now >= e.ready_at)?;
                let va = next_account_info(it)?;
                let mint = next_account_info(it)?;
                let recipient = next_account_info(it)?;
                let tp = next_account_info(it)?;
                pay(
                    pid,
                    da,
                    va,
                    mint,
                    recipient,
                    tp,
                    f,
                    &d,
                    &f.authority,
                    e.amount,
                )?;
                e.status = 1;
            }
            save(receipt, &e)?;
        }
        _ => return Err(ProgramError::InvalidInstructionData),
    }
    save(da, &d)?;
    Ok(true)
}
