require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const { buildManifest, handleCatalog, handleMeta } = require('./addon');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 7000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ─── CORS for Stremio ───────────────────────────────────────────────
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});

// ─── Addon routes (per profile) ─────────────────────────────────────

app.get('/:profileId/manifest.json', (req, res) => {
    const profile = db.getProfile(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(buildManifest(profile));
});

app.get('/:profileId/catalog/:type/:catalogId.json', async (req, res) => {
    const { profileId, type, catalogId } = req.params;
    try {
        const result = await handleCatalog(profileId, catalogId, type, req.query);
        res.json(result);
    } catch (e) {
        console.error(e);
        res.json({ metas: [] });
    }
});

app.get('/:profileId/catalog/:type/:catalogId/:extra.json', async (req, res) => {
    const { profileId, type, catalogId, extra } = req.params;
    const extraObj = Object.fromEntries(extra.split('&').map(p => p.split('=')));
    try {
        const result = await handleCatalog(profileId, catalogId, type, extraObj);
        res.json(result);
    } catch (e) {
        console.error(e);
        res.json({ metas: [] });
    }
});

app.get('/:profileId/meta/:type/:id.json', async (req, res) => {
    const { profileId, type, id } = req.params;
    try {
        const result = await handleMeta(profileId, type, id);
        res.json(result);
    } catch (e) {
        console.error(e);
        res.json({ meta: null });
    }
});

// ─── Web UI API ──────────────────────────────────────────────────────

app.get('/api/profiles', (req, res) => {
    const profiles = db.listProfiles().map(p => ({
        ...p,
        pin: p.pin ? '****' : null,
        installUrl: `${BASE_URL}/${p.id}/manifest.json`,
        stremioUrl: `stremio://${BASE_URL.replace(/^https?:\/\//, '')}/${p.id}/manifest.json`,
    }));
    res.json(profiles);
});

app.post('/api/profiles', (req, res) => {
    const { name, avatar, pin } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const profile = db.createProfile({ name, avatar, pin });
    res.json({ ...profile, installUrl: `${BASE_URL}/${profile.id}/manifest.json` });
});

app.put('/api/profiles/:id', (req, res) => {
    const profile = db.getProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'No encontrado' });
    const updated = db.updateProfile(req.params.id, req.body);
    res.json(updated);
});

app.delete('/api/profiles/:id', (req, res) => {
    db.deleteProfile(req.params.id);
    res.json({ ok: true });
});

// PIN verify
app.post('/api/profiles/:id/verify-pin', (req, res) => {
    const profile = db.getProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'No encontrado' });
    if (!profile.pin) return res.json({ ok: true });
    const ok = profile.pin === String(req.body.pin || '');
    res.json({ ok });
});

// Genres
app.get('/api/profiles/:id/genres', (req, res) => {
    res.json(db.getGenres(req.params.id));
});

app.put('/api/profiles/:id/genres', (req, res) => {
    db.setGenres(req.params.id, req.body.genres || []);
    res.json({ ok: true });
});

// Watchlist
app.get('/api/profiles/:id/watchlist', (req, res) => {
    res.json(db.getWatchlist(req.params.id));
});

app.post('/api/profiles/:id/watchlist', (req, res) => {
    db.addToWatchlist(req.params.id, req.body);
    res.json({ ok: true });
});

app.delete('/api/profiles/:id/watchlist/:itemId', (req, res) => {
    db.removeFromWatchlist(req.params.id, req.params.itemId);
    res.json({ ok: true });
});

// History
app.get('/api/profiles/:id/history', (req, res) => {
    res.json(db.getHistory(req.params.id));
});

app.post('/api/profiles/:id/history', (req, res) => {
    db.addToHistory(req.params.id, req.body);
    res.json({ ok: true });
});

app.delete('/api/profiles/:id/history', (req, res) => {
    db.clearHistory(req.params.id);
    res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Stremio Profiles addon running on ${BASE_URL}`);
    console.log(`Web UI: ${BASE_URL}/`);
});
