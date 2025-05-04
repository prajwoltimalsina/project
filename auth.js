// Your Google OAuth Client ID - Keep this the same
const CLIENT_ID = '137397082260-8gupghgkff0uuc1p33rt73aa55ckbir4.apps.googleusercontent.com';

// Google API key for sheets access - Keep this the same
const API_KEY = 'AIzaSyBoBMlw_eC3y88AzhbhNSVgLNZ-nz93n2A';

// The spreadsheet ID for your "database" - Keep this the same
const SPREADSHEET_ID = '1w1VZa8GXuwJGgTAk8wxEQ-9q4ZtIv26sAQUprKDHR30';

// Authentication state
let isAuthenticated = false;
let currentUser = null;

// Wait for Google API to be fully loaded
function gapiLoaded() {
  gapi.load('client:auth2', initClient);
}

// Wait for Google Identity Services to be loaded
function gisLoaded() {
  // Will be used when initializing auth
  console.log("Google Identity Services loaded");
}

// Initialize the Google API client
function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly"
  }).then(function() {
    // Listen for sign-in state changes
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
    
    // Handle the initial sign-in state
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    
    // Set up Google Sign-In buttons after client init
    setupGoogleButtons();
  }).catch(function(error) {
    console.error("Error initializing Google API client:", error);
    showAlert("Error connecting to Google services. Please try again later.");
  });
}

// Initialize the Google Sign-In buttons
function setupGoogleButtons() {
  // Only set up buttons if on the login page
  if (document.getElementById("googleSigninDiv")) {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleGoogleSignIn,
      auto_select: false
    });
    
    // Render the sign-in button for both forms
    google.accounts.id.renderButton(
      document.getElementById("googleSigninDiv"),
      { theme: "outline", size: "large", width: 250, text: "signin_with" }
    );
    
    if (document.getElementById("googleSignupDiv")) {
      google.accounts.id.renderButton(
        document.getElementById("googleSignupDiv"),
        { theme: "outline", size: "large", width: 250, text: "signup_with" }
      );
    }
  }
  
  // Check if user is already signed in
  checkAuthStatus();
}

// Update UI based on sign-in status
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    isAuthenticated = true;
    const googleUser = gapi.auth2.getAuthInstance().currentUser.get();
    const profile = googleUser.getBasicProfile();
    
    currentUser = {
      email: profile.getEmail(),
      firstName: profile.getGivenName(),
      lastName: profile.getFamilyName(),
      picture: profile.getImageUrl()
    };
    
    // Save to localStorage for persistence
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    // Check if we should redirect to dashboard
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
      window.location.href = 'dashboard.html';
    }
  } else {
    // Not signed in
    isAuthenticated = false;
    currentUser = null;
    localStorage.removeItem('user');
    
    // If on a protected page, redirect to login
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/' && 
        window.location.pathname !== '/index.html') {
      window.location.href = 'index.html';
    }
  }
}

// Handle the sign-in callback from Google One Tap
function handleGoogleSignIn(response) {
  // Decode the JWT token from Google
  const payload = parseJwt(response.credential);
  
  currentUser = {
    email: payload.email,
    firstName: payload.given_name,
    lastName: payload.family_name,
    picture: payload.picture
  };
  
  // Save to localStorage for persistence
  localStorage.setItem('user', JSON.stringify(currentUser));
  
  // Check if user exists in your Google Sheet "database"
  checkUserInDatabase(currentUser.email, function(exists) {
    if (!exists) {
      // Add new user to database (Google Sheets)
      addUserToDatabase(currentUser.email, currentUser.firstName, currentUser.lastName);
    }
    
    // Navigate to dashboard
    window.location.href = 'dashboard.html';
  });
}

// Parse JWT token
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  
  return JSON.parse(jsonPayload);
}

// Check if the user is already authenticated
function checkAuthStatus() {
  // First check localStorage
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    isAuthenticated = true;
    
    // If we're on the login page but already logged in, redirect to dashboard
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
      window.location.href = 'dashboard.html';
    }
  } else if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/' &&
             window.location.pathname !== '/index.html') {
    // Check with Google Auth as well
    if (typeof gapi !== 'undefined' && gapi.auth2) {
      try {
        const isSignedInWithGoogle = gapi.auth2.getAuthInstance().isSignedIn.get();
        if (!isSignedInWithGoogle) {
          // If not on login page and not authenticated, redirect to login page
          window.location.href = 'index.html';
        }
      } catch (e) {
        console.error("Error checking Google auth status", e);
        window.location.href = 'index.html';
      }
    } else {
      // If Google Auth isn't ready yet, redirect to be safe
      window.location.href = 'index.html';
    }
  }
  
  // Return the user object for convenience
  return currentUser;
}

