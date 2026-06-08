-- À exécuter dans Supabase Dashboard > SQL Editor
--
-- Verrouille les tables de votes/résultats sur le même principe que `users`
-- (voir 04_lock_down_users_table.sql) : les RPC de missions (01-03) écrivent
-- déjà via `security definer` (donc avec les droits du propriétaire de la
-- table, qui contournent la RLS), mais rien n'empêchait jusqu'ici un client
-- malveillant d'écrire directement dans ces tables, par ex :
--   - db.from('pouls_votes').insert({...})    → se forger des votes / fausser les stats
--   - db.from('pouls_votes').delete()         → supprimer les votes d'autres joueurs
--   - db.from('pronostic_votes')/('boite_winners')...insert/update/delete → idem
--   - db.from('games').update({...})          → modifier le contenu des missions du jour

-- ── games ──────────────────────────────────────────────────────────────────
-- Contenu des missions du jour : lecture publique pour les authentifiés,
-- aucune écriture cliente (table alimentée hors de l'app).
alter table public.games enable row level security;

drop policy if exists "games_select_all" on public.games;
create policy "games_select_all" on public.games
  for select to authenticated using (true);

revoke insert, update, delete on public.games from authenticated;


-- ── pouls_votes ────────────────────────────────────────────────────────────
-- Lecture publique (stats communautaires "Pouls du Club"), écriture
-- exclusivement via submit_pouls_vote() (security definer, voir 01_*.sql).
-- Seule exception cliente directe : suppression de ses propres votes lors
-- de la fermeture de compte (voir deleteAccount() dans index.html).
alter table public.pouls_votes enable row level security;

drop policy if exists "pouls_votes_select_all" on public.pouls_votes;
create policy "pouls_votes_select_all" on public.pouls_votes
  for select to authenticated using (true);

drop policy if exists "pouls_votes_delete_own" on public.pouls_votes;
create policy "pouls_votes_delete_own" on public.pouls_votes
  for delete to authenticated using (auth.uid() = user_id);

revoke insert, update on public.pouls_votes from authenticated;


-- ── pronostic_votes ────────────────────────────────────────────────────────
-- Lecture publique (résultats du pronostic du match), écriture exclusivement
-- via submit_pronostic() (security definer, voir 02_*.sql). Aucune écriture
-- ni suppression cliente directe.
alter table public.pronostic_votes enable row level security;

drop policy if exists "pronostic_votes_select_all" on public.pronostic_votes;
create policy "pronostic_votes_select_all" on public.pronostic_votes
  for select to authenticated using (true);

revoke insert, update, delete on public.pronostic_votes from authenticated;


-- ── boite_winners ──────────────────────────────────────────────────────────
-- Table d'audit pure, jamais lue par le client (le contenu affiché vient de
-- `games`/`profile.boite_last_result`), alimentée uniquement par
-- open_boite_mystere() (security definer, voir 02_*/03_*.sql). On ferme tout
-- accès direct côté client, lecture comprise.
alter table public.boite_winners enable row level security;

revoke select, insert, update, delete on public.boite_winners from authenticated;
