//! Day-1 gate: signup → delegate → session → buy 10 cards → VRF reveals, plus late/duplicate callbacks.
//! Needs `anchor build --arch v0` first (loads target/deploy/scratchers.so). Run: `cargo +stable test`.
use anchor_lang::{
    prelude::Pubkey, system_program, AccountDeserialize, AccountSerialize, Discriminator, Id, InstructionData,
    ToAccountMetas,
};
use ephemeral_rollups_sdk::{
    anchor::{DelegationProgram, MagicProgram},
    consts::MAGIC_CONTEXT_ID,
    dlp_api::discriminator::DlpDiscriminator,
    pda::{
        ephemeral_balance_pda_from_payer,
        delegate_buffer_pda_from_delegated_account_and_owner_program, delegation_metadata_pda_from_delegated_account,
        delegation_record_pda_from_delegated_account,
    },
};
use magicsvm::{MagicSVM, TransactionTarget};
use scratchers::{
    error::ScratchError,
    instruction as ix_data,
    state::{Card, CardState, Config, Payout, Player, SellQuote, Series, Stats, Tier, VaultState},
};
use solana_address::Address;
use solana_clock::Clock;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;

use TransactionTarget::{Base, Ephemeral};

const NOW: i64 = 1_700_000_000;
const PRICE: i64 = 200 * 100_000_000; // $200 / share
const QUEUE: Pubkey = Pubkey::from_str_const("5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc");
const VRF_PROGRAM: Pubkey = Pubkey::from_str_const("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");
const SLOT_HASHES: Pubkey = Pubkey::from_str_const("SysvarS1otHashes111111111111111111111111111");
const FEED_ID: [u8; 32] = [7; 32];

fn addr(p: Pubkey) -> Address {
    Address::new_from_array(p.to_bytes())
}
fn pk(a: &Address) -> Pubkey {
    Pubkey::new_from_array(a.to_bytes())
}
fn ix(data: impl InstructionData, accounts: impl ToAccountMetas) -> Instruction {
    Instruction {
        program_id: addr(scratchers::ID),
        accounts: accounts
            .to_account_metas(None)
            .into_iter()
            .map(|m| AccountMeta { pubkey: addr(m.pubkey), is_signer: m.is_signer, is_writable: m.is_writable })
            .collect(),
        data: data.data(),
    }
}
fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &scratchers::ID).0
}

struct Env {
    svm: MagicSVM,
    admin: Keypair,
    user: Keypair,
    session: Keypair,
    pusher: Keypair,
    mint: Pubkey,
    usdc: Pubkey,
    validator: Pubkey,
    player: Pubkey,
    vault: Pubkey,
    series: Pubkey,
    feed: Pubkey,
    config: Pubkey,
    stats: Pubkey,
}

fn try_send(svm: &mut MagicSVM, t: TransactionTarget, signers: &[&Keypair], i: Instruction) -> Result<(), String> {
    let tx = Transaction::new(signers, Message::new(&[i], Some(&signers[0].pubkey())), svm.latest_blockhash_for(t));
    let r = svm.send_transaction_to(t, tx);
    svm.expire_blockhash_for(t);
    r.map(|_| ()).map_err(|f| format!("{:?}\n{:#?}", f.err, f.meta.logs))
}
fn send(svm: &mut MagicSVM, t: TransactionTarget, signers: &[&Keypair], i: Instruction, label: &str) {
    try_send(svm, t, signers, i).unwrap_or_else(|e| panic!("{label} failed on {t:?}: {e}"));
}
/// Anchor custom error code → substring check on the formatted failure.
fn custom(e: ScratchError) -> String {
    format!("Custom({})", 6000 + e as u32)
}

/// Series with the default 75.371% RTP rarity table (Dust → Grail).
fn default_tiers() -> [Tier; 8] {
    let w = [
        (2_000, 76_025), (10_000, 12_500), (20_000, 8_333), (50_000, 2_000),
        (100_000, 1_000), (500_000, 100), (1_000_000, 40), (10_000_000, 2),
    ];
    w.map(|(multiplier_bps, weight)| Tier { multiplier_bps, weight })
}

fn stock_mint_account(authority: &Pubkey) -> solana_account::Account {
    let mut d = vec![0u8; 82];
    d[0..4].copy_from_slice(&1u32.to_le_bytes());
    d[4..36].copy_from_slice(authority.as_ref());
    d[44] = 6; // decimals
    d[45] = 1; // initialized
    solana_account::Account {
        lamports: 1_461_600,
        data: d,
        owner: addr(anchor_spl::token::ID),
        executable: false,
        rent_epoch: 0,
    }
}

fn read<T: AccountDeserialize>(svm: &MagicSVM, t: TransactionTarget, a: &Pubkey) -> T {
    let acc = svm.get_account_for(t, &addr(*a)).expect("account");
    T::try_deserialize(&mut &acc.data[..]).unwrap()
}
fn read_player(svm: &MagicSVM, t: TransactionTarget, a: &Pubkey) -> Player {
    let acc = svm.get_account_for(t, &addr(*a)).expect("player");
    bytemuck::pod_read_unaligned(&acc.data[8..8 + core::mem::size_of::<Player>()])
}
/// Test-only state injection on the rollup ledger (deposit path is built in Day 2).
fn edit_er_player(svm: &mut MagicSVM, a: &Pubkey, f: impl FnOnce(&mut Player)) {
    let mut acc = svm.ephemeral().get_account(&addr(*a)).expect("player");
    let n = core::mem::size_of::<Player>();
    let mut p: Player = bytemuck::pod_read_unaligned(&acc.data[8..8 + n]);
    f(&mut p);
    acc.data[8..8 + n].copy_from_slice(bytemuck::bytes_of(&p));
    svm.ephemeral_mut().set_account(addr(*a), acc).unwrap();
}
fn set_time(svm: &mut MagicSVM, ts: i64) {
    let mut c: Clock = svm.get_sysvar();
    c.unix_timestamp = ts;
    svm.set_sysvar(&c);
}

