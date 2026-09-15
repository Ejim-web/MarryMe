// ============================================================
// MARRYME — app.js
// Firebase Auth + Firestore + Cloudinary Photos
// ============================================================

// ============================================================
// 🔴 CLOUDINARY SETTINGS — ENTER YOUR VALUES HERE
// ============================================================

const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME";
const CLOUDINARY_UPLOAD_PRESET = "YOUR_UPLOAD_PRESET";

// Example:
// const CLOUDINARY_CLOUD_NAME = "dxxxxxxxx";
// const CLOUDINARY_UPLOAD_PRESET = "marryme_upload";


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentUser = null;
let currentProfile = null;
let currentCandidate = null;
let currentChatMatch = null;

let unsubscribeChat = null;
let unsubscribeMatches = null;


// ============================================================
// FIREBASE CHECK
// ============================================================

const firebaseReady =
  typeof firebase !== "undefined" &&
  typeof auth !== "undefined" &&
  typeof db !== "undefined";

if (!firebaseReady) {
  console.error("Firebase is not initialized correctly.");

  setTimeout(() => {
    alert(
      "MarryMe could not start correctly.\n\n" +
      "Please make sure Firebase SDK, firebase-config.js and app.js " +
      "are loaded in the correct order."
    );
  }, 500);
}


// ============================================================
// HELPERS
// ============================================================

function $(id) {
  return document.getElementById(id);
}

function esc(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toast(message) {
  const existing = document.querySelector(".marryme-toast");

  if (existing) {
    existing.remove();
  }

  const div = document.createElement("div");

  div.className = "marryme-toast";

  div.textContent = message;

  div.style.cssText = `
    position:fixed;
    left:50%;
    bottom:90px;
    transform:translateX(-50%);
    z-index:99999;
    background:#111827;
    color:white;
    padding:13px 18px;
    border-radius:14px;
    font-size:14px;
    max-width:90%;
    text-align:center;
    box-shadow:0 10px 30px rgba(0,0,0,.3);
  `;

  document.body.appendChild(div);

  setTimeout(() => {
    div.remove();
  }, 3000);
}

function openModal(id) {
  const modal = $(id);

  if (!modal) return;

  modal.classList.remove("hide");
  modal.classList.add("active");
}

function closeModal(id) {
  const modal = $(id);

  if (!modal) return;

  modal.classList.add("hide");
  modal.classList.remove("active");
}

function ageFromDob(dob) {
  if (!dob) return 0;

  const birth = new Date(dob);

  if (isNaN(birth.getTime())) return 0;

  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();

  const month = today.getMonth() - birth.getMonth();

  if (
    month < 0 ||
    (month === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age;
}

function validAdult(dob) {
  return ageFromDob(dob) >= 18;
}

function fmtTime(timestamp) {
  if (!timestamp) return "";

  try {
    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp);

    return date.toLocaleString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}


// ============================================================
// CLOUDINARY UPLOAD
// ============================================================

async function uploadToCloudinary(file) {

  if (!file) {
    throw new Error("No photo selected.");
  }

  if (
    !CLOUDINARY_CLOUD_NAME ||
    CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME"
  ) {
    throw new Error(
      "Cloudinary Cloud Name has not been entered in app.js."
    );
  }

  if (
    !CLOUDINARY_UPLOAD_PRESET ||
    CLOUDINARY_UPLOAD_PRESET === "YOUR_UPLOAD_PRESET"
  ) {
    throw new Error(
      "Cloudinary Upload Preset has not been entered in app.js."
    );
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Photo must be smaller than 10MB.");
  }

  const formData = new FormData();

  formData.append("file", file);

  formData.append(
    "upload_preset",
    CLOUDINARY_UPLOAD_PRESET
  );

  formData.append(
    "folder",
    `marryme/${currentUser.uid}`
  );

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      CLOUDINARY_CLOUD_NAME
    )}/image/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok || !data.secure_url) {
    console.error("Cloudinary error:", data);

    throw new Error(
      data?.error?.message ||
      "Cloudinary upload failed."
    );
  }

  return data.secure_url;
}


// ============================================================
// AUTH — LOGIN
// ============================================================

$("loginForm")?.addEventListener("submit", async (event) => {

  event.preventDefault();

  if (!firebaseReady) {
    toast("Firebase is not ready.");
    return;
  }

  const email = $("loginEmail")?.value.trim();
  const password = $("loginPassword")?.value;

  if (!email || !password) {
    toast("Enter your email and password.");
    return;
  }

  try {

    toast("Signing in...");

    await auth.signInWithEmailAndPassword(
      email,
      password
    );

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Unable to sign in."
    );
  }
});


