import { useEffect } from 'react';
import { getOfflineMessages, removeOfflineMessage, getOfflineUploads, removeOfflineUpload } from '../utils/offlineSync';
import { useAuthStore } from '../store/authStore';

export const useNetworkSync = () => {
  const { token } = useAuthStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSync = async () => {
      if (!token) return;
      if (!navigator.onLine) return;

      console.log("[PWA] Network online. Resolving offline queues...");
      
      try {
        // Sync Messages
        const messages = await getOfflineMessages();
        for (const msg of messages) {
          try {
            const res = await fetch(`http://localhost:8000/api/v1/messages/${msg.conversation_id}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                content: msg.content,
                message_type: "text",
              })
            });
            if (res.ok) {
              await removeOfflineMessage(msg.id);
            }
          } catch (e) {
            console.error("Failed to sync message", msg.id, e);
          }
        }

        // Sync Uploads
        const uploads = await getOfflineUploads();
        for (const upload of uploads) {
          try {
            const fileBlob = new Blob([upload.file_data], { type: upload.file_type });
            const formData = new FormData();
            formData.append("files", fileBlob, upload.file_name);
            formData.append("community_id", upload.community_id);

            const res = await fetch(`http://localhost:8000/api/v1/uploads/community`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`
              },
              body: formData
            });

            if (res.ok) {
              await removeOfflineUpload(upload.id);
            }
          } catch (e) {
            console.error("Failed to sync upload", upload.id, e);
          }
        }

      } catch (err) {
        console.error("[PWA] Sync error:", err);
      }
    };

    // Listen to online events
    window.addEventListener('online', handleSync);
    
    // Also listen to custom messages from Service Worker's Background Sync API
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_MESSAGES' || event.data?.type === 'SYNC_UPLOADS') {
        handleSync();
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      window.removeEventListener('online', handleSync);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [token]);
};
