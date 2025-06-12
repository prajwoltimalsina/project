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

// Simple hash function for passwords (in production, use a proper hashing library)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate password strength
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];
  if (password.length < minLength) errors.push(`Password must be at least ${minLength} characters long`);
  if (!hasUpperCase) errors.push('Password must contain at least one uppercase letter');
  if (!hasLowerCase) errors.push('Password must contain at least one lowercase letter');
  if (!hasNumbers) errors.push('Password must contain at least one number');
  if (!hasSpecialChar) errors.push('Password must contain at least one special character');

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

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
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
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
  const googleSigninDiv = document.getElementById("googleSigninDiv");
  const googleSignupDiv = document.getElementById("googleSignupDiv");

  // Only set up buttons if Google Identity Services is loaded and on a page with the divs
  if (google && google.accounts && google.accounts.id && (googleSigninDiv || googleSignupDiv)) {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleGoogleSignIn,
      auto_select: false
    });

    // Render the sign-in button if its div exists
    if (googleSigninDiv) {
      google.accounts.id.renderButton(
        googleSigninDiv,
        { theme: "outline", size: "large", width: 250, text: "signin_with" }
      );
    }

    // Render the sign-up button if its div exists
    if (googleSignupDiv) {
      google.accounts.id.renderButton(
        googleSignupDiv,
        { theme: "outline", size: "large", width: 250, text: "signup_with" }
      );
    }
  } else if (!(
    google && google.accounts && google.accounts.id
  )) {
    console.error("Google Identity Services not loaded properly or elements not found.");
  }
  
  // Check if user is already signed in (this remains page-independent)
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
      authMethod: 'google',
      lastLogin: new Date().toISOString()
    };
    
    // Save to localStorage with session info
    const sessionData = {
      user: currentUser,
      sessionStart: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hour expiry
    };
    localStorage.setItem('userSession', JSON.stringify(sessionData));
    
    // Check if we should redirect to dashboard
    if (isOnLoginPage()) {
      window.location.href = 'dashboard.html';
    }
  } else {
    handleSignOut();
  }
}

// Helper function to get base path
function getBasePath() {
  return '/project/';
}

// Helper function to check if we're on the login page
function isOnLoginPage() {
  const path = window.location.pathname;
  return path.endsWith('index.html') || 
         path.endsWith('/') || 
         path.endsWith('/project/');
}

// Helper function to check if we're on a protected page
function isOnProtectedPage() {
  const path = window.location.pathname;
  return path.includes('dashboard') || 
         path.includes('overview') || 
         path.includes('analytics');
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
    authMethod: 'google',
    lastLogin: new Date().toISOString()
  };
  
  // Save session data
  const sessionData = {
    user: currentUser,
    sessionStart: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hour expiry
  };
  localStorage.setItem('userSession', JSON.stringify(sessionData));
  
  // Check if user exists in your Google Sheet "database"
  checkUserInDatabase(currentUser.email, function(exists) {
    if (!exists) {
      // Add new user to database (Google Sheets)
      addUserToDatabase(currentUser.email, currentUser.firstName, currentUser.lastName);
    }
    
    // Navigate to dashboard with correct path
    window.location.href = getBasePath() + 'dashboard.html';
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

// Check if the user session is valid
function checkAuthStatus() {
  const sessionData = localStorage.getItem('userSession');
  
  if (!sessionData) {
    isAuthenticated = false;
    currentUser = null;
    
    // Only redirect if on a protected page
    if (isOnProtectedPage()) {
      window.location.href = 'index.html';
    }
    return null;
  }

  try {
    const { user, expiresAt } = JSON.parse(sessionData);
    
    // Check if session has expired
    if (new Date(expiresAt) <= new Date()) {
      handleSignOut();
      return null;
    }

    currentUser = user;
    isAuthenticated = true;
    return currentUser;
  } catch (error) {
    console.error('Error checking auth status:', error);
    handleSignOut();
    return null;
  }
}

// Handle sign out
function handleSignOut() {
  localStorage.removeItem('userSession');
  isAuthenticated = false;
  currentUser = null;

  if (googleAuth && googleAuth.isSignedIn.get()) {
    googleAuth.signOut();
  }

  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }

  window.location.href = getBasePath() + 'index.html';
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

// For handling manual sign-in
async function handleManualSignIn(email, password) {
  try {
    const usersStr = localStorage.getItem("users");
    if (!usersStr) {
      showAlert("Invalid email or password");
      return false;
    }
    
    const users = JSON.parse(usersStr);
    if (!Array.isArray(users)) {
      showAlert("Invalid user data format");
      return false;
    }
    
    const hashedPassword = await hashPassword(password);
    const user = users.find(u => u.email === email && u.hashedPassword === hashedPassword);
    
    if (!user) {
      showAlert("Invalid email or password");
      return false;
    }
    
    currentUser = {
      email: user.email,
      firstName: user.fName || "User",
      lastName: user.lName || "",
      authMethod: 'local',
      lastLogin: new Date().toISOString()
    };
    
    const sessionData = {
      user: currentUser,
      sessionStart: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    localStorage.setItem('userSession', JSON.stringify(sessionData));
    
    window.location.href = getBasePath() + 'dashboard.html';
    return true;
  } catch (error) {
    console.error('Error during sign in:', error);
    showAlert("An error occurred during sign in");
    return false;
  }
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Only check auth status on protected pages
  if (isOnProtectedPage()) {
    checkAuthStatus();
  }
  
  // Handle Sign-Up form submission
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      
      const fName = document.getElementById("fName").value.trim();
      const lName = document.getElementById("lName").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const confirmPassword = document.getElementById("confirmPassword").value;
      
      if (!email || !password) {
        showAlert("Email and password are required");
        return;
      }
      
      if (password !== confirmPassword) {
        showAlert("Passwords do not match");
        return;
      }
      
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        showAlert(passwordValidation.errors.join('\n'));
        return;
      }
      
      try {
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        
        if (users.find((user) => user.email === email)) {
          showAlert("User already exists. Please sign in.");
          return;
        }
        
        const hashedPassword = await hashPassword(password);
        
        users.push({ 
          fName, 
          lName, 
          email, 
          hashedPassword,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem("users", JSON.stringify(users));
        
        currentUser = {
          email: email,
          firstName: fName,
          lastName: lName,
          authMethod: 'local',
          lastLogin: new Date().toISOString()
        };
        
        const sessionData = {
          user: currentUser,
          sessionStart: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        localStorage.setItem('userSession', JSON.stringify(sessionData));
        
        window.location.href = getBasePath() + 'dashboard.html';
      } catch (error) {
        console.error('Error during sign up:', error);
        showAlert("An error occurred during sign up");
      }
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
        handleSignOut();
      });
    }
  });
});