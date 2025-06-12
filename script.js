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
    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      try {
        const { user, expiresAt } = JSON.parse(sessionData);
        
        // Check if session has expired
        if (new Date(expiresAt) <= new Date()) {
          // Session expired, redirect to login
          window.location.href = 'index.html';
          return;
        }

        // Find elements that should display user info
        const userDisplayElements = document.querySelectorAll('.user-display');
        userDisplayElements.forEach(element => {
          element.textContent = `${user.firstName} ${user.lastName || ''}`.trim();
        });
      } catch (error) {
        console.error('Error parsing session data:', error);
        window.location.href = 'index.html';
      }
    } else {
      // No session data found, redirect to login
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
    campaign: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?gid=0&single=true&output=csv',
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
      console.error("CSV Parse Error details:", error);
      callback(null, error);
    }
  });
}

// Load and display platform data
let currentChart = null; // Declare a variable to hold the chart instance

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
      container.innerHTML = `<p>No data available for ${platform}.</p>`;
      return;
    }

    console.log(`Data fetched for ${platform}:`, data);
    
    // Create table
    let html = '<div class="overflow-x-auto">'; // Add responsive container
    html += '<table class="min-w-full divide-y divide-gray-200 shadow-md rounded-lg overflow-hidden">';
    html += '<thead class="bg-blue-800 text-white">'; // Styled header
    const headers = Object.keys(data[0]);
    headers.forEach(key => {
      html += '<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">' + key + '</th>'; // Styled table header
    });
    html += '</thead><tbody class="bg-white divide-y divide-gray-200">'; // Styled tbody

    data.forEach(row => {
      html += '<tr>';
      headers.forEach(key => {
        html += '<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">' + (row[key] || '') + '</td>'; // Styled table data
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '</div>'; // Close responsive container
    container.innerHTML = html;

    // Create graph
    const ctx = document.getElementById('platformChart');
    if (ctx) {
      // Prepare data for the graph
      const labels = data.map(row => row.Date || row.date || '');
      
      // Define all metrics to track
      const metrics = [
        { key: 'Total Amount', color: 'rgb(75, 192, 192)' },
        { key: 'Paid Amount', color: 'rgb(255, 99, 132)' },
        { key: 'Due Amount', color: 'rgb(54, 162, 235)' },
        { key: 'Reach', color: 'rgb(255, 159, 64)' },
        { key: 'Impressions', color: 'rgb(153, 102, 255)' },
        { key: 'Engagement rate', color: 'rgb(255, 205, 86)' },
        { key: 'Follower growth', color: 'rgb(201, 203, 207)' }
      ];

      // Create datasets for each metric
      const datasets = metrics.map(metric => {
        const values = data.map(row => {
          const value = parseFloat(row[metric.key] || 0);
          return isNaN(value) ? 0 : value;
        });

        return {
          label: metric.key,
          data: values,
          backgroundColor: metric.color,
          borderColor: metric.color,
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.8,
          categoryPercentage: 0.9
        };
      });

      // Create the chart
      if (currentChart) {
        currentChart.destroy(); // Destroy existing chart if it exists
      }
      currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: datasets
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Performance Metrics`
            },
            legend: {
              position: 'top',
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Value'
              },
              stacked: false
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              },
              stacked: false
            }
          }
        }
      });
    }
  });
}