/// Boot → configure → signup → delegate everything → price pushed → player funded with `usdc_e6`.
fn setup(usdc_e6: u64, inventory_shares: u64, tiers: [Tier; 8]) -> Env {
    let mut svm = MagicSVM::new();
    svm.add_program_from_file(addr(scratchers::ID), concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/scratchers.so"))
        .expect("build the program first: anchor build --arch v0");
    let (admin, user, session, pusher) = (Keypair::new(), Keypair::new(), Keypair::new(), Keypair::new());
    for k in [&admin, &user, &session, &pusher] {
        svm.airdrop(&k.pubkey(), 10_000_000_000).unwrap();
    }
    set_time(&mut svm, NOW);
    let validator = pk(&svm.validator_identity());
    let mint = Pubkey::new_unique();
    svm.set_account(addr(mint), stock_mint_account(&admin.pubkey().to_bytes().into())).unwrap();
    let usdc = Pubkey::new_unique(); // same 6-decimal mint layout as the stock mints
    svm.set_account(addr(usdc), stock_mint_account(&admin.pubkey().to_bytes().into())).unwrap();

    let (config, series, vault, feed, player) = (
        pda(&[b"config"]),
        pda(&[b"series", &1u16.to_le_bytes()]),
        pda(&[b"vault", mint.as_ref()]),
        pda(&[b"feed", &FEED_ID]),
        pda(&[b"player", user.pubkey().as_ref()]),
    );
    let a = pk(&admin.pubkey());
    let u = pk(&user.pubkey());
    let sys = system_program::ID;

    send(&mut svm, Base, &[&admin], ix(ix_data::InitConfig { keeper: a, usdc_mint: usdc },
        scratchers::accounts::InitConfig { config, admin: a, system_program: sys }), "init_config");
    send(&mut svm, Base, &[&admin], ix(
        ix_data::CreateSeries { args: scratchers::instructions::CreateSeriesArgs {
            id: 1, price_source: scratchers::price::PriceSource::SelfPushed, feed, feed_expo: -8,
            ticket_usd_e6: 1_000_000, tiers, total_weight: tiers.iter().map(|t| t.weight).sum(),
            demo: false, max_staleness_s: 60, max_move_bps: 500, max_conf_bps: 100, vrf_timeout_s: 120 } },
        scratchers::accounts::CreateSeries { config, series, stock_mint: mint, admin: a, system_program: sys }), "create_series");
    send(&mut svm, Base, &[&admin], ix(ix_data::FreezeSeries {},
        scratchers::accounts::FreezeSeries { config, series, admin: a }), "freeze_series");
    let stats = pda(&[b"stats", &1u16.to_le_bytes()]);
    send(&mut svm, Base, &[&admin], ix(ix_data::InitStats { series_id: 1 },
        scratchers::accounts::InitStats { config, series, stats, admin: a, system_program: sys }), "init_stats");
    send(&mut svm, Base, &[&admin], ix(ix_data::InitVault {}, scratchers::accounts::InitVault {
        config, vault_state: vault, stock_mint: mint,
        vault_token: anchor_spl::associated_token::get_associated_token_address(&vault, &mint),
        admin: a, token_program: anchor_spl::token::ID,
        associated_token_program: anchor_spl::associated_token::ID, system_program: sys }), "init_vault");
    send(&mut svm, Base, &[&admin], ix(
        ix_data::InitFeed { feed_id: FEED_ID, pusher: pk(&pusher.pubkey()), expo: -8, max_move_bps: 500 },
        scratchers::accounts::InitFeed { config, feed, admin: a, system_program: sys }), "init_feed");
    send(&mut svm, Base, &[&user], ix(ix_data::Signup {},
        scratchers::accounts::Signup { player, authority: u, system_program: sys }), "signup");

    let owner = scratchers::ID;
    send(&mut svm, Base, &[&user], ix(ix_data::DelegatePlayer { validator: Some(validator) },
        scratchers::accounts::DelegatePlayer {
            authority: u, buffer_player: delegate_buffer_pda_from_delegated_account_and_owner_program(&player, &owner),
            delegation_record_player: delegation_record_pda_from_delegated_account(&player),
            delegation_metadata_player: delegation_metadata_pda_from_delegated_account(&player),
            player, owner_program: owner, delegation_program: DelegationProgram::id(), system_program: sys }), "delegate_player");
    send(&mut svm, Base, &[&admin], ix(ix_data::DelegateVault { validator: Some(validator) },
        scratchers::accounts::DelegateVault {
            config, admin: a, stock_mint: mint,
            buffer_vault_state: delegate_buffer_pda_from_delegated_account_and_owner_program(&vault, &owner),
            delegation_record_vault_state: delegation_record_pda_from_delegated_account(&vault),
            delegation_metadata_vault_state: delegation_metadata_pda_from_delegated_account(&vault),
            vault_state: vault, owner_program: owner, delegation_program: DelegationProgram::id(), system_program: sys }), "delegate_vault");
    send(&mut svm, Base, &[&admin], ix(ix_data::DelegateStats { series_id: 1, validator: Some(validator) },
        scratchers::accounts::DelegateStats {
            config, admin: a,
            buffer_stats: delegate_buffer_pda_from_delegated_account_and_owner_program(&stats, &owner),
            delegation_record_stats: delegation_record_pda_from_delegated_account(&stats),
            delegation_metadata_stats: delegation_metadata_pda_from_delegated_account(&stats),
            stats, owner_program: owner, delegation_program: DelegationProgram::id(), system_program: sys }), "delegate_stats");
    send(&mut svm, Base, &[&admin], ix(ix_data::DelegateFeed { feed_id: FEED_ID, validator: Some(validator) },
        scratchers::accounts::DelegateFeed {
            config, admin: a,
            buffer_feed: delegate_buffer_pda_from_delegated_account_and_owner_program(&feed, &owner),
            delegation_record_feed: delegation_record_pda_from_delegated_account(&feed),
            delegation_metadata_feed: delegation_metadata_pda_from_delegated_account(&feed),
            feed, owner_program: owner, delegation_program: DelegationProgram::id(), system_program: sys }), "delegate_feed");

    let mut env = Env { svm, admin, user, session, pusher, mint, usdc, validator, player, vault, series, feed, config, stats };
    push_price(&mut env, PRICE, NOW);
    edit_er_player(&mut env.svm, &player, |p| p.usdc_balance_e6 = usdc_e6);
    let sync = ix(ix_data::SyncInventory { added_shares: inventory_shares },
        scratchers::accounts::SyncInventory { config, authority: a, vault_state: vault });
    send(&mut env.svm, Ephemeral, &[&env.admin.insecure_clone()], sync, "sync_inventory");
    env
}

fn push_price(e: &mut Env, price: i64, ts: i64) {
    let i = ix(ix_data::PushPrice { price, conf: 0, publish_ts: ts },
        scratchers::accounts::PushPrice { pusher: pk(&e.pusher.pubkey()), feed: e.feed });
    send(&mut e.svm, Ephemeral, &[&e.pusher.insecure_clone()], i, "push_price");
}

fn create_session(e: &mut Env, expiry: i64, cap: u64) {
    let i = ix(ix_data::CreateSession { session_key: pk(&e.session.pubkey()), expiry, cap_e6: cap },
        scratchers::accounts::Session { authority: pk(&e.user.pubkey()), player: e.player });
    send(&mut e.svm, Ephemeral, &[&e.user.insecure_clone()], i, "create_session");
}

fn buy_ix(e: &Env, signer: &Keypair, n: u8, max_price: u64) -> Instruction {
    ix(ix_data::BuyCard { n, max_price, caller_seed: [9; 32] }, scratchers::accounts::BuyCard {
        signer: pk(&signer.pubkey()), authority: pk(&e.user.pubkey()), player: e.player, config: e.config,
        series: e.series, vault_state: e.vault, stats: e.stats, price_feed: e.feed, oracle_queue: QUEUE,
        program_identity: pda(&[b"identity"]), vrf_program: VRF_PROGRAM, slot_hashes: SLOT_HASHES,
        system_program: system_program::ID })
}

/// Advance one slot; return the VRF callback results.
fn fulfill(svm: &mut MagicSVM) -> Vec<Result<(), String>> {
    let slot = svm.get_sysvar::<Clock>().slot;
    svm.warp_to_slot(slot + 1)
        .into_iter()
        .map(|r| r.map(|_| ()).map_err(|f| format!("{:?}\n{:#?}", f.err, f.meta.logs)))
        .collect()
}

fn revealed(p: &Player) -> Vec<Card> {
    p.cards.iter().copied().filter(|c| c.state == CardState::Revealed as u8).collect()
}

#[test]
fn buy_ten_cards_get_ten_vrf_reveals() {
    let mut e = setup(50_000_000, 10_000_000_000, default_tiers());
    create_session(&mut e, NOW + 3600, 20_000_000);

    let session = e.session.insecure_clone();
    let buy = buy_ix(&e, &session, 10, PRICE as u64 * 2 /* generous */);
    send(&mut e.svm, Ephemeral, &[&session], buy, "buy_card x10");

    // Pending: paid, reserved, debited, nothing revealed yet.
    let p = read_player(&e.svm, Ephemeral, &e.player);
    assert_eq!(p.usdc_balance_e6, 40_000_000);
    assert_eq!(p.session_spend_remaining_e6, 10_000_000);
    assert_eq!(p.cards.iter().filter(|c| c.state == CardState::RandomnessPending as u8).count(), 10);
    let v: VaultState = read(&e.svm, Ephemeral, &e.vault);
    let reserve_per = (10_000_000u128 * 1_000_000 * 100_000_000 / (10_000 * PRICE as u128)) as u64; // Grail 1000x worst case
    assert_eq!(v.reserved_shares, 10 * reserve_per);
    assert_eq!(v.usdc_in_e6, 10_000_000);
    let st: Stats = read(&e.svm, Ephemeral, &e.stats);
    assert_eq!((st.cards_sold, st.tier_counts.iter().sum::<u64>()), (10, 0), "sold counted at buy, tiers only at reveal");

    let results = fulfill(&mut e.svm);
    assert_eq!(results.len(), 10);
    for r in &results {
        r.as_ref().unwrap_or_else(|err| panic!("callback failed: {err}"));
    }

    let p = read_player(&e.svm, Ephemeral, &e.player);
    let series: Series = read(&e.svm, Base, &e.series);
    let cards = revealed(&p);
    assert_eq!(cards.len(), 10);
    let mut expected_shares = 0;
    for c in &cards {
        let tier = series.tier_for(&c.seed);
        assert_eq!(c.tier as usize, tier, "tier must be recomputable from the seed");
        let shares = (series.tiers[tier].multiplier_bps as u128 * 1_000_000 * 100_000_000 / (10_000 * PRICE as u128)) as u64;
        assert_eq!(c.shares, shares);
        expected_shares += shares;
    }
    // Excess reservation released: only actual winnings remain reserved.
    let v: VaultState = read(&e.svm, Ephemeral, &e.vault);
    assert_eq!(v.reserved_shares, expected_shares);
    // Public stats mirror the reveals exactly.
    let st: Stats = read(&e.svm, Ephemeral, &e.stats);
    let mut counts = [0u64; 8];
    for c in &cards {
        counts[c.tier as usize] += 1;
    }
    assert_eq!((st.cards_sold, st.tier_counts, st.shares_won), (10, counts, expected_shares));
}

#[test]
fn late_callback_after_cancel_is_rejected_and_refunds() {
    let mut e = setup(5_000_000, 10_000_000_000, default_tiers());
    let user = e.user.insecure_clone();
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    send(&mut e.svm, Ephemeral, &[&user], buy, "buy_card");

    // Not timed out yet.
    let cancel = |e: &Env| {
        ix(ix_data::CancelPending { card_id: 0 }, scratchers::accounts::CancelPending {
            signer: pk(&e.user.pubkey()), authority: pk(&e.user.pubkey()), player: e.player, series: e.series, vault_state: e.vault })
    };
    let c = cancel(&e);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], c).unwrap_err();
    assert!(err.contains(&custom(ScratchError::NotTimedOut)), "{err}");

    set_time(&mut e.svm, NOW + 121);
    let c = cancel(&e);
    send(&mut e.svm, Ephemeral, &[&user], c, "cancel_pending");
    let p = read_player(&e.svm, Ephemeral, &e.player);
    assert_eq!(p.usdc_balance_e6, 5_000_000, "refunded");
    assert_eq!(p.cards[0].state, CardState::Cancelled as u8);
    let v: VaultState = read(&e.svm, Ephemeral, &e.vault);
    assert_eq!((v.reserved_shares, v.usdc_in_e6), (0, 0));

    // The oracle still fulfills the voided request: must fail with VrfRequestMismatch.
    let results = fulfill(&mut e.svm);
    assert_eq!(results.len(), 1);
    let err = results[0].as_ref().unwrap_err();
    assert!(err.contains(&custom(ScratchError::VrfRequestMismatch)), "{err}");
    assert_eq!(read_player(&e.svm, Ephemeral, &e.player).cards[0].state, CardState::Cancelled as u8);
}

