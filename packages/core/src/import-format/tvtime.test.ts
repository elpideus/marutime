import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCsv } from './csv';
import { importItemsSchema } from './schema';
import { parseTvTime } from './tvtime';

test('parseCsv handles quotes, commas and newlines inside fields', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n'), [
    ['a', 'b'],
    ['x, y', 'say "hi"\nthere'],
  ]);
});

const V2 = [
  'key,user_id,created_at,s_id,ep_id,gsi,s_no,runtime,ep_no,total_series_runtime,total_movies_runtime,ep_watch_count,movie_watch_count,series_follow_count,updated_at,is_for_later,is_archived,followed_at,uuid,is_followed,most_recent_ep_watched,rewatch_count,is_unitary,bulk_type,movie_name,series_name,season_number,episode_number',
  'watch-episode-a-1,1,2019-05-07 21:58:06,9001,90011001,,1,,1,,,,,,,,,,,,,0,true,,,Harbor Lights,1,1',
  'watch-episode-a-2,1,2019-05-08 21:58:06,9001,90011002,,1,,2,,,,,,,,,,,,,0,true,,,Harbor Lights,1,2',
  'rewatch-episode-a-1-1,1,2021-01-01 10:00:00,9001,90011001,,,,,,,,,,,,,,,,,,,,,Harbor Lights,1,1',
  'user-series-u1,1,2019-05-01 00:00:00,9001,,,,,,,,2,,,,false,false,1556668800000000,u1,true,,,,,,Harbor Lights,,',
  'user-series-u2,1,2020-01-01 00:00:00,9003,,,,,,,,0,,,,true,false,1577836800000000,u2,true,,,,,,Endless Tide,,',
  'user-series-u3,1,2020-01-01 00:00:00,9002,,,,,,,,0,,,,false,true,1577836800000000,u3,true,,,,,,Paper Lantern Academy,,',
].join('\n');

const V1 = [
  'user_id,updated_at,created_at,uuid,watch_count,type,type-uuid-n,series_id,watches,alpha_range_key,runtime,release_date,release_date_range_key,follow_date_range_key,entity_type,rewatch_count,watch_date,episode_id,series_uuid,season_number,episode_number,total_movies_runtime,total_series_runtime,country,watched_episode_range_key,unitarian,watch_date_range_key,bulk_type,movie_name,series_name',
  '1,2019-09-15 13:07:27,2019-09-15 13:07:27,m-1,,follow,follow-m-1-0,,,,5880,2024-03-01 00:00:00,,,movie,0,,,,,,,,,,,,,The Quiet Orbit,',
  '1,2019-09-15 13:07:27,2019-09-15 13:07:27,m-1,,watch,watch-m-1-0,,,,,0001-01-01 00:00:00,,,movie,0,,,,,,,,,,,,,The Quiet Orbit,',
  '1,2025-03-05 15:35:49,2025-03-05 15:35:49,m-1,,rewatch,rewatch-m-1-1,,,,5880,,,,movie,1,,,,,,,,,,,,,The Quiet Orbit,',
  '1,2024-02-26 07:22:45,2024-02-26 07:22:45,m-2,,towatch,towatch-m-2,,,,7080,2025-07-04 00:00:00,,,movie,,,,,,,,,,,,,,Summer of the Fox,',
  '1,2021-05-10 13:19:26,2021-05-10 13:19:26,w-1,,watch,watch-w-1-0,9001,,,,,,,episode,,1620652766,90012001,s-1,2,1,,,us,,true,,,,Harbor Lights',
].join('\n');

const LISTS = [
  's_key,is_public,description,updated_at,objects,ordering,name,type,user_id,created_at,lists,list_count,movie_name,series_name,season_number,episode_number',
  'abc,true,,2019-07-17 16:58:44,[map[created_at:1.5e+09 filter:<nil> id:9001 meta:<nil> sorting:<nil> type:series uuid:<nil>] map[created_at:1.5e+09 type:movie uuid:m-1]],1,,list,1,2019-07-17 16:58:44,,,,,,',
  'favorite-series,false,,,[map[created_at:1.5e+09 id:9003 type:series]],0,,list,1,2021-10-03 22:13:14,,,,,,',
  'collection,,,,,,,,,,[map[created_at:1.5e+09 description:Comfort watches fanart:[x y] is_public:true name:Cosy Picks order:<nil> posters:[x] s_key:abc type:list updated_at:1.5e+09 user_id:1]],,,,,',
].join('\n');

test('parseTvTime turns an export into shows, movies and lists', () => {
  const items = parseTvTime({ 'tracking-prod-records-v2.csv': V2, 'tracking-prod-records.csv': V1, 'lists-prod-lists.csv': LISTS });
  assert.ok(importItemsSchema.safeParse(items).success);

  const harbor = items.find((i) => i.kind === 'show' && i.ids.tvdb === 9001);
  assert.ok(harbor && harbor.kind === 'show');
  // In the TV Time library but not a favourite: not followed. It is a watchlist candidate, which only sticks if nothing is watched.
  assert.equal(harbor.follow, false);
  assert.equal(harbor.watchlist, true);
  assert.equal(harbor.addedAt, 1556668800);
  // Two first viewings, one rewatch, and the older-format watch of S2E1.
  assert.deepEqual(
    harbor.episodes?.map(([s, e, , id]) => [s, e, id]),
    [
      [1, 1, 90011001],
      [1, 2, 90011002],
      [1, 1, 90011001],
      [2, 1, 90012001],
    ],
  );

  // Favourites are the one thing that is followed.
  const tide = items.find((i) => i.kind === 'show' && i.ids.tvdb === 9003);
  assert.ok(tide && tide.kind === 'show' && tide.watchlist && tide.favorite && tide.follow);
  // Archived ("stopped watching") stays off the watchlist.
  const lantern = items.find((i) => i.kind === 'show' && i.ids.tvdb === 9002);
  assert.ok(lantern && lantern.kind === 'show' && lantern.status === 'dropped' && !lantern.watchlist && !lantern.follow);

  const orbit = items.find((i) => i.kind === 'movie' && i.title === 'The Quiet Orbit');
  assert.ok(orbit && orbit.kind === 'movie');
  assert.equal(orbit.year, 2024);
  assert.equal(orbit.runtime, 98);
  assert.equal(orbit.watches?.length, 2);
  const fox = items.find((i) => i.kind === 'movie' && i.title === 'Summer of the Fox');
  assert.ok(fox && fox.kind === 'movie' && fox.watchlist && fox.watches?.length === 0);

  const list = items.find((i) => i.kind === 'list');
  assert.ok(list && list.kind === 'list');
  assert.equal(list.title, 'Cosy Picks');
  assert.equal(list.description, 'Comfort watches');
  assert.deepEqual(list.items, ['tvtime:s:9001', 'tvtime:m:m-1']);
  // Lists come after the titles they point at.
  assert.equal(items.at(-1)?.kind, 'list');
});
