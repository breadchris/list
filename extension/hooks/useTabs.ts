import { useState, useEffect } from 'react';

export interface Tab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
}

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all tabs
  const loadTabs = async () => {
    try {
      const chromeTabs = await chrome.tabs.query({});
      const mappedTabs: Tab[] = chromeTabs.map(tab => ({
        id: tab.id!,
        title: tab.title || 'Untitled',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl,
        active: tab.active || false,
      }));
      setTabs(mappedTabs);
      setLoading(false);
    } catch (error) {
      console.error('Error loading tabs:', error);
      setLoading(false);
    }
  };

  // Switch to a tab
  const switchToTab = async (tabId: number) => {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    } catch (error) {
      console.error('Error switching to tab:', error);
    }
  };

  // Close a tab
  const closeTab = async (tabId: number) => {
    try {
      await chrome.tabs.remove(tabId);
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  };

  // Set up listeners for tab changes
  useEffect(() => {
    // Initial load
    loadTabs();

    // Listen for new tabs
    const onCreated = (tab: chrome.tabs.Tab) => {
      loadTabs(); // Reload all tabs
    };

    // Listen for removed tabs
    const onRemoved = (tabId: number) => {
      setTabs(prev => prev.filter(tab => tab.id !== tabId));
    };

    // Listen for tab updates (title, favicon, etc.)
    const onUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (changeInfo.title || changeInfo.favIconUrl) {
        setTabs(prev => prev.map(t =>
          t.id === tabId
            ? {
                ...t,
                title: tab.title || t.title,
                favIconUrl: tab.favIconUrl || t.favIconUrl,
              }
            : t
        ));
      }
    };

    // Listen for active tab changes
    const onActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      setTabs(prev => prev.map(tab => ({
        ...tab,
        active: tab.id === activeInfo.tabId,
      })));
    };

    // Register listeners
    chrome.tabs.onCreated.addListener(onCreated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onActivated.addListener(onActivated);

    // Cleanup listeners on unmount
    return () => {
      chrome.tabs.onCreated.removeListener(onCreated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onActivated.removeListener(onActivated);
    };
  }, []);

  return {
    tabs,
    loading,
    switchToTab,
    closeTab,
    refreshTabs: loadTabs,
  };
}
