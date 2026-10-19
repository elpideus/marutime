import { APP_NAME, getEnv } from '@marutime/config';
import { NextResponse } from 'next/server';

/** Minimal OpenAPI description so mobile apps and plugins can generate clients. */
export function GET() {
  const base = `${getEnv().APP_URL}/api/v1`;
  const bearer = [{ bearerAuth: [] }];
  const spec = {
    openapi: '3.1.0',
    info: { title: `${APP_NAME} API`, version: '1.0.0', description: 'Personal access tokens are created in Settings → API tokens and sent as `Authorization: Bearer mtk_…`.' },
    servers: [{ url: base }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    paths: {
      '/me': { get: { summary: 'Current user with stats', security: bearer } },
      '/search': { get: { summary: 'Search titles', security: bearer, parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }, { name: 'type', in: 'query', schema: { type: 'string', enum: ['show', 'movie', 'all'] } }, { name: 'page', in: 'query', schema: { type: 'integer' } }] } },
      '/media/{type}/{id}': { get: { summary: 'Title details by TMDB id (imports on first access)', parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string', enum: ['show', 'movie'] } }, { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }] } },
      '/progress': { get: { summary: 'Watch next, upcoming and library', security: bearer, parameters: [{ name: 'include', in: 'query', schema: { type: 'string', example: 'next,upcoming,library' } }] } },
      '/watch': {
        post: {
          summary: 'Scrobble a viewing (episode or movie)',
          security: bearer,
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['type', 'tmdbId'], properties: { type: { type: 'string', enum: ['episode', 'movie'] }, tmdbId: { type: 'integer' }, season: { type: 'integer' }, episode: { type: 'integer' }, deviceSlug: { type: 'string' }, serviceSlug: { type: 'string' }, emotions: { type: 'array', items: { type: 'string', enum: ['good', 'fun', 'wow', 'sad', 'soso', 'bad'] } }, watchedAt: { type: 'string', format: 'date-time' }, rewatch: { type: 'boolean' }, note: { type: 'string' } } } } } },
        },
        delete: { summary: 'Remove viewings of an episode or movie', security: bearer },
      },
      '/watchlist': { get: { summary: 'Watchlist', security: bearer }, post: { summary: 'Add to watchlist', security: bearer }, delete: { summary: 'Remove from watchlist', security: bearer } },
      '/lists': { get: { summary: 'Your lists', security: bearer } },
      '/devices': { get: { summary: 'Device catalog' } },
      '/services': { get: { summary: 'Service catalog' } },
    },
  };
  return NextResponse.json(spec, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
}
