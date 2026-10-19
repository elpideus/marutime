-- Unfollow every show you follow but have never watched an episode of, and
-- put it on your watchlist instead. Meant for accounts filled by an early TV
-- Time import (TV Time follows everything in your library, and the importer
-- copied that), but it applies to every followed show without a single
-- watched episode, wherever the follow came from.
--
-- Shows you marked as dropped are just unfollowed, not added to the watchlist.
-- A favourite star on a show you never started goes with the follow.
-- Watch history is not touched.
--
-- Neon console → SQL Editor → paste → replace YOUR_USERNAME (twice) → Run.

-- 1. Optional preview: what will be unfollowed.
select m.title, st.status, st.is_favorite as favourite, st.created_at as followed_since
from show_tracking st
join users u on u.id = st.user_id
join media m on m.id = st.media_id
where lower(u.username) = lower('YOUR_USERNAME')
  and not exists (select 1 from watches w where w.user_id = st.user_id and w.media_id = st.media_id)
order by m.title;

-- 2. The change. One statement, so it either happens completely or not at all;
--    running it again does nothing.
with me as (
  select id from users where lower(username) = lower('YOUR_USERNAME')
),
never_started as (
  select st.user_id, st.media_id, st.status, st.created_at, st.is_favorite
  from show_tracking st
  join me on st.user_id = me.id
  where not exists (select 1 from watches w where w.user_id = st.user_id and w.media_id = st.media_id)
),
to_watchlist as (
  insert into watchlist (user_id, media_id, added_at)
  select user_id, media_id, created_at from never_started where status <> 'dropped'
  on conflict do nothing
  returning media_id
),
unfollowed as (
  delete from show_tracking st
  using never_started n
  where st.user_id = n.user_id and st.media_id = n.media_id
  returning st.media_id
)
select
  (select count(*) from unfollowed) as unfollowed,
  (select count(*) from never_started where is_favorite) as of_which_favourites,
  (select count(*) from to_watchlist) as newly_on_watchlist;
