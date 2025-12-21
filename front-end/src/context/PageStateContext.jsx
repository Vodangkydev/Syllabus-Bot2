import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PageStateContext = createContext();

export const PageStateProvider = ({ children }) => {
  const [pageStates, setPageStates] = useState(() => {
    // Khôi phục trạng thái từ localStorage khi khởi tạo
    const savedStates = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('pageState_')) {
        try {
          const pageName = key.replace('pageState_', '');
          savedStates[pageName] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          console.error(`Error parsing state for ${key}:`, e);
          localStorage.removeItem(key);
        }
      }
    }
    return savedStates;
  });

  // Sử dụng useCallback để tránh tạo hàm mới mỗi lần render
  const savePageState = useCallback((pageName, state) => {
    setPageStates(prev => {
      const newState = {
        ...prev,
        [pageName]: state
      };
      // Lưu vào localStorage để giữ lại khi refresh
      try {
        localStorage.setItem(`pageState_${pageName}`, JSON.stringify(state));
      } catch (e) {
        console.error(`Error saving state for ${pageName}:`, e);
        // Nếu localStorage đầy, xóa các state cũ
        if (e.name === 'QuotaExceededError') {
          const keys = Object.keys(localStorage);
          for (let i = 0; i < keys.length; i++) {
            if (keys[i].startsWith('pageState_')) {
              localStorage.removeItem(keys[i]);
            }
          }
          // Thử lưu lại
          localStorage.setItem(`pageState_${pageName}`, JSON.stringify(state));
        }
      }
      return newState;
    });
  }, []);

  const getPageState = useCallback((pageName) => {
    // Ưu tiên lấy từ state trong memory trước
    if (pageStates[pageName]) {
      return pageStates[pageName];
    }
    // Nếu không có trong memory, thử lấy từ localStorage
    try {
      const savedState = localStorage.getItem(`pageState_${pageName}`);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        // Cập nhật lại state trong memory
        setPageStates(prev => ({
          ...prev,
          [pageName]: parsedState
        }));
        return parsedState;
      }
    } catch (e) {
      console.error(`Error getting state for ${pageName}:`, e);
    }
    return null;
  }, [pageStates]);

  // Lắng nghe sự kiện storage để đồng bộ hóa giữa các tab
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('pageState_')) {
        const pageName = e.key.replace('pageState_', '');
        try {
          const newValue = e.newValue ? JSON.parse(e.newValue) : null;
          setPageStates(prev => ({
            ...prev,
            [pageName]: newValue
          }));
        } catch (error) {
          console.error(`Error parsing storage change for ${pageName}:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <PageStateContext.Provider value={{ savePageState, getPageState }}>
      {children}
    </PageStateContext.Provider>
  );
};

export const usePageState = () => {
  const context = useContext(PageStateContext);
  if (!context) {
    throw new Error('usePageState must be used within a PageStateProvider');
  }
  return context;
}; 