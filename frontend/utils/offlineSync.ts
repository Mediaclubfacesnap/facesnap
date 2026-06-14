import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface FaceSnapDB extends DBSchema {
  'offline-messages': {
    key: string; // msg UUID or local nanoid
    value: {
      id: string;
      conversation_id: string;
      content: string;
      created_at: number;
    };
  };
  'offline-uploads': {
    key: string;
    value: {
      id: string;
      community_id: string;
      file_data: ArrayBuffer;
      file_name: string;
      file_type: string;
      created_at: number;
    };
  };
  'pwa-settings': {
    key: string;
    value: any;
  }
}

let dbPromise: Promise<IDBPDatabase<FaceSnapDB>> | null = null;

export const getDB = () => {
  if (typeof window === 'undefined') return null;
  
  if (!dbPromise) {
    dbPromise = openDB<FaceSnapDB>('facesnap-offline-store', 1, {
      upgrade(db) {
        db.createObjectStore('offline-messages', { keyPath: 'id' });
        db.createObjectStore('offline-uploads', { keyPath: 'id' });
        db.createObjectStore('pwa-settings');
      },
    });
  }
  return dbPromise;
};

// --- Messages Queue ---
export const queueOfflineMessage = async (msg: any) => {
  const db = await getDB();
  if (!db) return;
  await db.put('offline-messages', {
    ...msg,
    created_at: Date.now()
  });
};

export const getOfflineMessages = async () => {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('offline-messages');
};

export const removeOfflineMessage = async (id: string) => {
  const db = await getDB();
  if (!db) return;
  await db.delete('offline-messages', id);
};

export const getOfflineMessagesCount = async () => {
  const db = await getDB();
  if (!db) return 0;
  return db.count('offline-messages');
};

// --- Uploads Queue ---
export const queueOfflineUpload = async (upload: any) => {
  const db = await getDB();
  if (!db) return;
  await db.put('offline-uploads', {
    ...upload,
    created_at: Date.now()
  });
};

export const getOfflineUploads = async () => {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('offline-uploads');
};

export const removeOfflineUpload = async (id: string) => {
  const db = await getDB();
  if (!db) return;
  await db.delete('offline-uploads', id);
};

export const getOfflineUploadsCount = async () => {
  const db = await getDB();
  if (!db) return 0;
  return db.count('offline-uploads');
};

// --- Settings ---
export const setPWASetting = async (key: string, val: any) => {
  const db = await getDB();
  if (!db) return;
  await db.put('pwa-settings', val, key);
};

export const getPWASetting = async (key: string) => {
  const db = await getDB();
  if (!db) return null;
  return db.get('pwa-settings', key);
};
