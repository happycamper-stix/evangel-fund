//! Experimental, test-mode-only DAMM adapter. No generic CPI or NFT transfer path.
use crate::*;
const VENUE: Pubkey = solana_program::pubkey!("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");
fn disc(name: &str) -> Vec<u8> {
    solana_program::hash::hash(name.as_bytes()).to_bytes()[..8].to_vec()
}
fn key(data: &[u8], offset: usize, expected: &Pubkey) -> ProgramResult {
    check(data.get(offset..offset + 32) == Some(expected.as_ref()))
}
fn number(data: &[u8], offset: usize) -> Result<u128, ProgramError> {
    Ok(u128::from_le_bytes(
        data.get(offset..offset + 16)
            .ok_or(ProgramError::InvalidAccountData)?
            .try_into()
            .unwrap(),
    ))
}
// Fixed account sequence shared by initialize and collect; all PDAs rederived.
struct Venue<'a, 'b> {
    program: &'b AccountInfo<'a>,
    authority: &'b AccountInfo<'a>,
    pool: &'b AccountInfo<'a>,
    position: &'b AccountInfo<'a>,
    nft: &'b AccountInfo<'a>,
    nft_account: &'b AccountInfo<'a>,
    base_vault: &'b AccountInfo<'a>,
    quote_vault: &'b AccountInfo<'a>,
    event: &'b AccountInfo<'a>,
}
impl<'a, 'b> Venue<'a, 'b> {
    fn read(
        pid: &Pubkey,
        pa: &AccountInfo,
        base: &AccountInfo,
        quote: &AccountInfo,
        it: &mut std::slice::Iter<'b, AccountInfo<'a>>,
    ) -> Result<Self, ProgramError> {
        let v = Self {
            program: next_account_info(it)?,
            authority: next_account_info(it)?,
            pool: next_account_info(it)?,
            position: next_account_info(it)?,
            nft: next_account_info(it)?,
            nft_account: next_account_info(it)?,
            base_vault: next_account_info(it)?,
            quote_vault: next_account_info(it)?,
            event: next_account_info(it)?,
        };
        check(*v.program.key == VENUE && v.program.executable && base.key != quote.key)?;
        let deployment = next_account_info(it)?;
        pda(&bpf_loader_upgradeable::id(), deployment, &[VENUE.as_ref()])?;
        check(
            *v.program.owner == bpf_loader_upgradeable::id()
                && *deployment.owner == bpf_loader_upgradeable::id(),
        )?;
        let program = v.program.try_borrow_data()?;
        let binary = deployment.try_borrow_data()?;
        check(
            program.len() == 36
                && program[..4] == [2, 0, 0, 0]
                && program[4..36] == deployment.key.to_bytes(),
        )?;
        check(binary.len() >= 45 && binary[..4] == [3, 0, 0, 0] && binary[12] == 1)?;
        let mainnet = binary.len() == 2174352 + 45
            && binary[4..12] == 445230614u64.to_le_bytes()
            && binary[13..45]
                == solana_program::pubkey!("JADaUV8kvDpDbJr55wxXJHVaBS3VCj8thZZHjfeuCVLd")
                    .to_bytes();
        let devnet = binary.len() == 1559448 + 45
            && binary[4..12] == 503166267u64.to_le_bytes()
            && binary[13..45]
                == solana_program::pubkey!("DHLXnJdACTY83yKwnUkeoDjqi4QBbsYGa1v8tJL76ViX")
                    .to_bytes();
        check(mainnet || devnet)?;
        drop(program);
        drop(binary);
        pda(pid, v.nft, &[b"venue-nft", pa.key.as_ref()])?;
        let (max, min) = if base.key.to_bytes() > quote.key.to_bytes() {
            (base.key, quote.key)
        } else {
            (quote.key, base.key)
        };
        pda(&VENUE, v.pool, &[b"cpool", max.as_ref(), min.as_ref()])?;
        pda(&VENUE, v.authority, &[b"pool_authority"])?;
        pda(&VENUE, v.position, &[b"position", v.nft.key.as_ref()])?;
        pda(
            &VENUE,
            v.nft_account,
            &[b"position_nft_account", v.nft.key.as_ref()],
        )?;
        pda(
            &VENUE,
            v.base_vault,
            &[b"token_vault", base.key.as_ref(), v.pool.key.as_ref()],
        )?;
        pda(
            &VENUE,
            v.quote_vault,
            &[b"token_vault", quote.key.as_ref(), v.pool.key.as_ref()],
        )?;
        pda(&VENUE, v.event, &[b"__event_authority"])?;
        Ok(v)
    }
    fn state(&self, pa: &AccountInfo, base: &AccountInfo, quote: &AccountInfo) -> ProgramResult {
        check(
            *self.pool.owner == VENUE
                && self.pool.data_len() == 1112
                && *self.position.owner == VENUE
                && self.position.data_len() == 408,
        )?;
        let pool = self.pool.try_borrow_data()?;
        check(pool[..8] == disc("account:Pool"))?;
        // Pinned zero-copy layout. BaseFeeInfo 32, padding 8; PoolFeesStruct 160.
        check(pool[8..16] == 50_000_000u64.to_le_bytes() && pool[16..48].iter().all(|x| *x == 0))?;
        check(pool[48] == 20 && pool[54..56] == [0; 2] && pool[56..152].iter().all(|x| *x == 0))?;
        key(&pool, 168, base.key)?;
        key(&pool, 200, quote.key)?;
        key(&pool, 232, self.base_vault.key)?;
        key(&pool, 264, self.quote_vault.key)?;
        key(&pool, 296, &Pubkey::default())?; // No privileged pre-activation vault.
        key(&pool, 648, pa.key)?;
        check(pool[482] == 1 && pool[483] == 1)?;
        check(pool[480] == 1 && pool[481] == 0 && pool[484] == 1 && pool[485] == 1)?;
        let position = self.position.try_borrow_data()?;
        check(position[..8] == disc("account:Position"))?;
        key(&position, 8, self.pool.key)?;
        key(&position, 40, self.nft.key)?;
        check(
            number(&position, 152)? == 0
                && number(&position, 168)? == 0
                && number(&position, 184)? > 0,
        )?;
        check(position[392..396] == [0; 4])?;
        token_account(self.nft_account, self.nft.key, pa.key)?;
        let nft = self.nft_account.try_borrow_data()?;
        check(
            nft[64..72] == 1u64.to_le_bytes() && nft[72..76] == [0; 4] && nft[129..133] == [0; 4],
        )?;
        token_account(self.base_vault, base.key, self.authority.key)?;
        token_account(self.quote_vault, quote.key, self.authority.key)
    }
    fn call(
        &self,
        name: &str,
        extra: &[u8],
        entries: &[(&AccountInfo<'a>, bool, bool)],
        seeds: &[&[&[u8]]],
    ) -> ProgramResult {
        let mut data = disc(name);
        data.extend_from_slice(extra);
        let mut infos = Vec::new();
        let mut metas = Vec::new();
        for (a, w, s) in entries {
            infos.push((*a).clone());
            metas.push(if *w {
                AccountMeta::new(*a.key, *s)
            } else {
                AccountMeta::new_readonly(*a.key, *s)
            });
        }
        infos.push(self.event.clone());
        infos.push(self.program.clone());
        metas.push(AccountMeta::new_readonly(*self.event.key, false));
        metas.push(AccountMeta::new_readonly(VENUE, false));
        invoke_signed(
            &Instruction {
                program_id: VENUE,
                accounts: metas,
                data,
            },
            &infos,
            seeds,
        )
    }
}
pub fn initialize<'a, 'b>(
    pid: &Pubkey,
    who: &AccountInfo<'a>,
    pa: &AccountInfo<'a>,
    base: &AccountInfo<'a>,
    source: &AccountInfo<'a>,
    quote: &AccountInfo<'a>,
    quote_source: &AccountInfo<'a>,
    sys: &AccountInfo<'a>,
    tp: &AccountInfo<'a>,
    it: &mut std::slice::Iter<'b, AccountInfo<'a>>,
    min: u128,
    max: u128,
    liquidity: u128,
    ps: &[&[u8]],
) -> ProgramResult {
    check(
        cfg!(feature = "venue-adapter")
            && min >= 4295048016
            && max <= 79226673521066979257578248091
            && min < max
            && liquidity > 0,
    )?;
    // Sponsor is separate from creator; only its one-unit transfer is authorized.
    let sponsor = next_account_info(it)?;
    let sponsor_quote = next_account_info(it)?;
    signed(sponsor)?;
    token_account(sponsor_quote, quote.key, sponsor.key)?;
    transfer(tp, sponsor_quote, quote, quote_source, sponsor, 1, &[])?;
    let v = Venue::read(pid, pa, base, quote, it)?;
    let bump = pda(pid, v.nft, &[b"venue-nft", pa.key.as_ref()])?;
    let ns: &[&[u8]] = &[b"venue-nft", pa.key.as_ref(), &[bump]];
    let mut params = 50_000_000u64.to_le_bytes().to_vec();
    params.extend_from_slice(&[0; 23]);
    params.extend_from_slice(&min.to_le_bytes());
    params.extend_from_slice(&max.to_le_bytes());
    params.push(0);
    params.extend_from_slice(&liquidity.to_le_bytes());
    params.extend_from_slice(&min.to_le_bytes());
    params.extend_from_slice(&[1, 1, 0]);
    // The venue uses payer as transfer authority. Limit transient delegation to
    // the exact deposits and revoke it before this atomic instruction returns.
    for (account, amount) in [(source, LIQUIDITY), (quote_source, 1)] {
        tok(
            tp,
            amount_data(13, amount),
            vec![
                AccountMeta::new(*account.key, false),
                AccountMeta::new_readonly(
                    if account.key == source.key {
                        *base.key
                    } else {
                        *quote.key
                    },
                    false,
                ),
                AccountMeta::new_readonly(*who.key, false),
                AccountMeta::new_readonly(*pa.key, true),
            ],
            &[
                account.clone(),
                if account.key == source.key {
                    base.clone()
                } else {
                    quote.clone()
                },
                who.clone(),
                pa.clone(),
            ],
            ps,
        )?;
    }
    let before = fees::token_balance(source)?;
    let quote_before = fees::token_balance(quote_source)?;
    v.call(
        "global:initialize_customizable_pool",
        &params,
        &[
            (pa, false, false),
            (v.nft, true, true),
            (v.nft_account, true, false),
            (who, true, true),
            (v.authority, false, false),
            (v.pool, true, false),
            (v.position, true, false),
            (base, false, false),
            (quote, false, false),
            (v.base_vault, true, false),
            (v.quote_vault, true, false),
            (source, true, false),
            (quote_source, true, false),
            (tp, false, false),
            (tp, false, false),
            (tp, false, false),
            (sys, false, false),
        ],
        &[ps, ns],
    )?;
    check(
        before.checked_sub(fees::token_balance(source)?) == Some(LIQUIDITY)
            && quote_before.checked_sub(fees::token_balance(quote_source)?) == Some(1),
    )?;
    v.call(
        "global:permanent_lock_position",
        &liquidity.to_le_bytes(),
        &[
            (v.pool, true, false),
            (v.position, true, false),
            (v.nft_account, false, false),
            (pa, false, true),
        ],
        &[ps],
    )?;
    for account in [source, quote_source] {
        tok(
            tp,
            vec![5],
            vec![
                AccountMeta::new(*account.key, false),
                AccountMeta::new_readonly(*pa.key, true),
            ],
            &[account.clone(), pa.clone()],
            ps,
        )?;
    }
    v.state(pa, base, quote)?;
    let pool = v.pool.try_borrow_data()?;
    check(number(&pool, 424)? == min && number(&pool, 440)? == max && number(&pool, 456)? == min)?;
    check(number(&v.position.try_borrow_data()?, 184)? == liquidity)
}
pub fn collect<'a, 'b>(
    pid: &Pubkey,
    pa: &AccountInfo<'a>,
    p: &Project,
    f: &Factory,
    it: &mut std::slice::Iter<'b, AccountInfo<'a>>,
    now: i64,
    ps: &[&[u8]],
) -> ProgramResult {
    check(cfg!(feature = "venue-adapter") && f.test_mode && !p.tokenless && p.virtual_quote == 0)?;
    let base = next_account_info(it)?;
    let base_account = next_account_info(it)?;
    let quote = next_account_info(it)?;
    let quote_account = next_account_info(it)?;
    let day = next_account_info(it)?;
    let vault = next_account_info(it)?;
    let tp = next_account_info(it)?;
    check(*base.key == p.mint)?;
    fees::validate_mint(quote, f)?;
    pda(pid, base_account, &[b"pool", pa.key.as_ref()])?;
    token_account(base_account, base.key, pa.key)?;
    pda(pid, quote_account, &[b"quote-pool", pa.key.as_ref()])?;
    token_account(quote_account, quote.key, pa.key)?;
    let mut daily = fees::daily(pid, day, pa.key, now.div_euclid(86400))?;
    check(!daily.settled && daily.policy == 1)?;
    fees::vault(pid, vault, day, f)?;
    let v = Venue::read(pid, pa, base, quote, it)?;
    v.state(pa, base, quote)?;
    let before = fees::token_balance(quote_account)?;
    let base_before = fees::token_balance(base_account)?;
    v.call(
        "global:claim_position_fee",
        &[],
        &[
            (v.authority, false, false),
            (v.pool, false, false),
            (v.position, true, false),
            (base_account, true, false),
            (quote_account, true, false),
            (v.base_vault, true, false),
            (v.quote_vault, true, false),
            (base, false, false),
            (quote, false, false),
            (v.nft_account, false, false),
            (pa, false, true),
            (tp, false, false),
            (tp, false, false),
        ],
        &[ps],
    )?;
    check(fees::token_balance(base_account)? == base_before)?;
    let received = fees::token_balance(quote_account)?
        .checked_sub(before)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    if received > 0 {
        let vault_before = fees::token_balance(vault)?;
        transfer(tp, quote_account, quote, vault, pa, received, ps)?;
        check(fees::token_balance(vault)?.checked_sub(vault_before) == Some(received))?;
        fees::allocate_venue(&mut daily, received)?;
        save(day, &daily)?;
    }
    v.state(pa, base, quote)
}

/// Allowlist the two immutable metadata-only extensions observed on e/acc.
/// Transfer hooks/fees, delegates and all unknown extensions fail closed.
pub fn metadata_mint(mint: &AccountInfo) -> ProgramResult {
    let d = mint.try_borrow_data()?;
    check(d.len() >= 166 && d.len() <= 4096 && d[82..165].iter().all(|b| *b == 0) && d[165] == 1)?;
    let mut offset = 166;
    let mut seen = 0u8;
    while offset < d.len() {
        check(offset + 4 <= d.len())?;
        let kind = u16::from_le_bytes(d[offset..offset + 2].try_into().unwrap());
        let len = u16::from_le_bytes(d[offset + 2..offset + 4].try_into().unwrap()) as usize;
        offset += 4;
        check(offset + len <= d.len())?;
        let value = &d[offset..offset + len];
        let bit = match kind {
            18 => {
                check(len == 64)?;
                1
            }
            19 => {
                check(len >= 80)?;
                2
            }
            _ => return Err(ProgramError::InvalidAccountData),
        };
        check(seen & bit == 0 && value[..32] == [0; 32] && value[32..64] == mint.key.to_bytes())?;
        seen |= bit;
        offset += len;
    }
    check(seen == 3)
}
