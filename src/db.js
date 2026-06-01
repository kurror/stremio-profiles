const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'profiles.db');

let db;

function getDb() {
    if (!db) {
        const fs = require('fs');
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        migrate(db);
    }
    return db;
}

function migrate(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            avatar TEXT DEFAULT '👤',
            pin TEXT DEFAULT NULL,
            created_at INTEGER DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS profile_genres (
            profile_id TEXT NOT NULL,
            genre TEXT NOT NULL,
            PRIMARY KEY (profile_id, genre),
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            item_type TEXT NOT NULL,
            name TEXT,
            poster TEXT,
            added_at INTEGER DEFAULT (unixepoch()),
            UNIQUE(profile_id, item_id),
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            item_type TEXT NOT NULL,
            name TEXT,
            poster TEXT,
            watched_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
    `);
}

// Profiles
function listProfiles() {
    return getDb().prepare('SELECT * FROM profiles ORDER BY created_at').all();
}

function getProfile(id) {
    return getDb().prepare('SELECT * FROM profiles WHERE id = ?').get(id);
}

function createProfile({ name, avatar = '👤', pin = null }) {
    const id = uuidv4();
    getDb().prepare('INSERT INTO profiles (id, name, avatar, pin) VALUES (?, ?, ?, ?)').run(id, name, avatar, pin);
    return getProfile(id);
}

function updateProfile(id, { name, avatar, pin }) {
    const fields = [];
    const vals = [];
    if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
    if (avatar !== undefined) { fields.push('avatar = ?'); vals.push(avatar); }
    if (pin !== undefined) { fields.push('pin = ?'); vals.push(pin || null); }
    if (fields.length === 0) return getProfile(id);
    vals.push(id);
    getDb().prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    return getProfile(id);
}

function deleteProfile(id) {
    getDb().prepare('DELETE FROM profiles WHERE id = ?').run(id);
}

// Genres
function getGenres(profileId) {
    return getDb().prepare('SELECT genre FROM profile_genres WHERE profile_id = ?').all(profileId).map(r => r.genre);
}

function setGenres(profileId, genres) {
    const db = getDb();
    db.prepare('DELETE FROM profile_genres WHERE profile_id = ?').run(profileId);
    const insert = db.prepare('INSERT INTO profile_genres (profile_id, genre) VALUES (?, ?)');
    const tx = db.transaction((genres) => { for (const g of genres) insert.run(profileId, g); });
    tx(genres);
}

// Watchlist
function getWatchlist(profileId) {
    return getDb().prepare('SELECT * FROM watchlist WHERE profile_id = ? ORDER BY added_at DESC').all(profileId);
}

function addToWatchlist(profileId, { item_id, item_type, name, poster }) {
    getDb().prepare(
        'INSERT OR REPLACE INTO watchlist (profile_id, item_id, item_type, name, poster) VALUES (?, ?, ?, ?, ?)'
    ).run(profileId, item_id, item_type, name, poster);
}

function removeFromWatchlist(profileId, itemId) {
    getDb().prepare('DELETE FROM watchlist WHERE profile_id = ? AND item_id = ?').run(profileId, itemId);
}

// History
function getHistory(profileId, limit = 50) {
    return getDb().prepare('SELECT * FROM history WHERE profile_id = ? ORDER BY watched_at DESC LIMIT ?').all(profileId, limit);
}

function addToHistory(profileId, { item_id, item_type, name, poster }) {
    getDb().prepare('DELETE FROM history WHERE profile_id = ? AND item_id = ?').run(profileId, item_id);
    getDb().prepare(
        'INSERT INTO history (profile_id, item_id, item_type, name, poster) VALUES (?, ?, ?, ?, ?)'
    ).run(profileId, item_id, item_type, name, poster);
}

function clearHistory(profileId) {
    getDb().prepare('DELETE FROM history WHERE profile_id = ?').run(profileId);
}

module.exports = {
    listProfiles, getProfile, createProfile, updateProfile, deleteProfile,
    getGenres, setGenres,
    getWatchlist, addToWatchlist, removeFromWatchlist,
    getHistory, addToHistory, clearHistory,
};
