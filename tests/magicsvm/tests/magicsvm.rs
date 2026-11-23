//! Day-1 gate: signup → delegate → session → buy 10 cards → VRF reveals, plus late/duplicate callbacks.
//! Needs `anchor build --arch v0` first (loads target/deploy/scratchers.so). Run: `cargo +stable test`.
use anchor_lang::{
    prelude::Pubkey, system_program, AccountDeserialize, AccountSerialize, Discriminator, Id, InstructionData,
    ToAccountMetas,
};
use ephemeral_rollups_sdk::{
    anchor::{DelegationProgram, MagicProgram},
    pda::{
        delegate_buffer_pda_from_delegated_account_and_owner_program, delegation_metadata_pda_from_delegated_account,
        delegation_record_pda_from_delegated_account,
    },
};
use magicsvm::{MagicSVM, TransactionTarget};
use scratchers::{
    error::ScratchError,
    instruction as ix_data,
    state::{Card, CardState, Config, Player, Series, Tier, VaultState},
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
    validator: Pubkey,
    player: Pubkey,
    vault: Pubkey,
    series: Pubkey,
    feed: Pubkey,
    config: Pubkey,
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

/// Series with the default 76% RTP table.
fn default_tiers() -> [Tier; 8] {
    let w = [(0, 61_858), (1, 25_000), (2, 10_000), (5, 2_000), (10, 1_000), (50, 100), (100, 40), (1000, 2)];
    w.map(|(multiplier, weight)| Tier { multiplier, weight })
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

    send(&mut svm, Base, &[&admin], ix(ix_data::InitConfig { keeper: a, usdc_mint: Pubkey::new_unique() },
        scratchers::accounts::InitConfig { config, admin: a, system_program: sys }), "init_config");
    send(&mut svm, Base, &[&admin], ix(
        ix_data::CreateSeries { args: scratchers::instructions::CreateSeriesArgs {
            id: 1, price_source: scratchers::price::PriceSource::SelfPushed, feed, feed_expo: -8,
            ticket_usd_e6: 1_000_000, tiers, total_weight: tiers.iter().map(|t| t.weight).sum(),
            demo: false, max_staleness_s: 60, max_move_bps: 500, max_conf_bps: 100, vrf_timeout_s: 120 } },
        scratchers::accounts::CreateSeries { config, series, stock_mint: mint, admin: a, system_program: sys }), "create_series");
    send(&mut svm, Base, &[&admin], ix(ix_data::FreezeSeries {},
        scratchers::accounts::FreezeSeries { config, series, admin: a }), "freeze_series");
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
    send(&mut svm, Base, &[&admin], ix(ix_data::DelegateFeed { feed_id: FEED_ID, validator: Some(validator) },
        scratchers::accounts::DelegateFeed {
            config, admin: a,
            buffer_feed: delegate_buffer_pda_from_delegated_account_and_owner_program(&feed, &owner),
            delegation_record_feed: delegation_record_pda_from_delegated_account(&feed),
            delegation_metadata_feed: delegation_metadata_pda_from_delegated_account(&feed),
            feed, owner_program: owner, delegation_program: DelegationProgram::id(), system_program: sys }), "delegate_feed");

    let mut env = Env { svm, admin, user, session, pusher, mint, validator, player, vault, series, feed, config };
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
        series: e.series, vault_state: e.vault, price_feed: e.feed, oracle_queue: QUEUE,
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
    let reserve_per = 1000 * 1_000_000u64 * 100_000_000 / PRICE as u64; // 1000x worst case
    assert_eq!(v.reserved_shares, 10 * reserve_per);
    assert_eq!(v.usdc_in_e6, 10_000_000);

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
        let shares = series.tiers[tier].multiplier as u64 * 1_000_000 * 100_000_000 / PRICE as u64;
        assert_eq!(c.shares, shares);
        expected_shares += shares;
    }
    // Excess reservation released: only actual winnings remain reserved.
    let v: VaultState = read(&e.svm, Ephemeral, &e.vault);
    assert_eq!(v.reserved_shares, expected_shares);
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
            vrf_program_identity: pk(&user.pubkey()), player: e.player, series: e.series, vault_state: e.vault });
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