#[test]
fn a_second_callback_for_a_revealed_card_changes_nothing() {
    let mut e = setup(5_000_000, 10_000_000_000, default_tiers());
    let user = e.user.insecure_clone();
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    send(&mut e.svm, Ephemeral, &[&user], buy, "buy_card");
    // Stand in for "the first callback already landed": the card is Revealed when this request is fulfilled.
    let player = e.player;
    edit_er_player(&mut e.svm, &player, |p| {
        p.cards[0].state = CardState::Revealed as u8;
        p.cards[0].tier = 3;
    });
    let before: VaultState = read(&e.svm, Ephemeral, &e.vault);

    let results = fulfill(&mut e.svm);
    let err = results[0].as_ref().unwrap_err();
    assert!(err.contains(&custom(ScratchError::AlreadyRevealed)), "{err}");
    let card = read_player(&e.svm, Ephemeral, &e.player).cards[0];
    assert_eq!((card.state, card.tier), (CardState::Revealed as u8, 3));
    let after: VaultState = read(&e.svm, Ephemeral, &e.vault);
    assert_eq!(after.reserved_shares, before.reserved_shares, "no second release");
}

#[test]
fn undelegate_is_blocked_while_randomness_pending_then_commits() {
    let mut e = setup(5_000_000, 10_000_000_000, default_tiers());
    let user = e.user.insecure_clone();
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    send(&mut e.svm, Ephemeral, &[&user], buy, "buy_card");
    let undelegate = |e: &Env| {
        ix(ix_data::UndelegatePlayer {}, scratchers::accounts::UndelegatePlayer {
            authority: pk(&e.user.pubkey()), player: e.player,
            magic_program: MagicProgram::id(), magic_context: ephemeral_rollups_sdk::consts::MAGIC_CONTEXT_ID })
    };
    let u = undelegate(&e);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], u).unwrap_err();
    assert!(err.contains(&custom(ScratchError::BadState)), "{err}");

    for r in fulfill(&mut e.svm) {
        r.unwrap();
    }
    // Revealed-but-unclaimed cards are fine to commit; losing/winning state travels back to base.
    let u = undelegate(&e);
    send(&mut e.svm, Ephemeral, &[&user], u, "undelegate_player");
    let base = e.svm.get_account_for(Base, &addr(e.player)).unwrap();
    assert_eq!(base.owner, addr(scratchers::ID), "back under the program on base");
    assert_eq!(read_player(&e.svm, Base, &e.player).cards[0].state, CardState::Revealed as u8);
}

#[test]
fn spoofed_callback_cannot_pick_the_outcome() {
    let mut e = setup(5_000_000, 10_000_000_000, default_tiers());
    let user = e.user.insecure_clone();
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    send(&mut e.svm, Ephemeral, &[&user], buy, "buy_card");
    let card = read_player(&e.svm, Ephemeral, &e.player).cards[0];

    // The attacker signs as the "VRF identity" and tries to force the 1000x tier (r = 99_999).
    let mut seed = [0u8; 32];
    seed[0..8].copy_from_slice(&99_999u64.to_le_bytes());
    let spoof = ix(ix_data::VrfCallback { randomness: seed, card_id: card.id, request_id: card.vrf_request_id },
        scratchers::accounts::VrfCallback {
            vrf_program_identity: pk(&user.pubkey()), player: e.player, series: e.series, vault_state: e.vault, stats: e.stats });
    let err = try_send(&mut e.svm, Ephemeral, &[&user], spoof).unwrap_err();
    assert!(err.contains("Custom(2012)"), "expected ConstraintAddress, got {err}"); // address constraint
    assert_eq!(read_player(&e.svm, Ephemeral, &e.player).cards[0].state, CardState::RandomnessPending as u8);

    for r in fulfill(&mut e.svm) {
        r.unwrap(); // the real oracle callback still lands
    }
    assert_eq!(read_player(&e.svm, Ephemeral, &e.player).cards[0].state, CardState::Revealed as u8);
}

// silence unused warnings for fields kept for later tests
#[allow(dead_code)]
fn _keep(e: &Env) -> (Pubkey, Pubkey, [u8; 8]) {
    (e.mint, e.validator, Config::DISCRIMINATOR.try_into().unwrap())
}

