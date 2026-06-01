const { getWatchlist, getHistory } = require('./db');

const ADDON_ID = 'com.kurror.stremio-profiles';

function buildManifest(profile) {
    const label = `${profile.avatar} ${profile.name}`;
    return {
        id: ADDON_ID,
        version: '1.0.0',
        name: label,
        description: profile
            ? `Perfil activo: ${profile.name}`
            : 'Abre http://100.118.11.112:7000 para seleccionar tu perfil',
        logo: 'https://dl.strem.io/addon-logo.png',
        resources: ['catalog'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
        catalogs: profile ? [
            { id: 'watchlist', type: 'movie',  name: `${profile.avatar} Mi Lista — Películas`, extra: [{ name: 'skip' }] },
            { id: 'watchlist', type: 'series', name: `${profile.avatar} Mi Lista — Series`,    extra: [{ name: 'skip' }] },
            { id: 'history',  type: 'movie',  name: `${profile.avatar} Visto — Películas`,    extra: [{ name: 'skip' }] },
            { id: 'history',  type: 'series', name: `${profile.avatar} Visto — Series`,       extra: [{ name: 'skip' }] },
        ] : [],
    };
}

function handleCatalog(profileId, catalogId, type, extra = {}) {
    const skip = parseInt(extra.skip) || 0;

    if (catalogId === 'watchlist') {
        const metas = getWatchlist(profileId)
            .filter(i => i.item_type === type)
            .slice(skip, skip + 100)
            .map(i => ({ id: i.item_id, type: i.item_type, name: i.name, poster: i.poster }));
        return { metas };
    }

    if (catalogId === 'history') {
        const metas = getHistory(profileId)
            .filter(i => i.item_type === type)
            .slice(skip, skip + 100)
            .map(i => ({ id: i.item_id, type: i.item_type, name: i.name, poster: i.poster }));
        return { metas };
    }

    return { metas: [] };
}

module.exports = { buildManifest, handleCatalog };