// ============================================================
// AUTH — SIGN UP
// ============================================================

$("signupForm")?.addEventListener("submit", async (event) => {

  event.preventDefault();

  if (!firebaseReady) {
    toast("Firebase is not ready.");
    return;
  }

  const name = $("signupName")?.value.trim();
  const email = $("signupEmail")?.value.trim();
  const password = $("signupPassword")?.value;
  const dob = $("signupDob")?.value;

  const adultCheck =
    $("signupAdult")?.checked;

  if (!name || !email || !password || !dob) {
    toast("Please complete all required fields.");
    return;
  }

  if (!validAdult(dob)) {
    toast("MarryMe is for adults 18+ only.");
    return;
  }

  if (!adultCheck) {
    toast("You must confirm that you are 18 or older.");
    return;
  }

  if (password.length < 6) {
    toast("Password must contain at least 6 characters.");
    return;
  }

  try {

    toast("Creating your account...");

    const result =
      await auth.createUserWithEmailAndPassword(
        email,
        password
      );

    const user = result.user;

    await user.updateProfile({
      displayName: name
    });

    await db
      .collection("users")
      .doc(user.uid)
      .set(
        {
          uid: user.uid,
          name: name,
          email: email,
          dob: dob,
          age: ageFromDob(dob),
          isActive: true,
          isVerified: false,
          photos: [],
          createdAt:
            firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt:
            firebase.firestore.FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

    try {
      await user.sendEmailVerification();
      toast("Account created. Verification email sent.");
    } catch {
      toast("Account created successfully.");
    }

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Unable to create account."
    );
  }
});


// ============================================================
// GOOGLE LOGIN
// ============================================================

$("googleLoginBtn")?.addEventListener("click", async () => {

  if (!firebaseReady) {
    toast("Firebase is not ready.");
    return;
  }

  try {

    const provider =
      new firebase.auth.GoogleAuthProvider();

    await auth.signInWithPopup(provider);

  } catch (error) {

    console.error("Google login error:", error);

    if (
      error.code ===
      "auth/popup-blocked"
    ) {
      try {

        const provider =
          new firebase.auth.GoogleAuthProvider();

        await auth.signInWithRedirect(provider);

      } catch (redirectError) {

        console.error(redirectError);

        toast(
          redirectError.message ||
          "Google login failed."
        );
      }

      return;
    }

    toast(
      error.message ||
      "Google login failed."
    );
  }
});


// ============================================================
// FORGOT PASSWORD
// ============================================================

$("forgotPasswordBtn")?.addEventListener(
  "click",
  async () => {

    if (!firebaseReady) {
      toast("Firebase is not ready.");
      return;
    }

    const email =
      $("loginEmail")?.value.trim();

    if (!email) {
      toast("Enter your email first.");
      return;
    }

    try {

      await auth.sendPasswordResetEmail(email);

      toast(
        "Password reset email sent."
      );

    } catch (error) {

      console.error(error);

      toast(
        error.message ||
        "Unable to send reset email."
      );
    }
  }
);


// ============================================================
// LOGOUT
// ============================================================

$("logoutBtn")?.addEventListener(
  "click",
  async () => {

    if (!firebaseReady) return;

    try {

      await auth.signOut();

    } catch (error) {

      console.error(error);

      toast("Unable to log out.");
    }
  }
);


// ============================================================
// AUTH STATE
// ============================================================

if (firebaseReady) {

  auth.onAuthStateChanged(async (user) => {

    currentUser = user;

    const authScreen =
      $("authScreen");

    const appScreen =
      $("appScreen");

    if (!user) {

      if (authScreen) {
        authScreen.classList.remove("hide");
      }

      if (appScreen) {
        appScreen.classList.add("hide");
      }

      if (unsubscribeMatches) {
        unsubscribeMatches();
        unsubscribeMatches = null;
      }

      if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
      }

      return;
    }

    try {

      if (authScreen) {
        authScreen.classList.add("hide");
      }

      if (appScreen) {
        appScreen.classList.remove("hide");
      }

      await ensureUserDocument();

      await loadMyProfile();

      await loadDiscover();

      listenForMatches();

      showTab("discover");

    } catch (error) {

      console.error(
        "Startup error:",
        error
      );

      toast(
        "Your account loaded, but some data could not be loaded."
      );
    }

  });

}


