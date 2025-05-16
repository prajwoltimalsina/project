// Handle page-specific initialization
document.addEventListener('DOMContentLoaded', function() {
  // Form switching logic for the login page
  const signUpButton = document.getElementById('signUpButton');
  const signInButton = document.getElementById('signInButton');
  const signInForm = document.getElementById('signIn');
  const signUpForm = document.getElementById('signup');

  // Only execute this code if we're on the login page with these elements
  if (signUpButton && signInButton && signInForm && signUpForm) {
    signUpButton.addEventListener('click', function() {
      signInForm.style.display = "none";
      signUpForm.style.display = "block";
    });

    signInButton.addEventListener('click', function() {
      signInForm.style.display = "block";
      signUpForm.style.display = "none";
    });
  }

  // If we're on a protected page, display user info if available
  if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('overview')) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.firstName) {
      // Find elements that should display user info
      const userDisplayElements = document.querySelectorAll('.user-display');
      userDisplayElements.forEach(element => {
        element.textContent = `${user.firstName} ${user.lastName || ''}`.trim();
      });
    } else {
      // Not authenticated properly, redirect to login
      window.location.href = 'index.html';
    }
  }

  // Setup Google Sheets data loading for overview pages
  const platform = getQueryParam('platform');
  if (platform && document.getElementById('data-display')) {
    loadPlatform(platform);
  } else if (document.getElementById('data-display')) {
    document.getElementById('data-display').innerHTML = `<p>Please select a platform from the dashboard.</p>`;
  }
});

// Helper function to get query parameters
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Fetch data from Google Sheets based on platform
function fetchGoogleSheetsData(platform, callback) {
  const sheetUrls = {
    facebook: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?gid=717789882&single=true&output=csv',
    instagram: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?gid=283315654&single=true&output=csv',
    twitter: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?gid=649775317&single=true&output=csv',
    linkedin: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?gid=1276556531&single=true&output=csv'
  };
  
  const csvUrl = sheetUrls[platform];
  if (!csvUrl) {
    console.error("Invalid platform:", platform);
    callback(null, new Error("Invalid platform"));
    return;
  }

  // Check if Papa Parse is loaded
  if (typeof Papa === 'undefined') {
    console.error("Papa Parse library is not loaded");
    callback(null, new Error("Papa Parse not available"));
    return;
  }

  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: function(results) {
      console.log("Parsed Data:", results.data);
      callback(results.data);
    },
    error: function(error) {
      console.error("CSV Parse Error:", error);
      callback(null, error);
    }
  });
}

// Load and display platform data
function loadPlatform(platform) {
  const container = document.getElementById('data-display');
  if (!container) {
    console.error("Container element not found");
    return;
  }
  
  // Show loading indicator
  container.innerHTML = '<p>Loading data...</p>';
  
  fetchGoogleSheetsData(platform, function(data, error) {
    if (error) {
      container.innerHTML = `<p>Error loading data: ${error.message}</p>`;
      return;
    }
    
    if (!data || data.length === 0) {
      console.log("Fetched data length:", data ? data.length : 0);
      container.innerHTML = `<p>No data found for ${platform}.</p>`;
      return;
    }
    
    let html = '<table border="1"><thead><tr>';
    
    // Extract headers from the first row
    const headers = Object.keys(data[0]);
    headers.forEach(key => {
      html += `<th>${key}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Add data rows
    data.forEach(row => {
      html += '<tr>';
      headers.forEach(key => {
        html += `<td>${row[key] || ''}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  });
}