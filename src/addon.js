const { getProfile, getGenres, getWatchlist, getHistory } = require('./db');
const tmdb = require('./tmdb');

// Manifest factory per profile
function buildManifest(profile) {
    return {
        id: `com.kurror.stremio-profiles.${profile.id}`,
        version: '1.0.0',
        name: `${profile.avatar} ${profile.name}`,
        description: `Perfil personal de ${profile.name} — catálogos y watchlist propios`,
        logo: 'https://i.imgur.com/qJSx6oP.png',
        resources: ['catalog', 'meta'],
        types: ['movie', 'series'],
        idPrefixes: ['tmdb:'],
        catalogs: [
            {
                id: 'profile-watchlist',
                type: 'movie',
                name: `${profile.avatar} Mi Lista (Películas)`,
                extra: [{ name: 'skip' }],
            },
            {
                id: 'profile-watchlist',
                type: 'series',
                name: `${profile.avatar} Mi Lista (Series)`,
                extra: [{ name: 'skip' }],
            },
            {
                id: 'profile-recommended',
                type: 'movie',
                name: `${profile.avatar} Recomendadas`,
                extra: [{ name: 'skip' }],
            },
            {
                id: 'profile-recommended',
                type: 'series',
                name: `${profile.avatar} Series Recomendadas`,
                extra: [{ name: 'skip' }],
            },
            {
                id: 'profile-history',
                type: 'movie',
                name: `${profile.avatar} Historial`,
                extra: [{ name: 'skip' }],
            },
            {
                id: 'profile-history',
                type: 'series',
                name: `${profile.avatar} Historial (Series)`,
                extra: [{ name: 'skip' }],
            },
        ],
    };
}

async function handleCatalog(profileId, catalogId, type, extra = {}) {
    const profile = getProfile(profileId);
    if (!profile) return { metas: [] };

    const skip = parseInt(extra.skip) || 0;
    const page = Math.floor(skip / 20) + 1;

    if (catalogId === 'profile-watchlist') {
        const list = getWatchlist(profileId).filter(i => i.item_type === type);
        const metas = list.slice(skip, skip + 20).map(i => ({
            id: i.item_id,
            type: i.item_type,
            name: i.name,
            poster: i.poster,
        }));
        return { metas };
    }

    if (catalogId === 'profile-history') {
        const list = getHistory(profileId, 100).filter(i => i.item_type === type);
        const metas = list.slice(skip, skip + 20).map(i => ({
            id: i.item_id,
            type: i.item_type,
            name: i.name,
            poster: i.poster,
        }));
        return { metas };
    }

    if (catalogId === 'profile-recommended') {
        const genres = getGenres(profileId);
        const metas = genres.length > 0
            ? await tmdb.getByGenres(type, genres, page)
            : await tmdb.getTrending(type, page);
        return { metas };
    }

    return { metas: [] };
}

async function handleMeta(profileId, type, id) {
    // id format: tmdb:movie:12345 or tmdb:series:12345
    const parts = id.split(':');
    if (parts[0] !== 'tmdb' || parts.length < 3) return { meta: null };
    const tmdbType = parts[1];
    const tmdbId = parts[2];
    const meta = await tmdb.getDetails(tmdbType, tmdbId);
    return { meta };
}

module.exports = { buildManifest, handleCatalog, handleMeta };