// ============================================================
// ENSURE USER DOCUMENT
// ============================================================

async function ensureUserDocument() {

  if (!currentUser) return;

  const ref =
    db.collection("users")
      .doc(currentUser.uid);

  const snap = await ref.get();

  if (!snap.exists) {

    await ref.set(
      {
        uid: currentUser.uid,
        name:
          currentUser.displayName ||
          "MarryMe User",
        email:
          currentUser.email || "",
        photos: [],
        isActive: true,
        isVerified:
          currentUser.emailVerified || false,
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:
          firebase.firestore.FieldValue.serverTimestamp()
      },
      {
        merge: true
      }
    );
  }
}


// ============================================================
// LOAD MY PROFILE
// ============================================================

async function loadMyProfile() {

  if (!currentUser) return;

  const snap =
    await db
      .collection("users")
      .doc(currentUser.uid)
      .get();

  if (!snap.exists) {

    currentProfile = null;

    return;
  }

  currentProfile = {
    id: snap.id,
    ...snap.data()
  };

  renderMyProfile();
}


// ============================================================
// RENDER MY PROFILE
// ============================================================

function renderMyProfile() {

  if (!currentProfile) return;

  const name =
    currentProfile.name ||
    currentUser?.displayName ||
    "Your Name";

  const age =
    currentProfile.age ||
    ageFromDob(currentProfile.dob);

  const occupation =
    currentProfile.occupation ||
    "";

  const city =
    currentProfile.city ||
    "";

  const bio =
    currentProfile.bio ||
    "Tell people about yourself.";

  const profileName =
    $("profileName");

  const profileAge =
    $("profileAge");

  const profileOccupation =
    $("profileOccupation");

  const profileCity =
    $("profileCity");

  const profileBio =
    $("profileBio");

  if (profileName) {
    profileName.textContent = name;
  }

  if (profileAge) {
    profileAge.textContent =
      age ? `, ${age}` : "";
  }

  if (profileOccupation) {
    profileOccupation.textContent =
      occupation;
  }

  if (profileCity) {
    profileCity.textContent =
      city;
  }

  if (profileBio) {
    profileBio.textContent =
      bio;
  }

  const profileImage =
    $("profileImage");

  const photos =
    currentProfile.photos || [];

  if (profileImage && photos.length) {
    profileImage.src = photos[0];
  }
}


// ============================================================
// OPEN PROFILE EDITOR
// ============================================================

window.openProfileEditor = function () {

  if (!currentProfile) {
    toast("Profile is still loading.");
    return;
  }

  const fields = {
    profileFullName:
      currentProfile.name || "",

    profileDob:
      currentProfile.dob || "",

    profileGender:
      currentProfile.gender || "",

    profileCity:
      currentProfile.city || "",

    profileOccupation:
      currentProfile.occupation || "",

    profileIntention:
      currentProfile.intention || "",

    profileChildren:
      currentProfile.childrenPreference || "",

    profileBio:
      currentProfile.bio || "",

    profileInterests:
      Array.isArray(currentProfile.interests)
        ? currentProfile.interests.join(", ")
        : currentProfile.interests || ""
  };

  Object.entries(fields).forEach(
    ([id, value]) => {

      const element = $(id);

      if (element) {
        element.value = value;
      }

    }
  );

  openModal("profileModal");
};


// ============================================================
// SAVE PROFILE
// ============================================================

$("profileForm")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (!currentUser) {
      toast("Please sign in first.");
      return;
    }

    const name =
      $("profileFullName")?.value.trim();

    const dob =
      $("profileDob")?.value;

    const gender =
      $("profileGender")?.value;

    const city =
      $("profileCity")?.value.trim();

    const occupation =
      $("profileOccupation")?.value.trim();

    const intention =
      $("profileIntention")?.value;

    const childrenPreference =
      $("profileChildren")?.value;

    const bio =
      $("profileBio")?.value.trim();

    const interestsText =
      $("profileInterests")?.value.trim();

    if (!name || !dob) {
      toast("Name and date of birth are required.");
      return;
    }

    if (!validAdult(dob)) {
      toast("You must be at least 18 years old.");
      return;
    }

    const interests =
      interestsText
        ? interestsText
            .split(",")
            .map(item => item.trim())
            .filter(Boolean)
        : [];

    try {

      await db
        .collection("users")
        .doc(currentUser.uid)
        .set(
          {
            name,
            dob,
            age: ageFromDob(dob),
            gender: gender || "",
            city: city || "",
            occupation: occupation || "",
            intention: intention || "",
            childrenPreference:
              childrenPreference || "",
            bio: bio || "",
            interests,
            isActive: true,
            updatedAt:
              firebase.firestore.FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

      await loadMyProfile();

      closeModal("profileModal");

      toast("Profile updated successfully.");

    } catch (error) {

      console.error(error);

      toast(
        error.message ||
        "Unable to save profile."
      );
    }
  }
);


