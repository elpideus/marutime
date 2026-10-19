-- Undo "follow everything" from a TV Time import made before the importer was fixed.
--
-- TV Time follows every show in your library, and early versions of the
-- importer copied that as a MaruTime follow. This script, for the shows that
-- came from your TV Time import(s):
--   1. puts the ones you haven't started on your watchlist (not the ones you
--      had archived in TV Time);
--   2. unfollows all of them (watch history is untouched), except favourites,
--      whose star lives on the follow and would otherwise be lost.
--
-- Run it once the import has finished: Neon console → SQL Editor, paste,
-- replace YOUR_USERNAME on the line marked below, Run. It is one transaction:
-- if anything fails, nothing changes.

begin;

create temporary table tvtime_fix on commit drop as
with me as (
  select id from users where lower(username) = lower('YOUR_USERNAME')  -- ← your MaruTime username
),
imported as (
  select distinct r.value::int as media_id
  from import_jobs j
  join me on j.user_id = me.id
  cross join lateral jsonb_each_text(j.resolved) as r
  join media m on m.id = r.value::int and m.type = 'show'
  where j.source = 'tvtime'
)
select
  me.id as user_id,
  i.media_id,
  exists (select 1 from watches w where w.user_id = me.id and w.media_id = i.media_id) as started
from imported i
cross join me;

-- 1. Followed by the import but not started yet → watchlist (keeps the date you added it
--    in TV Time). Shows you had archived there ("stopped watching", imported as dropped) and
--    shows that were only in one of your lists stay off it. Running the script again is harmless.
insert into watchlist (user_id, media_id, added_at)
select f.user_id, f.media_id, st.created_at
from tvtime_fix f
join show_tracking st on st.user_id = f.user_id and st.media_id = f.media_id
where not f.started
  and st.status <> 'dropped'
on conflict do nothing;

-- 2. Unfollow the imported shows, favourites excepted.
--    (To unfollow favourites too, delete the "and not st.is_favorite" line.)
delete from show_tracking st
using tvtime_fix f
where st.user_id = f.user_id
  and st.media_id = f.media_id
  and not st.is_favorite;

-- What happened (if both numbers are 0, check the username).
select
  count(*) as imported_shows,
  count(*) filter (where exists (select 1 from watchlist wl where wl.user_id = tvtime_fix.user_id and wl.media_id = tvtime_fix.media_id)) as on_watchlist,
  (select count(*) from show_tracking st join tvtime_fix f on f.user_id = st.user_id and f.media_id = st.media_id) as still_followed_favourites
from tvtime_fix;

commit;
