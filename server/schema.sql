-- CryptoQuest — schéma Supabase (Postgres)
-- Lot C : comptes + sauvegarde en ligne (table saves).
-- Lot D : le serveur fait autorité. Les monnaies ne s'écrivent QUE par des fonctions « security definer »,
--         et chaque mouvement passe par le journal immuable `ledger`.
-- À exécuter dans l'éditeur SQL d'un projet Supabase DÉDIÉ à CryptoQuest (aucune table partagée avec un autre projet).

create extension if not exists pgcrypto;

-- ============================================================
-- Lot C : profils et sauvegardes
-- ============================================================
create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Aventurier' check (char_length(name) between 2 and 18),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  banned boolean not null default false
);

create table if not exists public.saves (
  player_id uuid primary key references public.players(id) on delete cascade,
  data jsonb not null,
  version int not null,
  device text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Lot D : économie qui fait autorité
-- ============================================================
create table if not exists public.wallets (
  player_id uuid primary key references public.players(id) on delete cascade,
  cq bigint not null default 300 check (cq >= 0),
  fp bigint not null default 40 check (fp >= 0),
  gems bigint not null default 0 check (gems >= 0),
  honor bigint not null default 0 check (honor >= 0),
  crypto numeric(18, 6) not null default 0 check (crypto >= 0),
  energy numeric(10, 3) not null default 1000,
  energy_at timestamptz not null default now()
);

-- journal immuable de chaque mouvement (source de l'historique et de l'audit)
create table if not exists public.ledger (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  cur text not null check (cur in ('cq', 'fp', 'gems', 'honor', 'crypto')),
  amount numeric(20, 6) not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_player_time on public.ledger (player_id, created_at desc);

create table if not exists public.items (
  id bigserial primary key,
  player_id uuid references public.players(id) on delete cascade,
  data jsonb not null,               -- emplacement, rareté, niveau, valeurs, préfixe, suffixe, ensemble, unique
  equipped_slot text,
  bound boolean not null default false,
  location text not null default 'bag' check (location in ('bag', 'market', 'mail', 'guild')),
  created_at timestamptz not null default now()
);
create index if not exists items_player on public.items (player_id, location);

-- lots de combat simulés par le serveur (graine + résultat), pour l'audit et la rediffusion
create table if not exists public.combat_batches (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  zone int not null, energy int not null, seed bigint not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- Crypto Pool
create table if not exists public.pool_cycles (
  id bigserial primary key,
  starts_at timestamptz not null, ends_at timestamptz not null,
  revenue_usd numeric(14, 4) not null default 0,  -- revenus réellement encaissés (pubs, offres, boutique, abonnements)
  share numeric(4, 3) not null default 0.70,
  settled_at timestamptz
);
create table if not exists public.pool_entries (
  cycle_id bigint not null references public.pool_cycles(id),
  player_id uuid not null references public.players(id) on delete cascade,
  fp bigint not null check (fp > 0),
  reward_usd numeric(18, 6),
  primary key (cycle_id, player_id)
);

create table if not exists public.stakes (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  fp bigint not null check (fp >= 10), mult numeric(4, 2) not null,
  starts_at timestamptz not null default now(), ends_at timestamptz not null, released boolean not null default false
);

-- Marché entre joueurs (CQ) et hôtel des ventes (lots du système, mises en FP)
create table if not exists public.market_listings (
  id bigserial primary key,
  seller_id uuid not null references public.players(id) on delete cascade,
  item_id bigint not null references public.items(id),
  price bigint not null check (price > 0),
  ends_at timestamptz not null, sold_to uuid references public.players(id), sold_at timestamptz
);
create table if not exists public.auction_lots (
  id bigserial primary key,
  round bigint not null, item jsonb, cons jsonb,
  start_fp bigint not null, buyout_gems bigint not null,
  bid_fp bigint not null default 0, bidder uuid references public.players(id),
  ends_at timestamptz not null, done boolean not null default false
);
create table if not exists public.mailbox (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  title text not null, sender text not null default 'Système',
  payload jsonb not null, claimed_at timestamptz, created_at timestamptz not null default now()
);

-- Arène
create table if not exists public.arena (
  player_id uuid primary key references public.players(id) on delete cascade,
  glory int not null default 1000, best int not null default 1000,
  tickets int not null default 10, tickets_at timestamptz not null default now(),
  snapshot jsonb,                    -- stats du héros au dernier combat (pour être affronté hors ligne)
  season text
);
create table if not exists public.arena_fights (
  id bigserial primary key,
  attacker uuid not null references public.players(id), defender uuid not null references public.players(id),
  seed bigint not null, win boolean not null, delta int not null, created_at timestamptz not null default now()
);

-- Guildes
create table if not exists public.guilds (
  id bigserial primary key,
  name text unique not null, tag text unique not null check (char_length(tag) between 2 and 4),
  emblem text not null default '🛡️', motto text,
  treasury bigint not null default 0 check (treasury >= 0),
  buildings jsonb not null default '{"hall":1,"treasury":1}',
  created_at timestamptz not null default now()
);
create table if not exists public.guild_members (
  guild_id bigint not null references public.guilds(id) on delete cascade,
  player_id uuid primary key references public.players(id) on delete cascade,
  rank text not null default 'recrue' check (rank in ('chef', 'bras', 'officier', 'veteran', 'membre', 'recrue')),
  contrib bigint not null default 0, joined_at timestamptz not null default now()
);
create table if not exists public.guild_log (
  id bigserial primary key, guild_id bigint not null references public.guilds(id) on delete cascade,
  text text not null, created_at timestamptz not null default now()
);
create table if not exists public.guild_raids (
  guild_id bigint not null references public.guilds(id) on delete cascade, week text not null,
  boss text not null, max_hp bigint not null, dmg bigint not null default 0,
  primary key (guild_id, week)
);
create table if not exists public.guild_raid_hits (
  guild_id bigint not null, week text not null, player_id uuid not null references public.players(id),
  dmg bigint not null default 0, primary key (guild_id, week, player_id)
);

-- Abonnement Légion (renseigné par le prestataire de paiement, jamais par le client)
create table if not exists public.subscriptions (
  player_id uuid primary key references public.players(id) on delete cascade,
  until timestamptz not null, provider text, provider_ref text, auto_renew boolean not null default true
);

-- ============================================================
-- Sécurité : chacun ne lit que ses lignes ; les écritures sensibles passent par les fonctions
-- ============================================================
alter table public.players enable row level security;
alter table public.saves enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger enable row level security;
alter table public.items enable row level security;
alter table public.mailbox enable row level security;
alter table public.stakes enable row level security;
alter table public.pool_entries enable row level security;
alter table public.arena enable row level security;
alter table public.guild_members enable row level security;
alter table public.subscriptions enable row level security;
-- toutes les autres tables aussi : sans règle, personne n'y accède par l'API ;
-- seules les fonctions « security definer » ci-dessous les lisent et les écrivent
alter table public.combat_batches enable row level security;
alter table public.pool_cycles enable row level security;
alter table public.market_listings enable row level security;
alter table public.auction_lots enable row level security;
alter table public.arena_fights enable row level security;
alter table public.guilds enable row level security;
alter table public.guild_log enable row level security;
alter table public.guild_raids enable row level security;
alter table public.guild_raid_hits enable row level security;

create policy "players: lecture et nom" on public.players for select using (auth.uid() = id);
create policy "players: création" on public.players for insert with check (auth.uid() = id);
create policy "players: renommer" on public.players for update using (auth.uid() = id) with check (auth.uid() = id);

-- Lot C : la sauvegarde complète est écrite par le client (le client fait encore foi à ce stade)
create policy "saves: lecture" on public.saves for select using (auth.uid() = player_id);
create policy "saves: écriture" on public.saves for insert with check (auth.uid() = player_id);
create policy "saves: mise à jour" on public.saves for update using (auth.uid() = player_id) with check (auth.uid() = player_id);

-- Lot D : lecture seule côté client
create policy "wallets: lecture" on public.wallets for select using (auth.uid() = player_id);
create policy "ledger: lecture" on public.ledger for select using (auth.uid() = player_id);
create policy "items: lecture" on public.items for select using (auth.uid() = player_id);
create policy "mailbox: lecture" on public.mailbox for select using (auth.uid() = player_id);
create policy "stakes: lecture" on public.stakes for select using (auth.uid() = player_id);
create policy "pool: lecture" on public.pool_entries for select using (auth.uid() = player_id);
create policy "arena: lecture" on public.arena for select using (true);
create policy "guild_members: lecture" on public.guild_members for select using (true);
create policy "subscriptions: lecture" on public.subscriptions for select using (auth.uid() = player_id);
-- données publiques du jeu : lecture seule pour les joueurs connectés
create policy "pool_cycles: lecture" on public.pool_cycles for select to authenticated using (true);
create policy "market: lecture" on public.market_listings for select to authenticated using (sold_to is null);
create policy "enchères: lecture" on public.auction_lots for select to authenticated using (true);
create policy "guildes: lecture" on public.guilds for select to authenticated using (true);
create policy "journal de guilde: membres" on public.guild_log for select to authenticated
  using (guild_id in (select guild_id from public.guild_members where player_id = auth.uid()));
create policy "raids: membres" on public.guild_raids for select to authenticated
  using (guild_id in (select guild_id from public.guild_members where player_id = auth.uid()));
create policy "combats d'arène: les siens" on public.arena_fights for select to authenticated using (auth.uid() in (attacker, defender));
create policy "lots de combat: les siens" on public.combat_batches for select using (auth.uid() = player_id);

-- ============================================================
-- Fonctions qui font autorité (appelées par les Edge Functions ou en RPC)
-- ============================================================

-- mouvement de monnaie atomique : refuse tout solde négatif, écrit le journal
create or replace function public.apply_ledger(p_player uuid, p_cur text, p_amount numeric, p_reason text, p_ref text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  execute format('update wallets set %I = %I + $1 where player_id = $2 returning %I', p_cur, p_cur, p_cur)
    into v using p_amount, p_player;
  if v is null then raise exception 'portefeuille introuvable'; end if;
  if v < 0 then raise exception 'solde insuffisant'; end if;
  insert into ledger (player_id, cur, amount, reason, ref) values (p_player, p_cur, p_amount, p_reason, p_ref);
  return v;
end $$;
revoke all on function public.apply_ledger from public, anon, authenticated;

-- énergie calculée à partir de l'horodatage (même règle que le client)
create or replace function public.energy_now(p_player uuid, p_max numeric, p_regen numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select case when energy >= p_max then energy
    else least(p_max, energy + p_regen * extract(epoch from (now() - energy_at)) / 3600) end
  from wallets where player_id = p_player
$$;

-- création du joueur à l'inscription
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into players (id) values (new.id) on conflict do nothing;
  insert into wallets (player_id) values (new.id) on conflict do nothing;
  insert into arena (player_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- dépôt au Crypto Pool : FP détruits, part enregistrée sur le cycle en cours
create or replace function public.pool_deposit(p_fp bigint) returns bigint language plpgsql security definer set search_path = public as $$
declare c bigint;
begin
  if p_fp < 1 then raise exception 'montant invalide'; end if;
  select id into c from pool_cycles where settled_at is null and now() between starts_at and ends_at order by id desc limit 1;
  if c is null then raise exception 'aucun cycle ouvert'; end if;
  perform apply_ledger(auth.uid(), 'fp', -p_fp, 'Crypto Pool : FP sacrifiés', 'cycle:' || c);
  insert into pool_entries (cycle_id, player_id, fp) values (c, auth.uid(), p_fp)
    on conflict (cycle_id, player_id) do update set fp = pool_entries.fp + excluded.fp;
  return c;
end $$;
grant execute on function public.pool_deposit to authenticated;

-- clôture d'un cycle (tâche planifiée pg_cron à minuit) : 70 % des revenus au prorata des FP
create or replace function public.settle_pool(p_cycle bigint) returns void language plpgsql security definer set search_path = public as $$
declare total numeric; pot numeric; r record;
begin
  select sum(fp) into total from pool_entries where cycle_id = p_cycle;
  select revenue_usd * share into pot from pool_cycles where id = p_cycle and settled_at is null for update;
  if pot is null then return; end if;
  if coalesce(total, 0) > 0 then
    for r in select player_id, fp from pool_entries where cycle_id = p_cycle loop
      update pool_entries set reward_usd = round(pot * r.fp / total, 6) where cycle_id = p_cycle and player_id = r.player_id;
      perform apply_ledger(r.player_id, 'crypto', round(pot * r.fp / total, 6), 'Crypto Pool n°' || p_cycle, 'cycle:' || p_cycle);
    end loop;
  end if;
  update pool_cycles set settled_at = now() where id = p_cycle;
  insert into pool_cycles (starts_at, ends_at) values (date_trunc('day', now()), date_trunc('day', now()) + interval '1 day');
end $$;
revoke all on function public.settle_pool from public, anon, authenticated;

-- don au trésor de guilde (CQ uniquement)
create or replace function public.guild_donate(p_cq bigint) returns bigint language plpgsql security definer set search_path = public as $$
declare g bigint; t bigint;
begin
  if p_cq < 100 then raise exception 'don minimum : 100 CQ'; end if;
  select guild_id into g from guild_members where player_id = auth.uid();
  if g is null then raise exception 'pas de guilde'; end if;
  perform apply_ledger(auth.uid(), 'cq', -p_cq, 'Don à la guilde', 'guild:' || g);
  update guilds set treasury = treasury + p_cq where id = g returning treasury into t;
  update guild_members set contrib = contrib + p_cq where player_id = auth.uid();
  insert into guild_log (guild_id, text) values (g, (select name from players where id = auth.uid()) || ' donne ' || p_cq || ' CQ.');
  return t;
end $$;
grant execute on function public.guild_donate to authenticated;

-- planification (à activer après avoir activé l'extension pg_cron dans le tableau de bord) :
-- select cron.schedule('cloture-pool', '0 0 * * *', $$ select settle_pool(id) from pool_cycles where settled_at is null and ends_at <= now() $$);