// ============================================================
// PHOTO UPLOAD — CLOUDINARY
// ============================================================

$("profilePhotos")?.addEventListener(
  "change",
  async (event) => {

    if (!currentUser) {
      toast("Please sign in first.");
      return;
    }

    const files =
      Array.from(event.target.files || []);

    if (!files.length) return;

    const existingPhotos =
      Array.isArray(currentProfile?.photos)
        ? [...currentProfile.photos]
        : [];

    if (existingPhotos.length + files.length > 6) {
      toast("You can have a maximum of 6 photos.");
      event.target.value = "";
      return;
    }

    try {

      toast(
        `Uploading ${files.length} photo${
          files.length > 1 ? "s" : ""
        }...`
      );

      for (const file of files) {

        const url =
          await uploadToCloudinary(file);

        existingPhotos.push(url);
      }

      await db
        .collection("users")
        .doc(currentUser.uid)
        .set(
          {
            photos: existingPhotos,
            updatedAt:
              firebase.firestore.FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

      await loadMyProfile();

      toast("Photo upload successful.");

    } catch (error) {

      console.error(
        "Photo upload error:",
        error
      );

      toast(
        error.message ||
        "Photo upload failed."
      );

    } finally {

      event.target.value = "";
    }
  }
);


// ============================================================
// DISCOVER
// ============================================================

async function loadDiscover() {

  if (!currentUser) return;

  const container =
    $("discoverList");

  if (!container) return;

  container.innerHTML = `
    <div class="text-center p-8">
      <div class="animate-spin text-3xl">♥</div>
      <p class="mt-3 text-gray-500">
        Finding compatible people...
      </p>
    </div>
  `;

  try {

    const blocksSnap =
      await db
        .collection("users")
        .doc(currentUser.uid)
        .collection("blocks")
        .get();

    const blocked =
      new Set(
        blocksSnap.docs.map(
          doc => doc.id
        )
      );

    const likesSnap =
      await db
        .collection("users")
        .doc(currentUser.uid)
        .collection("likes")
        .get();

    const liked =
      new Set(
        likesSnap.docs.map(
          doc => doc.id
        )
      );

    const snap =
      await db
        .collection("users")
        .where("isActive", "==", true)
        .limit(100)
        .get();

    let candidates =
      snap.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(profile => {

          if (profile.id === currentUser.uid) {
            return false;
          }

          if (blocked.has(profile.id)) {
            return false;
          }

          if (liked.has(profile.id)) {
            return false;
          }

          const age =
            profile.age ||
            ageFromDob(profile.dob);

          if (age && age < 18) {
            return false;
          }

          return true;
        });

    candidates =
      applyCurrentFilters(candidates);

    currentCandidate =
      candidates.length
        ? candidates[0]
        : null;

    renderDiscover(candidates);

  } catch (error) {

    console.error(error);

    container.innerHTML = `
      <div class="text-center p-8">
        <p class="text-red-500">
          Unable to load profiles.
        </p>
        <button
          onclick="loadDiscover()"
          class="mt-4 px-5 py-3 rounded-xl bg-pink-500 text-white">
          Try Again
        </button>
      </div>
    `;
  }
}


// ============================================================
// FILTER MEMORY
// ============================================================

let currentFilters = {
  minAge: 18,
  maxAge: 80,
  gender: "",
  intention: ""
};

function applyCurrentFilters(profiles) {

  return profiles.filter(profile => {

    const age =
      profile.age ||
      ageFromDob(profile.dob);

    if (
      age &&
      (
        age < currentFilters.minAge ||
        age > currentFilters.maxAge
      )
    ) {
      return false;
    }

    if (
      currentFilters.gender &&
      profile.gender !== currentFilters.gender
    ) {
      return false;
    }

    if (
      currentFilters.intention &&
      profile.intention !== currentFilters.intention
    ) {
      return false;
    }

    return true;
  });
}


// ============================================================
// RENDER DISCOVER
// ============================================================

function renderDiscover(profiles) {

  const container =
    $("discoverList");

  if (!container) return;

  if (!profiles.length) {

    currentCandidate = null;

    container.innerHTML = `
      <div class="text-center p-8">
        <div class="text-5xl mb-4">💗</div>
        <h3 class="font-bold text-xl">
          No more profiles
        </h3>
        <p class="text-gray-500 mt-2">
          Try changing your filters or come back later.
        </p>
      </div>
    `;

    return;
  }

  currentCandidate =
    profiles[0];

  const profile =
    profiles[0];

  const age =
    profile.age ||
    ageFromDob(profile.dob);

  const photos =
    Array.isArray(profile.photos)
      ? profile.photos
      : [];

  const photo =
    photos[0] ||
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80";

  container.innerHTML = `
    <div class="bg-white rounded-3xl overflow-hidden shadow-xl">

      <div class="relative">

        <img
          src="${esc(photo)}"
          class="w-full h-[430px] object-cover"
          alt="${esc(profile.name || "Profile")}"
        />

        <div class="absolute inset-x-0 bottom-0 p-6 text-white bg-gradient-to-t from-black/80 to-transparent">

          <h2 class="text-2xl font-bold">
            ${esc(profile.name || "Unknown")}
            ${age ? `, ${age}` : ""}
          </h2>

          ${
            profile.occupation
              ? `<p class="text-sm mt-1">${esc(profile.occupation)}</p>`
              : ""
          }

          ${
            profile.city
              ? `<p class="text-sm opacity-90">📍 ${esc(profile.city)}</p>`
              : ""
          }

        </div>

      </div>

      <div class="p-5">

        ${
          profile.bio
            ? `
              <p class="text-gray-600 mb-4">
                ${esc(profile.bio)}
              </p>
            `
            : ""
        }

        ${
          profile.intention
            ? `
              <div class="inline-block bg-pink-50 text-pink-600 px-3 py-2 rounded-full text-sm">
                ${esc(profile.intention)}
              </div>
            `
            : ""
        }

        <div class="grid grid-cols-3 gap-3 mt-5">

          <button
            onclick="passCurrent()"
            class="rounded-2xl py-4 bg-gray-100 text-gray-700 font-semibold">
            ✕
            <span class="block text-xs mt-1">Pass</span>
          </button>

          <button
            onclick="likeCurrent()"
            class="rounded-2xl py-4 bg-pink-500 text-white font-semibold">
            ♥
            <span class="block text-xs mt-1">Like</span>
          </button>

          <button
            onclick="viewCurrentProfile()"
            class="rounded-2xl py-4 bg-purple-100 text-purple-700 font-semibold">
            👤
            <span class="block text-xs mt-1">View</span>
          </button>

        </div>

      </div>

    </div>
  `;
}


// ============================================================
// LIKE
// ============================================================

window.likeCurrent = async function () {

  if (!currentUser) {
    toast("Please sign in.");
    return;
  }

  if (!currentCandidate) {
    toast("No profile available.");
    return;
  }

  const candidate =
    currentCandidate;

  try {

    await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("likes")
      .doc(candidate.id)
      .set({
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });

    toast(
      `You liked ${candidate.name || "this person"} ❤️`
    );

    await loadDiscover();

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Unable to like profile."
    );
  }
};


// ============================================================
// PASS
// ============================================================

window.passCurrent = async function () {

  if (!currentCandidate) {
    toast("No profile available.");
    return;
  }

  currentCandidate = null;

  await loadDiscover();
};


// ============================================================
// VIEW PROFILE
// ============================================================

window.viewCurrentProfile = function () {

  if (!currentCandidate) {
    toast("No profile available.");
    return;
  }

  renderFullProfile(
    currentCandidate
  );

  openModal(
    "viewProfileModal"
  );
};


function renderFullProfile(profile) {

  const container =
    $("viewProfileContent");

  if (!container) return;

  const age =
    profile.age ||
    ageFromDob(profile.dob);

  const photos =
    Array.isArray(profile.photos)
      ? profile.photos
      : [];

  const photo =
    photos[0] ||
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80";

  const interests =
    Array.isArray(profile.interests)
      ? profile.interests
      : [];

  container.innerHTML = `
    <div>

      <img
        src="${esc(photo)}"
        class="w-full h-80 object-cover rounded-2xl"
        alt="${esc(profile.name || "Profile")}"
      />

      <h2 class="text-2xl font-bold mt-5">
        ${esc(profile.name || "Unknown")}
        ${age ? `, ${age}` : ""}
      </h2>

      ${
        profile.occupation
          ? `<p class="text-gray-500 mt-1">${esc(profile.occupation)}</p>`
          : ""
      }

      ${
        profile.city
          ? `<p class="text-gray-500">📍 ${esc(profile.city)}</p>`
          : ""
      }

      ${
        profile.bio
          ? `
            <p class="mt-5 text-gray-700">
              ${esc(profile.bio)}
            </p>
          `
          : ""
      }

      ${
        profile.intention
          ? `
            <div class="mt-5">
              <strong>Looking for:</strong>
              <p>${esc(profile.intention)}</p>
            </div>
          `
          : ""
      }

      ${
        interests.length
          ? `
            <div class="mt-5 flex flex-wrap gap-2">
              ${interests.map(
                interest =>
                  `<span class="px-3 py-2 bg-pink-50 text-pink-600 rounded-full text-sm">
                    ${esc(interest)}
                  </span>`
              ).join("")}
            </div>
          `
          : ""
      }

      <button
        onclick="likeCurrent(); closeModal('viewProfileModal')"
        class="w-full mt-6 py-4 rounded-2xl bg-pink-500 text-white font-bold">
        ❤️ Like ${esc(profile.name || "Profile")}
      </button>

    </div>
  `;
}


// ============================================================
// FILTERS
// ============================================================

window.openFilters = function () {

  const values = {
    filterMinAge: currentFilters.minAge,
    filterMaxAge: currentFilters.maxAge,
    filterGender: currentFilters.gender,
    filterIntention: currentFilters.intention
  };

  Object.entries(values).forEach(
    ([id, value]) => {

      const element = $(id);

      if (element) {
        element.value = value;
      }

    }
  );

  openModal("filterModal");
};


$("filterForm")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    currentFilters = {
      minAge:
        Number(
          $("filterMinAge")?.value
        ) || 18,

      maxAge:
        Number(
          $("filterMaxAge")?.value
        ) || 80,

      gender:
        $("filterGender")?.value || "",

      intention:
        $("filterIntention")?.value || ""
    };

    closeModal("filterModal");

    await loadDiscover();
  }
);


