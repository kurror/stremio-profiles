const https = require('https');

const TMDB_KEY = process.env.TMDB_API_KEY;
const BASE = 'https://api.themoviedb.org/3';

function fetch(path) {
    return new Promise((resolve, reject) => {
        const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_KEY}&language=es-ES`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

const GENRE_MAP = {
    movie: {
        'Acción': 28, 'Aventura': 12, 'Animación': 16, 'Comedia': 35,
        'Crimen': 80, 'Documental': 99, 'Drama': 18, 'Fantasía': 14,
        'Terror': 27, 'Misterio': 9648, 'Romance': 10749, 'Ciencia Ficción': 878,
        'Thriller': 53, 'Western': 37, 'Historia': 36, 'Música': 10402,
    },
    series: {
        'Acción': 10759, 'Animación': 16, 'Comedia': 35, 'Crimen': 80,
        'Documental': 99, 'Drama': 18, 'Fantasía': 10765, 'Kids': 10762,
        'Misterio': 9648, 'Realidad': 10764, 'Sci-Fi': 10765, 'Soap': 10766,
        'Talk': 10767, 'Western': 37,
    }
};

function toMeta(item, type) {
    const isMovie = type === 'movie';
    return {
        id: `tmdb:${type}:${item.id}`,
        type: isMovie ? 'movie' : 'series',
        name: item.title || item.name || 'Sin título',
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        background: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        description: item.overview,
        releaseInfo: (item.release_date || item.first_air_date || '').slice(0, 4),
        imdbRating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
        genres: [],
    };
}

async function getTrending(type = 'movie', page = 1) {
    const t = type === 'movie' ? 'movie' : 'tv';
    const data = await fetch(`/trending/${t}/week?page=${page}`);
    return (data.results || []).map(i => toMeta(i, type));
}

async function getByGenres(type, genres, page = 1) {
    if (!TMDB_KEY) return [];
    const t = type === 'movie' ? 'movie' : 'tv';
    const gmap = GENRE_MAP[type] || {};
    const ids = genres.map(g => gmap[g]).filter(Boolean);
    if (ids.length === 0) return getTrending(type, page);
    const data = await fetch(`/discover/${t}?with_genres=${ids.join(',')}&sort_by=popularity.desc&page=${page}`);
    return (data.results || []).map(i => toMeta(i, type));
}

async function getDetails(tmdbType, tmdbId) {
    const t = tmdbType === 'movie' ? 'movie' : 'tv';
    const data = await fetch(`/${t}/${tmdbId}`);
    return toMeta(data, tmdbType);
}

async function search(query, page = 1) {
    const data = await fetch(`/search/multi?query=${encodeURIComponent(query)}&page=${page}`);
    return (data.results || [])
        .filter(i => i.media_type === 'movie' || i.media_type === 'tv')
        .map(i => toMeta(i, i.media_type === 'movie' ? 'movie' : 'series'));
}

module.exports = { getTrending, getByGenres, getDetails, search, GENRE_MAP };
