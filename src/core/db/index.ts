import { PersonalOSDB } from './schema';

/** The app-wide database instance. Only repositories (src/core/repos, from M1) may write to it. */
export const db = new PersonalOSDB();

export { PersonalOSDB, DB_NAME, ENTITY_TABLES, type EntityTableName } from './schema';
