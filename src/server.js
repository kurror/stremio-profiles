require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const { buildManifest, handleCatalog } = require('./addon');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 7000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});

function deviceIp(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

// ─── Single addon URL (device-session based) ─────────────────────────

app.get('/manifest.json', (req, res) => {
    const profile = db.getActiveProfile(deviceIp(req));
    res.json(buildManifest(profile));
});

app.get('/catalog/:type/:catalogId.json', (req, res) => {
    const profile = db.getActiveProfile(deviceIp(req));
    if (!profile) return res.json({ metas: [] });
    res.json(handleCatalog(profile.id, req.params.catalogId, req.params.type, req.query));
});

app.get('/catalog/:type/:catalogId/:extra.json', (req, res) => {
    const profile = db.getActiveProfile(deviceIp(req));
    if (!profile) return res.json({ metas: [] });
    const extraObj = Object.fromEntries(req.params.extra.split('&').map(p => p.split('=')));
    res.json(handleCatalog(profile.id, req.params.catalogId, req.params.type, extraObj));
});

// ─── Profile management API ───────────────────────────────────────────

app.get('/api/profiles', (req, res) => {
    res.json(db.listProfiles().map(p => ({ ...p, pin: p.pin ? true : false })));
});

app.post('/api/profiles', (req, res) => {
    const { name, avatar, pin } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    res.json(db.createProfile({ name, avatar, pin }));
});

app.put('/api/profiles/:id', (req, res) => {
    if (!db.getProfile(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
    res.json(db.updateProfile(req.params.id, req.body));
});

app.delete('/api/profiles/:id', (req, res) => {
    db.deleteProfile(req.params.id);
    res.json({ ok: true });
});

// ─── Session: select active profile ──────────────────────────────────

app.get('/api/session', (req, res) => {
    const ip = deviceIp(req);
    const profile = db.getActiveProfile(ip);
    res.json(profile ? { ...profile, pin: profile.pin ? true : false } : null);
});

app.post('/api/session', (req, res) => {
    const { profileId, pin } = req.body;
    const profile = db.getProfile(profileId);
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
    if (profile.pin && profile.pin !== String(pin || '')) {
        return res.status(401).json({ error: 'PIN incorrecto' });
    }
    db.setActiveProfile(deviceIp(req), profileId);
    res.json({ ok: true, profile: { ...profile, pin: profile.pin ? true : false } });
});

app.delete('/api/session', (req, res) => {
    db.clearSession(deviceIp(req));
    res.json({ ok: true });
});

// ─── Watchlist & history ──────────────────────────────────────────────

app.get('/api/watchlist', (req, res) => {
    const profile = db.getActiveProfile(deviceIp(req));
    if (!profile) return res.status(401).json({ error: 'Sin perfil activo' });
    res.json(db.getWatchlist(profile.id));
});

app.post('/api/watchlist', (req, res) => {
    const profile = db.getActiveProfile(deviceIp(req));
    if (!profile) return res.status(401).json({ error: 'Sin perfil activo' });
    db.addToWatchlist(profile.id, req.body);
    res.json({ ok: true });
});

app.delete('/api/watchlist/:itemId', (req, res) => {
    const profile = db.getActiveProfile(deviceIp(req));
    if (!profile) return res.status(401).json({ error: 'Sin perfil activo' });
    db.removeFromWatchlist(profile.id, decodeURIComponent(req.params.itemId));
    res.json({ ok: true });
});

app.get('/api/history', (req, res) => {
    const profile = db.getActiveProfile(deviceIp(req));
    if (!profile) return res.status(401).json({ error: 'Sin perfil activo' });
    res.json(db.getHistory(profile.id));
});

app.post('/api/history', (req, res) => {
    const profile = db.getActiveProfile(deviceIp(req));
    if (!profile) return res.status(401).json({ error: 'Sin perfil activo' });
    db.addToHistory(profile.id, req.body);
    res.json({ ok: true });
});

app.delete('/api/history', (req, res) => {
    const profile = db.getActiveProfile(deviceIp(req));
    if (!profile) return res.status(401).json({ error: 'Sin perfil activo' });
    db.clearHistory(profile.id);
    res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Stremio Profiles running on ${BASE_URL}`);
    console.log(`Install URL: stremio://${BASE_URL.replace(/^https?:\/\//, '')}/manifest.json`);
});