// ============================================================
// MATCHES
// ============================================================

function listenForMatches() {

  if (!currentUser) return;

  if (unsubscribeMatches) {
    unsubscribeMatches();
  }

  unsubscribeMatches =
    db
      .collection("matches")
      .where(
        "userIds",
        "array-contains",
        currentUser.uid
      )
      .onSnapshot(
        async snapshot => {

          const matches =
            snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));

          await renderMatches(matches);

        },
        error => {

          console.error(
            "Matches listener:",
            error
          );

          toast(
            "Unable to load matches."
          );
        }
      );
}


async function getOtherUser(match) {

  if (!match.userIds) return null;

  const otherId =
    match.userIds.find(
      id => id !== currentUser.uid
    );

  if (!otherId) return null;

  const snap =
    await db
      .collection("users")
      .doc(otherId)
      .get();

  if (!snap.exists) return null;

  return {
    id: snap.id,
    ...snap.data()
  };
}


async function renderMatches(matches) {

  const container =
    $("matchesList");

  if (!container) return;

  if (!matches.length) {

    container.innerHTML = `
      <div class="text-center p-8">
        <div class="text-5xl">💞</div>
        <h3 class="font-bold text-xl mt-4">
          No matches yet
        </h3>
        <p class="text-gray-500 mt-2">
          Like someone and wait for a mutual connection.
        </p>
      </div>
    `;

    return;
  }

  const users = [];

  for (const match of matches) {

    const user =
      await getOtherUser(match);

    if (user) {
      users.push({
        match,
        user
      });
    }
  }

  container.innerHTML =
    users.map(({ match, user }) => {

      const photo =
        user.photos?.[0] ||
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80";

      return `
        <button
          onclick="openChat('${esc(match.id)}')"
          class="text-left bg-white rounded-2xl overflow-hidden shadow">

          <img
            src="${esc(photo)}"
            class="w-full h-48 object-cover"
            alt="${esc(user.name || "Match")}"
          />

          <div class="p-3">
            <strong>
              ${esc(user.name || "Match")}
            </strong>
          </div>

        </button>
      `;

    }).join("");

  await renderChatList(users);
}