#[test]
fn insufficient_inventory_blocks_buys_and_sync_is_gated() {
    // 10 cards reserve 10 × 1000x × $1 / $200 = 50 shares; fund only 49.
    let mut e = setup(50_000_000, 49_000_000, default_tiers());
    let user = e.user.insecure_clone();
    let buy = buy_ix(&e, &user, 10, u64::MAX);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], buy).unwrap_err();
    assert!(err.contains(&custom(ScratchError::InsufficientInventory)), "{err}");
    // 9 cards (45 shares) still fit.
    let buy = buy_ix(&e, &user, 9, u64::MAX);
    send(&mut e.svm, Ephemeral, &[&user], buy, "buy 9");

    // Only admin/keeper may credit inventory.
    let rogue = ix(ix_data::SyncInventory { added_shares: 1_000_000_000 },
        scratchers::accounts::SyncInventory { config: e.config, authority: pk(&user.pubkey()), vault_state: e.vault });
    let err = try_send(&mut e.svm, Ephemeral, &[&user], rogue).unwrap_err();
    assert!(err.contains(&custom(ScratchError::Unauthorized)), "{err}");
}

// ---- settlement: claim_all → commit + Magic Action → pay_out --------------------------------------

fn token_account(mint: &Pubkey, owner: &Pubkey, amount: u64) -> solana_account::Account {
    let mut d = vec![0u8; 165];
    d[0..32].copy_from_slice(mint.as_ref());
    d[32..64].copy_from_slice(owner.as_ref());
    d[64..72].copy_from_slice(&amount.to_le_bytes());
    d[108] = 1; // initialized
    solana_account::Account { lamports: 2_039_280, data: d, owner: addr(anchor_spl::token::ID), executable: false, rent_epoch: 0 }
}
fn token_amount(svm: &MagicSVM, a: &Pubkey) -> u64 {
    u64::from_le_bytes(svm.get_account(&addr(*a)).map(|x| x.data[64..72].try_into().unwrap()).unwrap_or([0; 8]))
}
fn force_randomness(svm: &mut MagicSVM, r: u64) {
    let mut seed = [0u8; 32];
    seed[0..8].copy_from_slice(&r.to_le_bytes());
    svm.set_vrf_randomness(Some(seed));
}
fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    anchor_spl::associated_token::get_associated_token_address(owner, mint)
}

/// Vault stocked on Solana, the player's stock ATA created, escrow (action rent payer) topped up.
fn prep_settlement(e: &mut Env, fund_escrow: bool, create_user_ata: bool) -> (Pubkey, Pubkey) {
    let (vault_token, user_ata) = (ata(&e.vault, &e.mint), ata(&pk(&e.user.pubkey()), &e.mint));
    e.svm.set_account(addr(vault_token), token_account(&e.mint, &e.vault, 100_000_000)).unwrap();
    let u = pk(&e.user.pubkey());
    let create_ata = Instruction {
        program_id: addr(anchor_spl::associated_token::ID),
        accounts: vec![
            AccountMeta::new(addr(u), true), AccountMeta::new(addr(user_ata), false), AccountMeta::new_readonly(addr(u), false),
            AccountMeta::new_readonly(addr(e.mint), false), AccountMeta::new_readonly(addr(system_program::ID), false),
            AccountMeta::new_readonly(addr(anchor_spl::token::ID), false),
        ],
        data: vec![1], // CreateIdempotent
    };
    let user = e.user.insecure_clone();
    if create_user_ata {
        send(&mut e.svm, Base, &[&user], create_ata, "create user ata");
    }
    if fund_escrow {
        let escrow = ephemeral_balance_pda_from_payer(&e.player, 255);
        let mut data = DlpDiscriminator::TopUpEphemeralBalance.to_vec();
        data.extend_from_slice(&5_000_000u64.to_le_bytes());
        data.push(255);
        let top_up = Instruction {
            program_id: addr(DelegationProgram::id()),
            accounts: vec![
                AccountMeta::new(addr(u), true), AccountMeta::new_readonly(addr(e.player), false),
                AccountMeta::new(addr(escrow), false), AccountMeta::new_readonly(addr(system_program::ID), false),
            ],
            data,
        };
        send(&mut e.svm, Base, &[&user], top_up, "top up escrow");
    }
    (vault_token, user_ata)
}

/// One Common (1×) and one Dust (0.2×) card, both revealed. Every rarity pays stock now, Dust included.
fn buy_one_common_one_dust(e: &mut Env) {
    let user = e.user.insecure_clone();
    for r in [80_000u64, 0] {
        force_randomness(&mut e.svm, r);
        let buy = buy_ix(e, &user, 1, u64::MAX);
        send(&mut e.svm, Ephemeral, &[&user], buy, "buy_card");
        for res in fulfill(&mut e.svm) {
            res.unwrap();
        }
    }
}

fn claim_ix(e: &Env) -> Instruction {
    let fee_vault = Pubkey::find_program_address(&[b"magic-fee-vault", e.validator.as_ref()], &DelegationProgram::id()).0;
    ix(ix_data::ClaimAll { series_id: 1 }, scratchers::accounts::ClaimAll {
        signer: pk(&e.user.pubkey()), authority: pk(&e.user.pubkey()), player: e.player, series: e.series, vault_state: e.vault,
        delegation_record_player: delegation_record_pda_from_delegated_account(&e.player), magic_fee_vault: fee_vault,
        magic_context: MAGIC_CONTEXT_ID, magic_program: MagicProgram::id() })
}

fn payout_pda(e: &Env, card_id: u64) -> Pubkey {
    pda(&[b"payout", e.player.as_ref(), &card_id.to_le_bytes()])
}

fn keeper_pay_out_ix(e: &Env, card_id: u64, vault_token: Pubkey, user_ata: Pubkey) -> Instruction {
    ix(ix_data::PayOut { card_id }, scratchers::accounts::PayOut {
        config: e.config, keeper: pk(&e.admin.pubkey()), player: e.player, series: e.series, vault_state: e.vault,
        vault_token, dest: user_ata, stock_mint: e.mint, payout: payout_pda(e, card_id),
        token_program: anchor_spl::token::ID, system_program: system_program::ID })
}

fn card_by_id(p: &Player, id: u64) -> Card {
    *p.cards.iter().find(|c| c.id == id && c.state != CardState::Empty as u8).unwrap()
}

#[test]
fn claim_all_commits_and_magic_action_pays_out_once() {
    let mut e = setup(10_000_000, 100_000_000, default_tiers());
    let (vault_token, user_ata) = prep_settlement(&mut e, true, true);
    buy_one_common_one_dust(&mut e);
    let user = e.user.insecure_clone();

    let claim = claim_ix(&e);
    send(&mut e.svm, Ephemeral, &[&user], claim, "claim_all");

    // Rollup view: both rarities hold stock, so both await payout; accounting released.
    let p = read_player(&e.svm, Ephemeral, &e.player);
    assert_eq!(card_by_id(&p, 0).state, CardState::ClaimRequested as u8);
    assert_eq!(card_by_id(&p, 1).state, CardState::ClaimRequested as u8, "Dust is paid, not voided");
    let v: VaultState = read(&e.svm, Ephemeral, &e.vault);
    assert_eq!((v.reserved_shares, v.available_shares_mirror), (0, 100_000_000 - 6_000));

    // Base layer: both actions ran. Payout receipts exist and the shares are in the player's wallet.
    let payout: Payout = read(&e.svm, Base, &payout_pda(&e, 0));
    assert_eq!(payout.shares, 5_000);
    let dust: Payout = read(&e.svm, Base, &payout_pda(&e, 1));
    assert_eq!(dust.shares, 1_000, "Dust = 0.2 × $1 ÷ $200 = 0.001 shares");
    assert_eq!(token_amount(&e.svm, &user_ata), 6_000);
    assert_eq!(token_amount(&e.svm, &vault_token), 100_000_000 - 6_000);

    // Client/keeper confirms the payout, then marks the slot settled (anyone may, with proof).
    let mark = ix(ix_data::MarkSettled { card_id: 0 }, scratchers::accounts::MarkSettled {
        authority: pk(&e.user.pubkey()), player: e.player, payout: payout_pda(&e, 0) });
    send(&mut e.svm, Ephemeral, &[&user], mark, "mark_settled");
    assert_eq!(card_by_id(&read_player(&e.svm, Ephemeral, &e.player), 0).state, CardState::Settled as u8);

    // A second pay_out for the same card is refused: exactly once.
    let again = keeper_pay_out_ix(&e, 0, vault_token, user_ata);
    let err = try_send(&mut e.svm, Base, &[&e.admin.insecure_clone()], again).unwrap_err();
    assert!(err.contains(&custom(ScratchError::AlreadyPaid)) || err.contains(&custom(ScratchError::BadState)), "{err}");
    assert_eq!(token_amount(&e.svm, &user_ata), 6_000, "no double pay");
}

