import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs, 
  doc, 
  deleteDoc, 
  serverTimestamp,
  setDoc,
  getDoc,
  limit,
  updateDoc
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export const useChatHistory = () => {
  // Group all state hooks at the top
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  // Memoize all functions with useCallback
  const saveUserActivity = useCallback(async (activityType, activityData = {}) => {
    if (!currentUser) return;
    
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const activitiesRef = collection(userRef, "activities");
      
      await addDoc(activitiesRef, {
        type: activityType,
        timestamp: serverTimestamp(),
        ...activityData
      });
    } catch (error) {
      console.error("Error saving user activity:", error);
    }
  }, [currentUser]);

  const saveMessage = useCallback(async (message, response, sourceDocuments = []) => {
    if (!currentUser) return;

    try {
      const userChatsRef = collection(db, 'users', currentUser.uid, 'chats');
      const timestamp = serverTimestamp();
      const newChat = {
        message: message,
        response: response,
        sourceDocuments: sourceDocuments,
        timestamp: timestamp,
        archived: false
      };
      
      const docRef = await addDoc(userChatsRef, newChat);
      
      // Cập nhật state ngay lập tức
      setChatHistory(prev => [{
        id: docRef.id,
        ...newChat,
        timestamp: new Date() // Sử dụng thời gian hiện tại tạm thời
      }, ...prev]);
      
      await saveUserActivity('chat_message', { messageId: docRef.id });
    } catch (error) {
      console.error('❌ Lỗi khi lưu tin nhắn:', error);
    }
  }, [currentUser, saveUserActivity]);

  const clearHistory = useCallback(async () => {
    if (!currentUser) return;

    try {
      const userChatsRef = collection(db, 'users', currentUser.uid, 'chats');
      const chatSnapshot = await getDocs(userChatsRef);
      const deletePromises = chatSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      const userActivitiesRef = collection(db, 'users', currentUser.uid, 'activities');
      const activitySnapshot = await getDocs(userActivitiesRef);
      const deleteActivityPromises = activitySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteActivityPromises);

      setChatHistory([]);
      await saveUserActivity('clear_all_history');
    } catch (error) {
      console.error('❌ Error clearing history:', error);
      throw error;
    }
  }, [currentUser, saveUserActivity]);

  const updateUserInfo = useCallback(async (userData) => {
    if (!currentUser) return;
    
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, userData, { merge: true });
    } catch (error) {
      console.error("Error updating user info:", error);
    }
  }, [currentUser]);

  const getUserInfo = useCallback(async () => {
    if (!currentUser) return null;
    
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      console.error("Error getting user info:", error);
      return null;
    }
  }, [currentUser]);

  // Single useEffect for chat subscriptions
  useEffect(() => {
    let unsubscribe = () => {};

    const setupSubscriptions = async () => {
      if (!currentUser) {
        setChatHistory([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userChatsRef = collection(db, 'users', currentUser.uid, 'chats');
        const q = query(
          userChatsRef,
          orderBy('timestamp', 'desc'),
          limit(50)
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const chats = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp)
            };
          });
          setChatHistory(chats);
          setLoading(false);
        }, (error) => {
          console.error('❌ Lỗi khi lấy chat history:', error);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error setting up chat listeners:', error);
        setLoading(false);
      }
    };

    setupSubscriptions();

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  return {
    chatHistory,
    loading,
    saveMessage,
    clearHistory,
    updateUserInfo,
    getUserInfo
  };
}; 