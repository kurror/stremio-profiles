const { getProfile, getGenres, getWatchlist, getHistory } = require('./db');

function buildManifest(profile) {
    return {
        id: `com.kurror.stremio-profiles.${profile.id}`,
        version: '1.0.0',
        name: `${profile.avatar} ${profile.name}`,
        description: `Perfil de ${profile.name} — watchlist e historial propios`,
        logo: 'https://dl.strem.io/addon-logo.png',
        resources: ['catalog'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
        catalogs: [
            {
                id: 'profile-watchlist',
                type: 'movie',
                name: `${profile.avatar} Mi Lista — Películas`,
                extra: [{ name: 'skip' }],
            },
            {
                id: 'profile-watchlist',
                type: 'series',
                name: `${profile.avatar} Mi Lista — Series`,
                extra: [{ name: 'skip' }],
            },
            {
                id: 'profile-history',
                type: 'movie',
                name: `${profile.avatar} Visto — Películas`,
                extra: [{ name: 'skip' }],
            },
            {
                id: 'profile-history',
                type: 'series',
                name: `${profile.avatar} Visto — Series`,
                extra: [{ name: 'skip' }],
            },
        ],
    };
}

function handleCatalog(profileId, catalogId, type, extra = {}) {
    const profile = getProfile(profileId);
    if (!profile) return { metas: [] };

    const skip = parseInt(extra.skip) || 0;

    if (catalogId === 'profile-watchlist') {
        const list = getWatchlist(profileId).filter(i => i.item_type === type);
        const metas = list.slice(skip, skip + 100).map(i => ({
            id: i.item_id,
            type: i.item_type,
            name: i.name,
            poster: i.poster,
        }));
        return { metas };
    }

    if (catalogId === 'profile-history') {
        const list = getHistory(profileId, 200).filter(i => i.item_type === type);
        const metas = list.slice(skip, skip + 100).map(i => ({
            id: i.item_id,
            type: i.item_type,
            name: i.name,
            poster: i.poster,
        }));
        return { metas };
    }

    return { metas: [] };
}

module.exports = { buildManifest, handleCatalog };