// ============================================================
// CHAT LIST
// ============================================================

async function renderChatList(users) {

  const container =
    $("chatList");

  if (!container) return;

  if (!users.length) {

    container.innerHTML = `
      <div class="text-center p-8 text-gray-500">
        Your conversations will appear here.
      </div>
    `;

    return;
  }

  container.innerHTML =
    users.map(({ match, user }) => {

      const photo =
        user.photos?.[0] || "";

      return `
        <button
          onclick="openChat('${esc(match.id)}')"
          class="w-full flex items-center gap-3 p-4 border-b text-left">

          ${
            photo
              ? `
                <img
                  src="${esc(photo)}"
                  class="w-14 h-14 rounded-full object-cover"
                />
              `
              : `
                <div class="w-14 h-14 rounded-full bg-pink-100 flex items-center justify-center">
                  ❤️
                </div>
              `
          }

          <div class="flex-1">
            <strong>
              ${esc(user.name || "Match")}
            </strong>

            <p class="text-sm text-gray-500">
              Tap to chat
            </p>
          </div>

        </button>
      `;

    }).join("");
}


// ============================================================
// OPEN CHAT
// ============================================================

window.openChat = async function (matchId) {

  if (!currentUser) return;

  currentChatMatch = matchId;

  if (unsubscribeChat) {
    unsubscribeChat();
    unsubscribeChat = null;
  }

  const title =
    $("chatTitle");

  try {

    const matchSnap =
      await db
        .collection("matches")
        .doc(matchId)
        .get();

    if (!matchSnap.exists) {
      toast("Match not found.");
      return;
    }

    const match =
      matchSnap.data();

    if (
      !match.userIds ||
      !match.userIds.includes(
        currentUser.uid
      )
    ) {
      toast("You do not have access to this chat.");
      return;
    }

    const otherId =
      match.userIds.find(
        id => id !== currentUser.uid
      );

    const otherSnap =
      await db
        .collection("users")
        .doc(otherId)
        .get();

    const other =
      otherSnap.exists
        ? otherSnap.data()
        : {};

    if (title) {
      title.textContent =
        other.name || "Chat";
    }

    openModal("chatModal");

    unsubscribeChat =
      db
        .collection("matches")
        .doc(matchId)
        .collection("messages")
        .orderBy(
          "createdAt",
          "asc"
        )
        .onSnapshot(
          snapshot => {

            renderMessages(
              snapshot.docs
            );

          },
          error => {

            console.error(
              "Chat listener:",
              error
            );

            toast(
              "Unable to load messages."
            );
          }
        );

  } catch (error) {

    console.error(error);

    toast(
      "Unable to open chat."
    );
  }
};