#[test]
fn dropped_magic_action_is_repaired_by_keeper_exactly_once() {
    // MagicSVM runs the action atomically with the tx (a failing action rolls everything back), but a
    // real validator lands the commit and drops the action. Reconstruct that state: let claim_all
    // succeed, then erase the action's base-layer effects (receipt + token movement).
    let mut e = setup(10_000_000, 100_000_000, default_tiers());
    let (vault_token, user_ata) = prep_settlement(&mut e, true, true);
    buy_one_common_one_dust(&mut e);
    let user = e.user.insecure_clone();
    let claim = claim_ix(&e);
    send(&mut e.svm, Ephemeral, &[&user], claim, "claim_all");
    e.svm.set_account(addr(payout_pda(&e, 0)), solana_account::Account::default()).unwrap();
    e.svm.set_account(addr(user_ata), token_account(&e.mint, &pk(&user.pubkey()), 0)).unwrap();
    e.svm.set_account(addr(vault_token), token_account(&e.mint, &e.vault, 100_000_000)).unwrap();

    assert!(e.svm.get_account(&addr(payout_pda(&e, 0))).is_none(), "action dropped: no receipt");
    assert_eq!(card_by_id(&read_player(&e.svm, Base, &e.player), 0).state, CardState::ClaimRequested as u8, "commit landed");

    // The keeper (or anyone it delegates to) repairs it; it can only ever pay once.
    let admin = e.admin.insecure_clone();
    let repair = keeper_pay_out_ix(&e, 0, vault_token, user_ata);
    send(&mut e.svm, Base, &[&admin], repair, "keeper pay_out");
    assert_eq!(token_amount(&e.svm, &user_ata), 5_000);
    assert_eq!(token_amount(&e.svm, &vault_token), 100_000_000 - 5_000);
    let payout: Payout = read(&e.svm, Base, &payout_pda(&e, 0));
    assert_eq!(payout.shares, 5_000);

    let again = keeper_pay_out_ix(&e, 0, vault_token, user_ata);
    let err = try_send(&mut e.svm, Base, &[&admin], again).unwrap_err();
    assert!(err.contains(&custom(ScratchError::AlreadyPaid)), "second pay_out must be AlreadyPaid: {err}");
    assert_eq!(token_amount(&e.svm, &user_ata), 5_000, "no double pay");
}

#[test]
fn failing_action_does_not_commit_in_magicsvm_and_claim_can_be_retried() {
    // Missing stock ATA: the action fails. MagicSVM rolls the claim back (ER card stays Revealed), so a
    // retry after the wallet is ready succeeds and pays exactly once.
    let mut e = setup(10_000_000, 100_000_000, default_tiers());
    let (_, user_ata) = prep_settlement(&mut e, true, false);
    buy_one_common_one_dust(&mut e);
    let user = e.user.insecure_clone();
    let claim = claim_ix(&e);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], claim).unwrap_err();
    assert!(err.contains("Custom(3012)"), "AccountNotInitialized on the missing ATA: {err}");
    assert_eq!(card_by_id(&read_player(&e.svm, Ephemeral, &e.player), 0).state, CardState::Revealed as u8);
    assert_eq!(read::<VaultState>(&e.svm, Ephemeral, &e.vault).available_shares_mirror, 100_000_000, "accounting rolled back too");

    prep_settlement(&mut e, false, true);
    let claim = claim_ix(&e);
    send(&mut e.svm, Ephemeral, &[&user], claim, "claim_all retry");
    assert_eq!(token_amount(&e.svm, &user_ata), 6_000, "Common 5,000 + Dust 1,000");
}

#[test]
fn pay_out_is_not_callable_by_strangers() {
    let mut e = setup(10_000_000, 100_000_000, default_tiers());
    let (vault_token, user_ata) = prep_settlement(&mut e, true, true);
    buy_one_common_one_dust(&mut e);
    let user = e.user.insecure_clone();
    let claim = claim_ix(&e);
    send(&mut e.svm, Ephemeral, &[&user], claim, "claim_all");
    let attacker = Keypair::new();
    e.svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();
    let mut forged = keeper_pay_out_ix(&e, 0, vault_token, user_ata);
    forged.accounts[1] = AccountMeta::new(attacker.pubkey(), true); // keeper slot
    let err = try_send(&mut e.svm, Base, &[&attacker], forged).unwrap_err();
    assert!(err.contains(&custom(ScratchError::Unauthorized)), "{err}");

    // Calling the action entrypoint directly: the escrow cannot sign, so it is rejected.
    let escrow = ephemeral_balance_pda_from_payer(&e.player, 255);
    let direct = ix(ix_data::PayOutAction { card_id: 0 }, scratchers::accounts::PayOutAction {
        player: e.player, series: e.series, vault_state: e.vault, vault_token, dest: user_ata, stock_mint: e.mint,
        payout: payout_pda(&e, 0), token_program: anchor_spl::token::ID, system_program: system_program::ID,
        source_program: scratchers::ID, escrow_auth: e.player, escrow });
    let mut direct = direct;
    direct.accounts.iter_mut().find(|m| m.pubkey == addr(escrow)).unwrap().is_signer = false; // nobody can sign for it
    let err = try_send(&mut e.svm, Base, &[&attacker], direct).unwrap_err();
    assert!(err.contains(&custom(ScratchError::Unauthorized)), "{err}");
}

// ---- price and session rules through the real program ---------------------------------------------

fn push_price_ix(e: &Env, pusher: &Keypair, price: i64, ts: i64) -> Instruction {
    ix(ix_data::PushPrice { price, conf: 0, publish_ts: ts },
        scratchers::accounts::PushPrice { pusher: pk(&pusher.pubkey()), feed: e.feed })
}

#[test]
fn stale_price_pauses_sales_until_a_fresh_push() {
    let mut e = setup(5_000_000, 10_000_000_000, default_tiers());
    let user = e.user.insecure_clone();
    set_time(&mut e.svm, NOW + 61); // max staleness is 60 s
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], buy).unwrap_err();
    assert!(err.contains(&custom(ScratchError::PriceStale)), "{err}");

    push_price(&mut e, PRICE, NOW + 61);
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    send(&mut e.svm, Ephemeral, &[&user], buy, "buy after fresh push");
}

#[test]
fn buy_fails_when_price_exceeds_max_price() {
    let mut e = setup(5_000_000, 10_000_000_000, default_tiers());
    let user = e.user.insecure_clone();
    let buy = buy_ix(&e, &user, 1, PRICE as u64 - 1);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], buy).unwrap_err();
    assert!(err.contains(&custom(ScratchError::PriceAboveMax)), "{err}");
    let buy = buy_ix(&e, &user, 1, PRICE as u64); // exactly the price is fine
    send(&mut e.svm, Ephemeral, &[&user], buy, "buy at max_price");
}

