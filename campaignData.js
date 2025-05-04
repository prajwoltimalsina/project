// Database setup for campaign data
let campaignDB;
const CAMPAIGN_DB_NAME = 'CampaignDB';
const CAMPAIGN_STORE_NAME = 'campaignData';
const CAMPAIGN_DB_VERSION = 1;

// Initialize the Campaign IndexedDB
function initCampaignDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CAMPAIGN_DB_NAME, CAMPAIGN_DB_VERSION);
    
    request.onupgradeneeded = (e) => {
      campaignDB = e.target.result;
      if (!campaignDB.objectStoreNames.contains(CAMPAIGN_STORE_NAME)) {
        campaignDB.createObjectStore(CAMPAIGN_STORE_NAME, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (e) => {
      campaignDB = e.target.result;
      console.log('Campaign DB initialized successfully');
      resolve(campaignDB);
    };
    
    request.onerror = (e) => {
      console.error('Error initializing campaign DB:', e.target.error);
      reject(e.target.error);
    };
  });
}

// Store campaign data in IndexedDB
function storeCampaignData(data) {
  return new Promise((resolve, reject) => {
    // Format the data for storage with an ID
    const formattedData = {
      id: 'current-campaign',  // Use a fixed ID for easy retrieval
      data: data,
      timestamp: new Date().getTime()
    };
    
    const transaction = campaignDB.transaction(CAMPAIGN_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(CAMPAIGN_STORE_NAME);
    
    const request = store.put(formattedData); // Use put instead of add to update if exists
    
    request.onsuccess = () => {
      console.log('Campaign data stored in IndexedDB');
      resolve(true);
    };
    
    request.onerror = (e) => {
      console.error('Error storing campaign data:', e.target.error);
      reject(e.target.error);
    };
  });
}

// Retrieve campaign data from IndexedDB
function getCampaignData() {
  return new Promise((resolve, reject) => {
    if (!campaignDB) {
      reject(new Error('Campaign database not initialized'));
      return;
    }
    
    const transaction = campaignDB.transaction(CAMPAIGN_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CAMPAIGN_STORE_NAME);
    const request = store.get('current-campaign');
    
    request.onsuccess = () => {
      if (request.result) {
        console.log('Campaign data retrieved from IndexedDB');
        resolve(request.result.data);
      } else {
        console.log('No campaign data found in IndexedDB');
        resolve(null);
      }
    };
    
    request.onerror = (e) => {
      console.error('Error retrieving campaign data:', e.target.error);
      reject(e.target.error);
    };
  });
}

// Fetch campaign data with offline support
async function fetchCampaignDataWithOfflineSupport() {
  // Try to fetch from network first
  if (navigator.onLine) {
    try {
      // Try Google Sheets API first
      const onlineData = await new Promise((resolve) => {
        fetchCampaignData(function(data, error) {
          if (data && data.length > 0) {
            resolve(data);
          } else {
            // Fall back to CSV
            fetchCSVData((csvData, csvError) => {
              if (csvData) {
                resolve(csvData);
              } else {
                resolve(null);
              }
            });
          }
        });
      });
      
      if (onlineData) {
        // Store data for offline use
        await storeCampaignData(onlineData);
        return onlineData;
      }
    } catch (error) {
      console.error('Error fetching online data:', error);
    }
  }
  
  // If we're offline or online fetching failed, try to get from IndexedDB
  try {
    const offlineData = await getCampaignData();
    if (offlineData) {
      return offlineData;
    }
  } catch (error) {
    console.error('Error fetching offline data:', error);
  }
  
  // If all else fails, return null
  return null;s
}

// Function to fetch CSV data (moved from dashboard.js)
function fetchCSVData(callback) {
  // CSV URL from published Google Sheet
  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?output=csv";

  Papa.parse(csvUrl, {
    download: true,
    header: false,
    complete: function(results) {
      if (results.data && results.data.length > 0) {
        callback(results.data);
      } else {
        callback(null, new Error('No data in CSV response'));
      }
    },
    error: function(error) {
      console.error("Error fetching or parsing the CSV data:", error);
      callback(null, error);
    }
  });
}