-- Clear every favourite star on your shows (for example ones carried over from
-- a TV Time import). Follows, watch history and the watchlist are untouched.
-- Neon console → SQL Editor → paste → replace YOUR_USERNAME → Run.
-- Lists the shows it unfavourited; running it again changes nothing.

update show_tracking st
set is_favorite = false, updated_at = now()
from users u
where u.id = st.user_id
  and lower(u.username) = lower('YOUR_USERNAME')
  and st.is_favorite
returning (select m.title from media m where m.id = st.media_id) as unfavourited;