#[test]
fn price_pushes_are_gated_banded_and_monotonic() {
    let mut e = setup(5_000_000, 10_000_000_000, default_tiers());
    let pusher = e.pusher.insecure_clone();
    // > 5% move (max_move_bps = 500) is rejected; ≤ 5% is accepted.
    let jump = push_price_ix(&e, &pusher, PRICE * 106 / 100, NOW + 1);
    let err = try_send(&mut e.svm, Ephemeral, &[&pusher], jump).unwrap_err();
    assert!(err.contains(&custom(ScratchError::PriceOutOfBand)), "{err}");
    let ok = push_price_ix(&e, &pusher, PRICE * 105 / 100, NOW + 1);
    send(&mut e.svm, Ephemeral, &[&pusher], ok, "5% move");
    // Non-increasing publish_ts is rejected.
    let replay = push_price_ix(&e, &pusher, PRICE, NOW + 1);
    let err = try_send(&mut e.svm, Ephemeral, &[&pusher], replay).unwrap_err();
    assert!(err.contains(&custom(ScratchError::PriceStale)), "{err}");
    // Only the registered pusher may sign.
    let user = e.user.insecure_clone();
    let rogue = push_price_ix(&e, &user, PRICE, NOW + 2);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], rogue).unwrap_err();
    assert!(err.contains(&custom(ScratchError::Unauthorized)), "{err}");
}

#[test]
fn a_different_feed_account_is_rejected() {
    let mut e = setup(5_000_000, 10_000_000_000, default_tiers());
    let user = e.user.insecure_clone();
    let mut buy = buy_ix(&e, &user, 1, u64::MAX);
    // Swap in the Player account as the "price feed": right program owner, wrong address.
    let slot = buy.accounts.iter().position(|m| m.pubkey == addr(e.feed)).unwrap();
    buy.accounts[slot].pubkey = addr(e.player);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], buy).unwrap_err();
    assert!(err.contains(&custom(ScratchError::WrongFeed)), "{err}");
}

#[test]
fn session_key_rules_expiry_cap_and_strangers() {
    let mut e = setup(20_000_000, 10_000_000_000, default_tiers());
    let session = e.session.insecure_clone();
    let sbuy = |e: &Env, n| buy_ix(e, &e.session.insecure_clone(), n, u64::MAX);

    // No session yet: the key is a stranger.
    let b = sbuy(&e, 1);
    let err = try_send(&mut e.svm, Ephemeral, &[&session], b).unwrap_err();
    assert!(err.contains(&custom(ScratchError::Unauthorized)), "{err}");

    // Valid session with a 2-card cap: two cards fit, the third exceeds the cap.
    create_session(&mut e, NOW + 3600, 2_000_000);
    let b = sbuy(&e, 2);
    send(&mut e.svm, Ephemeral, &[&session], b, "buy within cap");
    let b = sbuy(&e, 1);
    let err = try_send(&mut e.svm, Ephemeral, &[&session], b).unwrap_err();
    assert!(err.contains(&custom(ScratchError::SessionCapExceeded)), "{err}");

    // Valid session with no cap left stays blocked even though the balance is fine.
    assert_eq!(read_player(&e.svm, Ephemeral, &e.player).session_spend_remaining_e6, 0);

    // Expired session that still has a cap.
    create_session(&mut e, NOW + 100, 10_000_000);
    set_time(&mut e.svm, NOW + 100);
    push_price(&mut e, PRICE, NOW + 100); // keep the price fresh so only the session fails
    let b = sbuy(&e, 1);
    let err = try_send(&mut e.svm, Ephemeral, &[&session], b).unwrap_err();
    assert!(err.contains(&custom(ScratchError::SessionExpired)), "{err}");

    // Revoked session: the key is a stranger again; the authority still can buy.
    let user = e.user.insecure_clone();
    let revoke = ix(ix_data::RevokeSession {}, scratchers::accounts::Session { authority: pk(&user.pubkey()), player: e.player });
    send(&mut e.svm, Ephemeral, &[&user], revoke, "revoke_session");
    let b = sbuy(&e, 1);
    let err = try_send(&mut e.svm, Ephemeral, &[&session], b).unwrap_err();
    assert!(err.contains(&custom(ScratchError::Unauthorized)), "{err}");
    let own = buy_ix(&e, &user, 1, u64::MAX);
    send(&mut e.svm, Ephemeral, &[&user], own, "authority buys directly");
}

// ---- USDC in and out -----------------------------------------------------------------------------

/// Stand-ins for the rollup-side token accounts: the user's eSPL balance and the Config-owned treasury.
fn put_er_token(e: &mut Env, owner: &Pubkey, amount: u64) -> Pubkey {
    let a = ata(owner, &e.usdc);
    e.svm.set_account(addr(a), token_account(&e.usdc, owner, amount)).unwrap();
    e.svm.delegate_account(addr(a)).unwrap(); // owner on base becomes the delegation program; writable on the rollup
    a
}
fn er_token_amount(e: &Env, a: &Pubkey) -> u64 {
    u64::from_le_bytes(e.svm.get_account_for(Ephemeral, &addr(*a)).unwrap().data[64..72].try_into().unwrap())
}
fn funds_ix(e: &Env, signer: &Keypair, user_usdc: Pubkey, treasury: Pubkey, deposit: bool, amount: u64) -> Instruction {
    let accounts = scratchers::accounts::Funds {
        authority: pk(&signer.pubkey()), player: e.player, config: e.config, usdc_mint: e.usdc, user_usdc,
        treasury_auth: pda(&[b"treasury"]), treasury_usdc: treasury, token_program: anchor_spl::token::ID };
    if deposit { ix(ix_data::DepositUsdc { amount }, accounts) } else { ix(ix_data::WithdrawUsdc { amount }, accounts) }
}

#[test]
fn usdc_deposit_funds_the_ledger_and_withdraw_returns_it() {
    let mut e = setup(0, 10_000_000_000, default_tiers());
    let user = e.user.insecure_clone();
    let user_usdc = put_er_token(&mut e, &pk(&user.pubkey()), 50_000_000);
    let cfg = pda(&[b"treasury"]);
    let treasury = put_er_token(&mut e, &cfg, 0);

    let dep = funds_ix(&e, &user, user_usdc, treasury, true, 30_000_000);
    send(&mut e.svm, Ephemeral, &[&user], dep, "deposit_usdc");
    assert_eq!(read_player(&e.svm, Ephemeral, &e.player).usdc_balance_e6, 30_000_000);
    assert_eq!((er_token_amount(&e, &user_usdc), er_token_amount(&e, &treasury)), (20_000_000, 30_000_000));

    // The deposited balance is spendable on cards.
    let buy = buy_ix(&e, &user, 2, u64::MAX);
    send(&mut e.svm, Ephemeral, &[&user], buy, "buy with deposited funds");
    assert_eq!(read_player(&e.svm, Ephemeral, &e.player).usdc_balance_e6, 28_000_000);

    // Withdraw what is left; over-withdrawing is refused.
    let too_much = funds_ix(&e, &user, user_usdc, treasury, false, 28_000_001);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], too_much).unwrap_err();
    assert!(err.contains(&custom(ScratchError::InsufficientBalance)), "{err}");
    let wd = funds_ix(&e, &user, user_usdc, treasury, false, 28_000_000);
    send(&mut e.svm, Ephemeral, &[&user], wd, "withdraw_usdc");
    assert_eq!(read_player(&e.svm, Ephemeral, &e.player).usdc_balance_e6, 0);
    assert_eq!((er_token_amount(&e, &user_usdc), er_token_amount(&e, &treasury)), (48_000_000, 2_000_000));
}