// ============================================================
// RENDER MESSAGES
// ============================================================

function renderMessages(docs) {

  const container =
    $("chatMessages");

  if (!container) return;

  if (!docs.length) {

    container.innerHTML = `
      <div class="text-center text-gray-400 py-10">
        Say hello 👋
      </div>
    `;

    return;
  }

  container.innerHTML =
    docs.map(doc => {

      const message =
        doc.data();

      const mine =
        message.senderId ===
        currentUser.uid;

      return `
        <div
          class="flex ${
            mine
              ? "justify-end"
              : "justify-start"
          } mb-3">

          <div
            class="${
              mine
                ? "bg-pink-500 text-white"
                : "bg-gray-100 text-gray-800"
            } px-4 py-3 rounded-2xl max-w-[80%]">

            <div>
              ${esc(message.text)}
            </div>

            <div class="text-[10px] opacity-70 mt-1">
              ${fmtTime(message.createdAt)}
            </div>

          </div>

        </div>
      `;

    }).join("");

  container.scrollTop =
    container.scrollHeight;
}


// ============================================================
// SEND CHAT MESSAGE
// ============================================================

$("chatForm")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (
      !currentUser ||
      !currentChatMatch
    ) {
      return;
    }

    const input =
      $("chatInput");

    if (!input) return;

    const text =
      input.value.trim();

    if (!text) return;

    if (text.length > 1000) {
      toast("Message is too long.");
      return;
    }

    try {

      input.disabled = true;

      await db
        .collection("matches")
        .doc(currentChatMatch)
        .collection("messages")
        .add({
          senderId:
            currentUser.uid,

          text,

          createdAt:
            firebase.firestore.FieldValue.serverTimestamp()
        });

      await db
        .collection("matches")
        .doc(currentChatMatch)
        .update({
          lastMessageAt:
            firebase.firestore.FieldValue.serverTimestamp()
        });

      input.value = "";

    } catch (error) {

      console.error(error);

      toast(
        error.message ||
        "Unable to send message."
      );

    } finally {

      input.disabled = false;

      input.focus();
    }
  }
);


