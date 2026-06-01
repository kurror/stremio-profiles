require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const { buildManifest, handleCatalog } = require('./addon');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 7000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});

// ─── Token middleware ────────────────────────────────────────────────
// All routes are prefixed with /:token — wrong token = 404
function tokenRouter() {
    const r = express.Router({ mergeParams: true });

    // Static UI files
    r.use(express.static(path.join(__dirname, '..', 'public')));

    // ── Stremio addon (per profile) ──────────────────────────────────
    r.get('/:profileId/manifest.json', (req, res) => {
        const profile = db.getProfile(req.params.profileId);
        if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
        res.json(buildManifest(profile));
    });

    r.get('/:profileId/catalog/:type/:catalogId.json', (req, res) => {
        const { profileId, type, catalogId } = req.params;
        res.json(handleCatalog(profileId, catalogId, type, req.query));
    });

    r.get('/:profileId/catalog/:type/:catalogId/:extra.json', (req, res) => {
        const { profileId, type, catalogId, extra } = req.params;
        const extraObj = Object.fromEntries(extra.split('&').map(p => p.split('=')));
        res.json(handleCatalog(profileId, catalogId, type, extraObj));
    });

    // ── Profile management API ───────────────────────────────────────
    r.get('/api/profiles', (req, res) => {
        const profiles = db.listProfiles().map(p => ({
            ...p,
            pin: p.pin ? true : false,
            installUrl: `${BASE_URL}/${ACCESS_TOKEN}/${p.id}/manifest.json`,
            stremioUrl: `stremio://${BASE_URL.replace(/^https?:\/\//, '')}/${ACCESS_TOKEN}/${p.id}/manifest.json`,
        }));
        res.json(profiles);
    });

    r.post('/api/profiles', (req, res) => {
        const { name, avatar, pin } = req.body;
        if (!name) return res.status(400).json({ error: 'Nombre requerido' });
        const profile = db.createProfile({ name, avatar, pin });
        res.json({
            ...profile,
            pin: profile.pin ? true : false,
            installUrl: `${BASE_URL}/${ACCESS_TOKEN}/${profile.id}/manifest.json`,
        });
    });

    r.put('/api/profiles/:id', (req, res) => {
        if (!db.getProfile(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
        const updated = db.updateProfile(req.params.id, req.body);
        res.json({ ...updated, pin: updated.pin ? true : false });
    });

    r.delete('/api/profiles/:id', (req, res) => {
        db.deleteProfile(req.params.id);
        res.json({ ok: true });
    });

    r.post('/api/profiles/:id/verify-pin', (req, res) => {
        const profile = db.getProfile(req.params.id);
        if (!profile) return res.status(404).json({ error: 'No encontrado' });
        if (!profile.pin) return res.json({ ok: true });
        res.json({ ok: profile.pin === String(req.body.pin || '') });
    });

    // Watchlist
    r.get('/api/profiles/:id/watchlist', (req, res) => {
        res.json(db.getWatchlist(req.params.id));
    });
    r.post('/api/profiles/:id/watchlist', (req, res) => {
        db.addToWatchlist(req.params.id, req.body);
        res.json({ ok: true });
    });
    r.delete('/api/profiles/:id/watchlist/:itemId', (req, res) => {
        db.removeFromWatchlist(req.params.id, decodeURIComponent(req.params.itemId));
        res.json({ ok: true });
    });

    // History
    r.get('/api/profiles/:id/history', (req, res) => {
        res.json(db.getHistory(req.params.id));
    });
    r.post('/api/profiles/:id/history', (req, res) => {
        db.addToHistory(req.params.id, req.body);
        res.json({ ok: true });
    });
    r.delete('/api/profiles/:id/history', (req, res) => {
        db.clearHistory(req.params.id);
        res.json({ ok: true });
    });

    return r;
}

// Mount with token check
app.use('/:token', (req, res, next) => {
    if (ACCESS_TOKEN && req.params.token !== ACCESS_TOKEN) {
        return res.status(404).send('Not found');
    }
    next();
}, tokenRouter());

// Root redirect → token URL
app.get('/', (req, res) => {
    if (ACCESS_TOKEN) return res.redirect(`/${ACCESS_TOKEN}/`);
    res.redirect('/none/');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Stremio Profiles running on port ${PORT}`);
    console.log(`Web UI: ${BASE_URL}/${ACCESS_TOKEN}/`);
    console.log(`Install example: ${BASE_URL}/${ACCESS_TOKEN}/<profile-id>/manifest.json`);
});