#[test]
fn session_key_cannot_move_funds_in_or_out() {
    let mut e = setup(0, 10_000_000_000, default_tiers());
    create_session(&mut e, NOW + 3600, 20_000_000);
    let session = e.session.insecure_clone();
    let owner = pk(&e.user.pubkey());
    let user_usdc = put_er_token(&mut e, &owner, 50_000_000);
    let cfg = pda(&[b"treasury"]);
    let treasury = put_er_token(&mut e, &cfg, 10_000_000);
    // Signing as the session key: the player PDA seeds are derived from the signer, so it cannot name another player.
    for deposit in [true, false] {
        let mut i = funds_ix(&e, &session, user_usdc, treasury, deposit, 1_000_000);
        i.accounts.iter_mut().find(|m| m.pubkey == addr(e.player)).unwrap(); // the victim's Player is named
        let err = try_send(&mut e.svm, Ephemeral, &[&session], i).unwrap_err();
        assert!(err.contains("Custom(") || err.contains("Seeds"), "must be rejected: {err}");
    }
    assert_eq!(er_token_amount(&e, &treasury), 10_000_000);
    assert_eq!(er_token_amount(&e, &user_usdc), 50_000_000);
}

// ---- sell_to_vault (base layer) ----

const SELL_PRICE: u64 = 150 * 100_000_000;

struct Sell { quote: Pubkey, pool: Pubkey, vault_token: Pubkey, user_stock: Pubkey, user_usdc: Pubkey }

fn sell_setup(e: &mut Env, user_shares: u64, pool_usdc: u64) -> Sell {
    let (a, u) = (pk(&e.admin.pubkey()), pk(&e.user.pubkey()));
    let quote = pda(&[b"quote", e.mint.as_ref()]);
    let pool = ata(&e.config, &e.usdc);
    let admin = e.admin.insecure_clone();
    send(&mut e.svm, Base, &[&admin], ix(ix_data::InitSellQuote { price_e8: SELL_PRICE, ts: NOW },
        scratchers::accounts::InitSellQuote {
            config: e.config, quote, stock_mint: e.mint, usdc_mint: e.usdc, sell_pool: pool, admin: a,
            token_program: anchor_spl::token::ID, associated_token_program: anchor_spl::associated_token::ID,
            system_program: system_program::ID }), "init_sell_quote");
    e.svm.set_account(addr(pool), token_account(&e.usdc, &e.config, pool_usdc)).unwrap();
    let (vault_token, user_stock) = (ata(&e.vault, &e.mint), ata(&u, &e.mint));
    e.svm.set_account(addr(vault_token), token_account(&e.mint, &e.vault, 0)).unwrap();
    e.svm.set_account(addr(user_stock), token_account(&e.mint, &u, user_shares)).unwrap();
    Sell { quote, pool, vault_token, user_stock, user_usdc: ata(&u, &e.usdc) }
}
fn sell_ix(e: &Env, s: &Sell, who: &Keypair, shares: u64, min_usdc: u64) -> Instruction {
    ix(ix_data::SellToVault { shares, min_usdc_e6: min_usdc }, scratchers::accounts::SellToVault {
        user: pk(&who.pubkey()), config: e.config, quote: s.quote, stock_mint: e.mint, usdc_mint: e.usdc,
        user_stock: s.user_stock, vault: e.vault, vault_token: s.vault_token, sell_pool: s.pool, user_usdc: s.user_usdc,
        token_program: anchor_spl::token::ID, associated_token_program: anchor_spl::associated_token::ID,
        system_program: system_program::ID })
}
fn set_quote_ix(e: &Env, s: &Sell, who: &Keypair, price: u64, ts: i64) -> Instruction {
    ix(ix_data::SetSellQuote { price_e8: price, ts },
        scratchers::accounts::SetSellQuote { config: e.config, authority: pk(&who.pubkey()), quote: s.quote })
}

#[test]
fn sell_to_vault_pays_quote_less_spread_and_moves_shares() {
    let mut e = setup(0, 10_000_000_000, default_tiers());
    let s = sell_setup(&mut e, 2_000_000, 1_000_000_000);
    let user = e.user.insecure_clone();
    let i = sell_ix(&e, &s, &user, 1_000_000, 149_250_000);
    send(&mut e.svm, Base, &[&user], i, "sell 1 share");
    assert_eq!(token_amount(&e.svm, &s.user_usdc), 149_250_000, "$150 less 0.5%");
    assert_eq!(token_amount(&e.svm, &s.user_stock), 1_000_000);
    assert_eq!(token_amount(&e.svm, &s.vault_token), 1_000_000);
    assert_eq!(token_amount(&e.svm, &s.pool), 1_000_000_000 - 149_250_000);
    assert_eq!(read::<SellQuote>(&e.svm, Base, &s.quote).total_sold_shares, 1_000_000);
}

#[test]
fn sell_guards_slippage_staleness_pool_and_other_peoples_shares() {
    let mut e = setup(0, 10_000_000_000, default_tiers());
    let s = sell_setup(&mut e, 2_000_000, 100_000_000); // pool holds $100: less than one share's worth
    let user = e.user.insecure_clone();

    let i = sell_ix(&e, &s, &user, 1_000_000, 149_250_001);
    let err = try_send(&mut e.svm, Base, &[&user], i).unwrap_err();
    assert!(err.contains(&custom(ScratchError::SlippageExceeded)), "{err}");
    let i = sell_ix(&e, &s, &user, 1_000_000, 0);
    let err = try_send(&mut e.svm, Base, &[&user], i).unwrap_err();
    assert!(err.contains(&custom(ScratchError::InsufficientBalance)), "pool too small: {err}");

    // someone else cannot sell the user's shares
    let thief = Keypair::new();
    e.svm.airdrop(&thief.pubkey(), 1_000_000_000).unwrap();
    let i = sell_ix(&e, &s, &thief, 1, 0);
    assert!(try_send(&mut e.svm, Base, &[&thief], i).is_err());

    // stale quote: sales stop until the keeper posts a fresh one
    e.svm.set_account(addr(s.pool), token_account(&e.usdc, &e.config, 1_000_000_000)).unwrap();
    set_time(&mut e.svm, NOW + 91);
    let i = sell_ix(&e, &s, &user, 1_000_000, 0);
    let err = try_send(&mut e.svm, Base, &[&user], i).unwrap_err();
    assert!(err.contains(&custom(ScratchError::PriceStale)), "{err}");
    let admin = e.admin.insecure_clone(); // admin doubles as keeper in this fixture
    let i = set_quote_ix(&e, &s, &admin, SELL_PRICE + 1_000_000, NOW + 90);
    send(&mut e.svm, Base, &[&admin], i, "fresh quote");
    let i = sell_ix(&e, &s, &user, 1_000_000, 0);
    send(&mut e.svm, Base, &[&user], i, "sell after refresh");
}

#[test]
fn quote_updates_are_gated_monotonic_and_banded() {
    let mut e = setup(0, 10_000_000_000, default_tiers());
    let s = sell_setup(&mut e, 0, 0);
    let admin = e.admin.insecure_clone();
    set_time(&mut e.svm, NOW + 10);
    let stranger = Keypair::new();
    e.svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    let i = set_quote_ix(&e, &s, &stranger, SELL_PRICE, NOW + 5);
    let err = try_send(&mut e.svm, Base, &[&stranger], i).unwrap_err();
    assert!(err.contains(&custom(ScratchError::Unauthorized)), "{err}");
    let i = set_quote_ix(&e, &s, &admin, SELL_PRICE, NOW);
    let err = try_send(&mut e.svm, Base, &[&admin], i).unwrap_err();
    assert!(err.contains(&custom(ScratchError::PriceStale)), "non-increasing ts: {err}");
    let i = set_quote_ix(&e, &s, &admin, SELL_PRICE * 12 / 10, NOW + 5);
    let err = try_send(&mut e.svm, Base, &[&admin], i).unwrap_err();
    assert!(err.contains(&custom(ScratchError::PriceOutOfBand)), "+20% in one step: {err}");
    let i = set_quote_ix(&e, &s, &admin, SELL_PRICE * 105 / 100, NOW + 5);
    send(&mut e.svm, Base, &[&admin], i, "+5% ok");
    // after a long market gap the band does not apply (keeper walks feeds, quote just resets)
    set_time(&mut e.svm, NOW + 10_000);
    let i = set_quote_ix(&e, &s, &admin, SELL_PRICE * 2, NOW + 9_999);
    send(&mut e.svm, Base, &[&admin], i, "gap reset");
}