// ============================================================
// BLOCK USER
// ============================================================

window.blockCurrentChatUser = async function () {

  if (
    !currentUser ||
    !currentChatMatch
  ) {
    return;
  }

  try {

    const matchSnap =
      await db
        .collection("matches")
        .doc(currentChatMatch)
        .get();

    if (!matchSnap.exists) return;

    const match =
      matchSnap.data();

    const otherId =
      match.userIds.find(
        id => id !== currentUser.uid
      );

    if (!otherId) return;

    await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("blocks")
      .doc(otherId)
      .set({
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });

    closeModal("chatModal");

    toast("User blocked.");

    await loadDiscover();

  } catch (error) {

    console.error(error);

    toast(
      "Unable to block this user."
    );
  }
};


// ============================================================
// UNMATCH
// ============================================================

window.unmatchCurrentChat = async function () {

  if (!currentChatMatch) return;

  try {

    await db
      .collection("matches")
      .doc(currentChatMatch)
      .update({
        active: false
      });

    closeModal("chatModal");

    toast("Match removed.");

  } catch (error) {

    console.error(error);

    toast(
      "Unable to remove match."
    );
  }
};


// ============================================================
// REPORT USER
// ============================================================

window.reportCurrentChatUser = async function () {

  if (
    !currentUser ||
    !currentChatMatch
  ) {
    return;
  }

  const reason =
    prompt(
      "Why are you reporting this user?"
    );

  if (!reason || !reason.trim()) {
    return;
  }

  try {

    const matchSnap =
      await db
        .collection("matches")
        .doc(currentChatMatch)
        .get();

    if (!matchSnap.exists) return;

    const match =
      matchSnap.data();

    const otherId =
      match.userIds.find(
        id => id !== currentUser.uid
      );

    if (!otherId) return;

    await db
      .collection("reports")
      .add({
        reporterId:
          currentUser.uid,

        targetId:
          otherId,

        reason:
          reason.trim(),

        status:
          "pending",

        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });

    toast(
      "Report submitted. Thank you."
    );

  } catch (error) {

    console.error(error);

    toast(
      "Unable to submit report."
    );
  }
};


// ============================================================
// NAVIGATION
// ============================================================

function showTab(tabName) {

  document
    .querySelectorAll("[data-tab]")
    .forEach(element => {

      element.classList.toggle(
        "hide",
        element.dataset.tab !== tabName
      );

    });

  document
    .querySelectorAll(".tab")
    .forEach(element => {

      element.classList.toggle(
        "active",
        element.dataset.target === tabName
      );

    });

  if (tabName === "discover") {
    loadDiscover();
  }

  if (tabName === "profile") {
    loadMyProfile();
  }
}

window.showTab = showTab;

window.loadDiscover = loadDiscover;


// ============================================================
// BOTTOM NAVIGATION
// ============================================================

document
  .querySelectorAll(".tab")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const target =
          button.dataset.target;

        if (target) {
          showTab(target);
        }

      }
    );

  });


// ============================================================
// MODAL CLOSE BUTTONS
// ============================================================

document
  .querySelectorAll("[data-close-modal]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const modalId =
          button.dataset.closeModal;

        if (modalId) {
          closeModal(modalId);
        }

      }
    );

  });


// ============================================================
// CLICK OUTSIDE MODAL
// ============================================================

document
  .querySelectorAll(".modal")
  .forEach(modal => {

    modal.addEventListener(
      "click",
      event => {

        if (
          event.target === modal
        ) {
          modal.classList.add("hide");
          modal.classList.remove("active");
        }

      }
    );

  });


// ============================================================
// AUTH SCREEN SWITCHES
// ============================================================

window.showLogin = function () {

  $("loginBox")?.classList.remove("hide");

  $("signupBox")?.classList.add("hide");
};

window.showSignup = function () {

  $("signupBox")?.classList.remove("hide");

  $("loginBox")?.classList.add("hide");
};


// ============================================================
// STARTUP
// ============================================================

console.log(
  "MarryMe app.js loaded successfully."
);

if (!firebaseReady) {

  console.error(
    "MarryMe startup failed: Firebase services unavailable."
  );

} else {

  console.log(
    "MarryMe Firebase services ready."
  );

}