// Check if user exists in Google Sheets database
function checkUserInDatabase(email, callback) {
  // Make sure gapi client is initialized and ready
  if (!gapi.client || !gapi.client.sheets) {
    console.error("Google API client not initialized");
    // Fallback - assume user doesn't exist
    callback(false);
    return;
  }

  // Use Google Sheets API to check if user exists
  gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Users!A:C', // Assuming user data is in a sheet named 'Users' with columns A-C
  }).then(function(response) {
    const values = response.result.values || [];
    const userExists = values.some(row => row[0] === email);
    callback(userExists);
  }).catch(function(error) {
    console.error("Error checking user in database:", error);
    // Assume user doesn't exist if we can't check
    callback(false);
  });
}

// Add user to Google Sheets database
function addUserToDatabase(email, firstName, lastName) {
  // Make sure gapi client is initialized and ready
  if (!gapi.client || !gapi.client.sheets) {
    console.error("Google API client not initialized");
    return;
  }

  // Use Google Sheets API to add user
  gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Users!A:C', // Assuming user data is in a sheet named 'Users' with columns A-C
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[email, firstName, lastName]]
    }
  }).then(function(response) {
    console.log('User added to database:', response);
  }).catch(function(error) {
    console.error("Error adding user to database:", error);
  });
}

// Function to fetch Google Sheets data
function fetchCampaignData(callback) {
  // Make sure gapi client is initialized and ready
  if (!gapi.client || !gapi.client.sheets) {
    console.error("Google API client not initialized");
    const fallbackUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vShkyha9RUILD6tgutsA9KqriklzAITyydxblmfyYvRvC7lLS60JMsVM3am-8wwu5Kt5a9mHSDvoQgO/pub?output=csv";
    
    // Use Papa Parse as fallback
    if (typeof Papa !== 'undefined') {
      Papa.parse(fallbackUrl, {
        download: true,
        header: false,
        complete: function(results) {
          callback(results.data);
        },
        error: function(error) {
          console.error("Error fetching CSV data:", error);
          callback(null, error);
        }
      });
    } else {
      callback(null, new Error("Neither Google API nor Papa Parse is available"));
    }
    return;
  }

  gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Campaign!A:B', // Assuming campaign data is in a sheet named 'Campaign'
  }).then(function(response) {
    const values = response.result.values || [];
    callback(values);
  }).catch(function(error) {
    console.error("Error fetching campaign data:", error);
    callback(null, error);
  });
}

// For handling manual sign-in (kept for demonstration, but Google OAuth is preferred)
function handleManualSignIn(email, password) {
  // For demo purposes only - in a real app, you'd validate against your database
  currentUser = {
    email: email,
    firstName: "User",
    lastName: ""
  };
  
  localStorage.setItem('user', JSON.stringify(currentUser));
  window.location.href = 'dashboard.html';
}

// Sign out user
function logout() {
  if (typeof gapi !== 'undefined' && gapi.auth2) {
    try {
      const auth2 = gapi.auth2.getAuthInstance();
      auth2.signOut().then(function() {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
      });
    } catch (e) {
      console.error("Error signing out from Google", e);
      localStorage.removeItem('user');
      window.location.href = 'index.html';
    }
  } else {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  }
}

// Display alert message
function showAlert(message) {
  const alertBox = document.getElementById('alertBox');
  const alertMessage = document.getElementById('alertMessage');
  
  if (alertBox && alertMessage) {
    alertMessage.innerText = message;
    alertBox.style.display = 'block';
    
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 5000);
  } else {
    // Fallback if alert elements don't exist
    alert(message);
  }
}

// Set up event listeners for sign-in/sign-up forms
document.addEventListener('DOMContentLoaded', function() {
  // Handle manual sign-in form submission
  const signinForm = document.getElementById('signinForm');
  if (signinForm) {
    signinForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = document.getElementById('signinEmail').value;
      const password = document.getElementById('signinPassword').value;
      handleManualSignIn(email, password);
    });
  }
  
  // Handle manual sign-up form submission
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const firstName = document.getElementById('fName').value;
      const lastName = document.getElementById('lName').value;
      const email = document.getElementById('signupEmail').value;
      
      currentUser = {
        email: email,
        firstName: firstName,
        lastName: lastName
      };
      
      localStorage.setItem('user', JSON.stringify(currentUser));
      window.location.href = 'dashboard.html';
    });
  }
  
  // Set up logout button if it exists
  const logoutButton = document.getElementById('signOutLink');
  if (logoutButton) {
    logoutButton.addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  }
});