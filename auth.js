// Your Google OAuth Client ID - Keep this the same
const CLIENT_ID = '137397082260-8gupghgkff0uuc1p33rt73aa55ckbir4.apps.googleusercontent.com';

// Google API key for sheets access - Keep this the same
const API_KEY = 'AIzaSyBoBMlw_eC3y88AzhbhNSVgLNZ-nz93n2A';

// The spreadsheet ID for your "database" - Keep this the same
const SPREADSHEET_ID = '1w1VZa8GXuwJGgTAk8wxEQ-9q4ZtIv26sAQUprKDHR30';

// Authentication state
let isAuthenticated = false;
let currentUser = null;
let googleAuth = null; // Store the Google Auth instance

// Wait for Google API to be fully loaded
function gapiLoaded() {
  console.log("Google API loaded");
  gapi.load('client:auth2', initClient);
}

// Wait for Google Identity Services to be loaded
function gisLoaded() {
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
    // Store the auth instance for later use
    googleAuth = gapi.auth2.getAuthInstance();
    
    // Listen for sign-in state changes
    googleAuth.isSignedIn.listen(updateSigninStatus);
    
    // Handle the initial sign-in state
    updateSigninStatus(googleAuth.isSignedIn.get());
    
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
    if (google && google.accounts && google.accounts.id) {
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
    } else {
      console.error("Google Identity Services not loaded properly");
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
      picture: profile.getImageUrl(),
      authMethod: 'google' // Track authentication method
    };
    
    // Save to localStorage for persistence
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    // Check if we should redirect to dashboard
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || 
        window.location.pathname.endsWith('/')) {
      window.location.href = 'dashboard.html';
    }
  } else {
    // If user data exists but Google says not signed in, we might be using local auth
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      // If this was a Google-authenticated user, they're truly signed out
      if (userData.authMethod === 'google') {
        isAuthenticated = false;
        currentUser = null;
        localStorage.removeItem('user');
        
        // If on a protected page, redirect to login
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/' && 
            window.location.pathname !== '/index.html') {
          window.location.href = 'index.html';
        }
      }
    } else {
      // Completely not authenticated
      isAuthenticated = false;
      currentUser = null;
      localStorage.removeItem('user');
      
      // If on a protected page, redirect to login
      if (!isOnLoginPage()) {
        window.location.href = 'index.html';
      }
    }
  }
}

// Helper function to check if we're on the login page
function isOnLoginPage() {
  return window.location.pathname.endsWith('index.html') || 
         window.location.pathname === '/' || 
         window.location.pathname.endsWith('/');
}

// Handle the sign-in callback from Google One Tap
function handleGoogleSignIn(response) {
  // Decode the JWT token from Google
  const payload = parseJwt(response.credential);
  
  currentUser = {
    email: payload.email,
    firstName: payload.given_name,
    lastName: payload.family_name,
    picture: payload.picture,
    authMethod: 'google' // Track authentication method
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
    if (isOnLoginPage()) {
      window.location.href = 'dashboard.html';
    }
    return currentUser;
  } else {
    // Check with Google Auth as well if available
    if (googleAuth) {
      try {
        const isSignedInWithGoogle = googleAuth.isSignedIn.get();
        if (isSignedInWithGoogle) {
          // Google says we're signed in but localStorage doesn't have user data
          // This is a sync issue - updateSigninStatus will handle it
          updateSigninStatus(true);
          return currentUser;
        } else if (!isOnLoginPage()) {
          // Not signed in and not on login page - redirect
          window.location.href = 'index.html';
          return null;
        }
      } catch (e) {
        console.error("Error checking Google auth status", e);
        if (!isOnLoginPage()) {
          window.location.href = 'index.html';
        }
        return null;
      }
    } else {
      // Google Auth isn't ready yet, rely on localStorage only
      if (!isOnLoginPage() && !storedUser) {
        window.location.href = 'index.html';
        return null;
      }
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

// For handling manual sign-in
function handleManualSignIn(email, password) {
  // Get users from localStorage
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    showAlert("Invalid email or password");
    return false;
  }
  
  currentUser = {
    email: user.email,
    firstName: user.fName || "User",
    lastName: user.lName || "",
    authMethod: 'local' // Track authentication method
  };
  
  localStorage.setItem('user', JSON.stringify(currentUser));
  window.location.href = 'dashboard.html';
  return true;
}

// Sign out user
function logout() {
  // Get current user to check auth method
  const storedUser = localStorage.getItem('user');
  let authMethod = 'local';
  
  if (storedUser) {
    const userData = JSON.parse(storedUser);
    authMethod = userData.authMethod || 'local';
  }
  
  // If Google-authenticated, sign out from Google too
  if (authMethod === 'google') {
    // Disable auto-select for Google One Tap
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    
    // Sign out of Google Auth as well
    if (googleAuth) {
      googleAuth.signOut().then(function() {
        console.log('User signed out of Google Auth');
      }).catch(function(error) {
        console.error('Error signing out of Google Auth:', error);
      });
    }
  }

  // Clear all stored user data
  localStorage.removeItem('user');
  isAuthenticated = false;
  currentUser = null;

  // Redirect to login
  window.location.href = 'index.html';
}

// Display alert message
function showAlert(message) {
  const alertBox = document.getElementById("alertBox");
  const alertMessage = document.getElementById("alertMessage");
  
  if (alertBox && alertMessage) {
    alertMessage.innerText = message;
    alertBox.style.display = "block";
    setTimeout(() => {
      alertBox.style.display = "none";
    }, 4000);
  } else {
    // Fallback if alert elements don't exist
    alert(message);
  }
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Handle Sign-Up form submission
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", function(e) {
      e.preventDefault();
      
      const fName = document.getElementById("fName").value.trim();
      const lName = document.getElementById("lName").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      
      if (!email || !password) {
        showAlert("Email and password are required");
        return;
      }
      
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      
      // Check for duplicate user
      if (users.find((user) => user.email === email)) {
        showAlert("User already exists. Please sign in.");
        return;
      }
      
      users.push({ fName, lName, email, password });
      localStorage.setItem("users", JSON.stringify(users));
      
      // Set current user
      currentUser = {
        email: email,
        firstName: fName,
        lastName: lName,
        authMethod: 'local' // Track authentication method
      };
      
      localStorage.setItem('user', JSON.stringify(currentUser));
      window.location.href = "dashboard.html";
    });
  }
  
  // Handle Sign-In form submission
  const signinForm = document.getElementById("signinForm");
  if (signinForm) {
    signinForm.addEventListener("submit", function(e) {
      e.preventDefault();
      
      const email = document.getElementById("signinEmail").value.trim();
      const password = document.getElementById("signinPassword").value;
      
      handleManualSignIn(email, password);
    });
  }
  
  // Setup logout links
  const logoutLinks = document.querySelectorAll("#signOutLink, .logout-button");
  logoutLinks.forEach(link => {
    if (link) {
      link.addEventListener("click", function(e) {
        e.preventDefault();
        logout();
      });
    }
  });
  
  // Update user display on dashboard
  const userDisplays = document.querySelectorAll(".user-display");
  if (userDisplays.length > 0) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.firstName) {
      userDisplays.forEach(display => {
        display.textContent = `${user.firstName} ${user.lastName || ''}`.trim();
      });
    }
  }
});