#[test]
fn ack_sold_only_moves_within_total_sold() {
    let mut e = setup(0, 10_000_000_000, default_tiers());
    let s = sell_setup(&mut e, 3_000_000, 1_000_000_000);
    let (user, admin) = (e.user.insecure_clone(), e.admin.insecure_clone());
    let i = sell_ix(&e, &s, &user, 3_000_000, 0);
    send(&mut e.svm, Base, &[&user], i, "sell 3");
    let ack = |e: &Env, n: u64, who: &Keypair| ix(ix_data::AckSold { total_synced: n },
        scratchers::accounts::AckSold { config: e.config, authority: pk(&who.pubkey()), quote: s.quote });
    let i = ack(&e, 3_000_001, &admin);
    let err = try_send(&mut e.svm, Base, &[&admin], i).unwrap_err();
    assert!(err.contains(&custom(ScratchError::BadState)), "{err}");
    let i = ack(&e, 3_000_000, &admin);
    send(&mut e.svm, Base, &[&admin], i, "ack");
    let i = ack(&e, 1_000_000, &admin);
    let err = try_send(&mut e.svm, Base, &[&admin], i).unwrap_err();
    assert!(err.contains(&custom(ScratchError::BadState)), "cannot move backwards: {err}");
    assert_eq!(read::<SellQuote>(&e.svm, Base, &s.quote).synced_sold_shares, 3_000_000);
}

// ---- Path A: MagicBlock oracle ----

const ORACLE_PROGRAM: Pubkey = Pubkey::from_str_const("PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd");

/// An oracle account in the live layout (`PriceUpdateV3`): stored exponent +8 like every real feed.
fn oracle_account(feed: &Pubkey, price: i64, publish_time: i64, owner: Pubkey) -> solana_account::Account {
    let mut d = vec![0xea, 0xa1, 0x0e, 0x24, 0xac, 0xef, 0x0f, 0xe8];
    d.extend_from_slice(&[0u8; 32]); // write_authority
    d.push(1); // VerificationLevel::Full
    d.extend_from_slice(feed.as_ref());
    d.extend_from_slice(&price.to_le_bytes());
    d.extend_from_slice(&0u64.to_le_bytes()); // conf: always 0 on the live oracle
    d.extend_from_slice(&8i32.to_le_bytes()); // exponent: always +8 (wrong; the series carries the real one)
    d.extend_from_slice(&publish_time.to_le_bytes());
    d.extend_from_slice(&(publish_time - 1).to_le_bytes());
    d.extend_from_slice(&price.to_le_bytes());
    d.extend_from_slice(&0u64.to_le_bytes());
    d.extend_from_slice(&1_000u64.to_le_bytes()); // posted_slot > 0
    d.push(0); // trailing byte, as on the live account
    solana_account::Account { lamports: 1_000_000_000, data: d, owner: addr(owner), executable: false, rent_epoch: 0 }
}

#[test]
fn oracle_series_reads_live_layout_and_enforces_band_owner_and_freshness() {
    let mut e = setup(20_000_000, 10_000_000_000, default_tiers());
    let (a, oracle_feed) = (pk(&e.admin.pubkey()), Pubkey::new_unique());
    let series2 = pda(&[b"series", &2u16.to_le_bytes()]);
    let tiers = default_tiers();
    let admin = e.admin.insecure_clone();
    let create = ix(ix_data::CreateSeries { args: scratchers::instructions::CreateSeriesArgs {
            id: 2, price_source: scratchers::price::PriceSource::MagicBlockOracle, feed: oracle_feed, feed_expo: -8,
            ticket_usd_e6: 1_000_000, tiers, total_weight: tiers.iter().map(|t| t.weight).sum(),
            demo: false, max_staleness_s: 60, max_move_bps: 500, max_conf_bps: 100, vrf_timeout_s: 120 } },
        scratchers::accounts::CreateSeries { config: e.config, series: series2, stock_mint: e.mint, admin: a, system_program: system_program::ID });
    send(&mut e.svm, Base, &[&admin], create, "create oracle series");
    let freeze = ix(ix_data::FreezeSeries {}, scratchers::accounts::FreezeSeries { config: e.config, series: series2, admin: a });
    send(&mut e.svm, Base, &[&admin], freeze, "freeze");
    // every series has its own delegated Stats
    let stats2 = pda(&[b"stats", &2u16.to_le_bytes()]);
    let init = ix(ix_data::InitStats { series_id: 2 }, scratchers::accounts::InitStats { config: e.config, series: series2, stats: stats2, admin: a, system_program: system_program::ID });
    send(&mut e.svm, Base, &[&admin], init, "init_stats 2");
    let owner = scratchers::ID;
    let del = ix(ix_data::DelegateStats { series_id: 2, validator: Some(e.validator) }, scratchers::accounts::DelegateStats {
        config: e.config, admin: a,
        buffer_stats: delegate_buffer_pda_from_delegated_account_and_owner_program(&stats2, &owner),
        delegation_record_stats: delegation_record_pda_from_delegated_account(&stats2),
        delegation_metadata_stats: delegation_metadata_pda_from_delegated_account(&stats2),
        stats: stats2, owner_program: owner, delegation_program: DelegationProgram::id(), system_program: system_program::ID });
    send(&mut e.svm, Base, &[&admin], del, "delegate_stats 2");
    (e.series, e.feed, e.stats) = (series2, oracle_feed, stats2);

    let put = |e: &mut Env, price: i64, ts: i64, owner: Pubkey| {
        // ER accounts use litesvm's own Account type: borrow one as a template and overwrite its fields
        let (built, mut acc) = (oracle_account(&oracle_feed, price, ts, owner), e.svm.ephemeral().get_account(&addr(e.player)).unwrap());
        (acc.data, acc.owner, acc.lamports, acc.executable) = (built.data, built.owner, built.lamports, false);
        e.svm.ephemeral_mut().set_account(addr(oracle_feed), acc).unwrap();
    };
    let user = e.user.insecure_clone();
    let vault_price = |e: &Env| read::<VaultState>(&e.svm, Ephemeral, &e.vault).last_oracle_price;

    // 1. live layout + wrong stored exponent: $200.00 must come out as 200e8, and the baseline is recorded
    put(&mut e, PRICE, NOW, ORACLE_PROGRAM);
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    send(&mut e.svm, Ephemeral, &[&user], buy, "buy on oracle price");
    assert_eq!(vault_price(&e), PRICE as u64);

    // 2. band: +6% in one step is rejected, +4% accepted
    set_time(&mut e.svm, NOW + 2);
    put(&mut e, PRICE * 106 / 100, NOW + 2, ORACLE_PROGRAM);
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], buy).unwrap_err();
    assert!(err.contains(&custom(ScratchError::PriceOutOfBand)), "{err}");
    put(&mut e, PRICE * 104 / 100, NOW + 2, ORACLE_PROGRAM);
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    send(&mut e.svm, Ephemeral, &[&user], buy, "buy within band");

    // 3. owner must be the oracle program (a look-alike account of ours is not accepted)
    put(&mut e, PRICE, NOW + 3, scratchers::ID);
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], buy).unwrap_err();
    assert!(err.contains(&custom(ScratchError::WrongFeed)), "{err}");

    // 4. stale oracle data pauses sales
    put(&mut e, PRICE, NOW + 2, ORACLE_PROGRAM);
    set_time(&mut e.svm, NOW + 2 + 61);
    let buy = buy_ix(&e, &user, 1, u64::MAX);
    let err = try_send(&mut e.svm, Ephemeral, &[&user], buy).unwrap_err();
    assert!(err.contains(&custom(ScratchError::PriceStale)), "{err}");
}
