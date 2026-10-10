import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
async function db() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync('kashaf-albar.db');
  const database = await dbPromise;
  await database.execAsync(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sightings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imageUri TEXT NOT NULL,
      category TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorites (
      speciesId TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS installed_packs (
      packId TEXT PRIMARY KEY,
      installedAt TEXT NOT NULL
    );`);
  return database;
}

export type Sighting = { id: number; imageUri: string; category: string; note: string; createdAt: string };
export async function addSighting(imageUri: string, category: string, note = '') {
  const database = await db();
  await database.runAsync('INSERT INTO sightings (imageUri, category, note, createdAt) VALUES (?, ?, ?, ?)', imageUri, category, note, new Date().toISOString());
}
export async function getSightings(): Promise<Sighting[]> {
  const database = await db();
  return database.getAllAsync<Sighting>('SELECT * FROM sightings ORDER BY id DESC');
}
export async function deleteSighting(id: number) {
  const database = await db();
  await database.runAsync('DELETE FROM sightings WHERE id = ?', id);
}
export async function getFavorites(): Promise<string[]> {
  const database = await db();
  const rows = await database.getAllAsync<{speciesId:string}>('SELECT speciesId FROM favorites ORDER BY createdAt DESC');
  return rows.map(row => row.speciesId);
}
export async function toggleFavorite(speciesId: string) {
  const database = await db();
  const row = await database.getFirstAsync<{speciesId:string}>('SELECT speciesId FROM favorites WHERE speciesId = ?', speciesId);
  if (row) await database.runAsync('DELETE FROM favorites WHERE speciesId = ?', speciesId);
  else await database.runAsync('INSERT INTO favorites (speciesId, createdAt) VALUES (?, ?)', speciesId, new Date().toISOString());
}


/** Local catalogue-pack state. This stores installed catalogue availability, not ML model files. */
export async function getInstalledPacks(): Promise<string[]> {
  const database = await db();
  const rows = await database.getAllAsync<{packId: string}>('SELECT packId FROM installed_packs ORDER BY installedAt');
  return rows.map(row => row.packId);
}

export async function setPackInstalled(packId: string, installed: boolean): Promise<void> {
  const database = await db();
  if (installed) {
    await database.runAsync('INSERT OR REPLACE INTO installed_packs (packId, installedAt) VALUES (?, ?)', packId, new Date().toISOString());
  } else {
    await database.runAsync('DELETE FROM installed_packs WHERE packId = ?', packId);
  }
}
