// Form switching logic
const signUpButton = document.getElementById('signUpButton');
const signInButton = document.getElementById('signInButton');
const signInForm = document.getElementById('signIn');
const signUpForm = document.getElementById('signup');

// Only execute this code if we're on the login page
if (signUpButton && signInButton) {
  signUpButton.addEventListener('click', function() {
    signInForm.style.display = "none";
    signUpForm.style.display = "block";
  });

  signInButton.addEventListener('click', function() {
    signInForm.style.display = "block";
    signUpForm.style.display = "none";
  });
}


function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}function fetchGoogleSheetsData(platform, callback) {
  const sheetUrls = {
    facebook: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?gid=717789882&single=true&output=csv',
    instagram: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?gid=283315654&single=true&output=csv',
    twitter: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?gid=649775317&single=true&output=csv',
    linkedin: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?gid=1276556531&single=true&output=csv'
  };
  
  
  const csvUrl = sheetUrls[platform];
  if (!csvUrl) {
    console.error("Invalid platform:", platform);
    return;
  }

  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: function(results) {
      console.log("Parsed Data:", results.data);  // ✅ LOG ADDED HERE
      callback(results.data);
    },
    
    error: function(error) {
      console.error("CSV Parse Error:", error);
      callback(null, error);
    }
  });
}
function loadPlatform(platform) {
  fetchGoogleSheetsData(platform, function(data) {
    const container = document.getElementById('data-display');
    if (!data || data.length === 0) {
      console.log("Fetched data length:", data ? data.length : 0);  // ✅ LOG ADDED HERE
      container.innerHTML = `<p>No data found for ${platform}.</p>`;
      return;
    }
    

    let html = '<table border="1"><thead><tr>';
    Object.keys(data[0]).forEach(key => {
      html += `<th>${key}</th>`;
    });
    html += '</tr></thead><tbody>';

    data.forEach(row => {
      html += '<tr>';
      Object.values(row).forEach(value => {
        html += `<td>${value}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  });
}


// If we're on a protected page (dashboard or overview) check authentication
if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('overview')) {
  // This will be handled by auth.js checkAuthStatus function
  
  // Display user info if available
  document.addEventListener('DOMContentLoaded', function() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      // Find elements that should display user info
      const userDisplayElements = document.querySelectorAll('.user-display');
      userDisplayElements.forEach(element => {
        element.textContent = `${user.firstName} ${user.lastName}`;
      });
    }
    
    // Set up logout button functionality
    const logoutButtons = document.querySelectorAll('[href="logout.php"], .logout-button');
    logoutButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        logout();  // Function defined in auth.js
      });
      
      // Update href to make it work without backend
      if (button.hasAttribute('href')) {
        button.setAttribute('href', 'javascript:void(0);');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const platform = getQueryParam('platform');
  if (platform) {
    loadPlatform(platform);
  } else {
    document.getElementById('data-display').innerHTML = `<p>Please select a platform from the dashboard.</p>`;
  }
});

