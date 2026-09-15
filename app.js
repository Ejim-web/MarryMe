// ============================================================
// MARRYME — MAIN APPLICATION
// ============================================================

let currentUser = null;
let currentProfile = null;
let currentCandidate = null;
let currentChatMatch = null;
let unsubscribeChat = null;
let unsubscribeMatches = null;

const $ = (id) => document.getElementById(id);

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
  const el = $("toast");
  if (!el) {
    alert(message);
    return;
  }

  el.textContent = message;
  el.classList.remove("hide");

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.classList.add("hide");
  }, 3000);
}

function openModal(id) {
  const el = $(id);
  if (el) el.classList.remove("hide");
}

function closeModal(id) {
  const el = $(id);
  if (el) el.classList.add("hide");
}

window.openModal = openModal;
window.closeModal = closeModal;


// ============================================================
// DATE / AGE HELPERS
// ============================================================

function ageFromDob(dob) {
  if (!dob) return "";

  const birth = new Date(dob + "T00:00:00");

  if (Number.isNaN(birth.getTime())) return "";

  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();

  const monthDifference = today.getMonth() - birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age;
}

function validAdult(dob) {
  const age = ageFromDob(dob);
  return Number.isFinite(age) && age >= 18 && age <= 100;
}


// ============================================================
// TIME HELPERS
// ============================================================

function fmtTime(value) {
  if (!value) return "";

  let date;

  if (value.toDate) {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}


// ============================================================
// AUTH
// ============================================================

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("loginEmail")?.value.trim();
  const password = $("loginPassword")?.value;

  if (!email || !password) {
    toast("Enter your email and password.");
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    toast("Welcome back!");
  } catch (error) {
    console.error(error);

    let message = "Unable to sign in.";

    if (error.code === "auth/user-not-found") {
      message = "No account exists with this email.";
    } else if (error.code === "auth/wrong-password") {
      message = "Incorrect password.";
    } else if (error.code === "auth/invalid-credential") {
      message = "Email or password is incorrect.";
    } else if (error.code === "auth/invalid-email") {
      message = "Please enter a valid email address.";
    } else if (error.code === "auth/too-many-requests") {
      message = "Too many attempts. Try again later.";
    }

    toast(message);
  }
});


$("signupForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("signupName")?.value.trim();
  const email = $("signupEmail")?.value.trim();
  const password = $("signupPassword")?.value;
  const dob = $("signupDob")?.value;
  const agreed = $("signup18")?.checked;

  if (!name || !email || !password || !dob) {
    toast("Complete all required fields.");
    return;
  }

  if (!agreed) {
    toast("You must confirm that you are 18 or older.");
    return;
  }

  if (!validAdult(dob)) {
    toast("MarryMe is for adults aged 18 and above.");
    return;
  }

  if (password.length < 6) {
    toast("Password must contain at least 6 characters.");
    return;
  }

  try {
    const credential = await auth.createUserWithEmailAndPassword(
      email,
      password
    );

    const user = credential.user;

    await user.updateProfile({
      displayName: name
    });

    await db.collection("users").doc(user.uid).set({
      uid: user.uid,
      name,
      email,
      dob,
      gender: "",
      city: "",
      occupation: "",
      intention: "Marriage",
      childrenPreference: "",
      bio: "",
      interests: [],
      photos: [],
      isActive: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    try {
      await user.sendEmailVerification();
    } catch (verificationError) {
      console.warn("Email verification could not be sent:", verificationError);
    }

    toast("Account created successfully.");

  } catch (error) {
    console.error(error);

    let message = "Could not create your account.";

    if (error.code === "auth/email-already-in-use") {
      message = "An account with this email already exists.";
    } else if (error.code === "auth/invalid-email") {
      message = "Please enter a valid email address.";
    } else if (error.code === "auth/weak-password") {
      message = "Choose a stronger password.";
    }

    toast(message);
  }
});


$("googleLoginBtn")?.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();

  try {
    const result = await auth.signInWithPopup(provider);

    const user = result.user;

    const ref = db.collection("users").doc(user.uid);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      await ref.set({
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        dob: "",
        gender: "",
        city: "",
        occupation: "",
        intention: "Marriage",
        childrenPreference: "",
        bio: "",
        interests: [],
        photos: user.photoURL ? [user.photoURL] : [],
        isActive: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    toast("Signed in with Google.");

  } catch (error) {
    console.error(error);
    toast("Google sign-in failed.");
  }
});


$("forgotPasswordBtn")?.addEventListener("click", async () => {
  const email = $("loginEmail")?.value.trim();

  if (!email) {
    toast("Enter your email first.");
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    toast("Password reset email sent.");
  } catch (error) {
    console.error(error);
    toast("Could not send the reset email.");
  }
});


$("logoutBtn")?.addEventListener("click", async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error(error);
    toast("Could not sign out.");
  }
});


// ============================================================
// AUTH STATE
// ============================================================

auth.onAuthStateChanged(async (user) => {
  currentUser = user;

  const authScreen = $("authScreen");
  const appScreen = $("appScreen");

  if (!user) {
    if (authScreen) authScreen.classList.remove("hide");
    if (appScreen) appScreen.classList.add("hide");

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

  if (authScreen) authScreen.classList.add("hide");
  if (appScreen) appScreen.classList.remove("hide");

  await loadMyProfile();
  await loadDiscover();
  listenForMatches();

  showTab("discover");
});


// ============================================================
// PROFILE
// ============================================================

async function loadMyProfile() {
  if (!currentUser) return;

  try {
    const ref = db.collection("users").doc(currentUser.uid);
    const snap = await ref.get();

    if (!snap.exists) {
      currentProfile = {
        uid: currentUser.uid,
        name: currentUser.displayName || "",
        email: currentUser.email || "",
        photos: []
      };

      await ref.set({
        ...currentProfile,
        isActive: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      currentProfile = {
        uid: currentUser.uid,
        ...snap.data()
      };
    }

    renderMyProfile();

  } catch (error) {
    console.error("Profile load error:", error);
    toast("Could not load your profile.");
  }
}


function renderMyProfile() {
  if (!currentProfile) return;

  const name = currentProfile.name || currentUser?.displayName || "Your Name";

  const age = ageFromDob(currentProfile.dob);

  const displayName = $("myProfileName");
  if (displayName) {
    displayName.textContent = age ? `${name}, ${age}` : name;
  }

  const bio = $("myProfileBio");
  if (bio) {
    bio.textContent =
      currentProfile.bio ||
      "Complete your profile so people can get to know you.";
  }

  const city = $("myProfileCity");
  if (city) {
    city.textContent = currentProfile.city || "Add your city";
  }

  const occupation = $("myProfileOccupation");
  if (occupation) {
    occupation.textContent =
      currentProfile.occupation || "Add your occupation";
  }

  const photo =
    currentProfile.photos &&
    currentProfile.photos.length
      ? currentProfile.photos[0]
      : "";

  const image = $("myProfileImage");

  if (image) {
    if (photo) {
      image.src = photo;
      image.classList.remove("hide");
    } else {
      image.classList.add("hide");
    }
  }
}


// ============================================================
// PROFILE EDITOR
// ============================================================

window.openProfileEditor = function () {
  if (!currentProfile) return;

  $("profileName").value = currentProfile.name || "";
  $("profileDob").value = currentProfile.dob || "";
  $("profileGender").value = currentProfile.gender || "";
  $("profileCity").value = currentProfile.city || "";
  $("profileOccupation").value = currentProfile.occupation || "";
  $("profileIntention").value =
    currentProfile.intention || "Marriage";
  $("profileChildren").value =
    currentProfile.childrenPreference || "";
  $("profileBio").value = currentProfile.bio || "";
  $("profileInterests").value =
    Array.isArray(currentProfile.interests)
      ? currentProfile.interests.join(", ")
      : "";

  openModal("profileModal");
};


$("profileForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const name = $("profileName").value.trim();
  const dob = $("profileDob").value;
  const gender = $("profileGender").value;
  const city = $("profileCity").value.trim();
  const occupation = $("profileOccupation").value.trim();
  const intention = $("profileIntention").value;
  const childrenPreference = $("profileChildren").value;
  const bio = $("profileBio").value.trim();

  const interests = $("profileInterests")
    .value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (!name || !dob) {
    toast("Name and date of birth are required.");
    return;
  }

  if (!validAdult(dob)) {
    toast("You must be at least 18 years old.");
    return;
  }

  if (bio.length > 1000) {
    toast("Your bio is too long.");
    return;
  }

  try {
    await db.collection("users").doc(currentUser.uid).update({
      name,
      dob,
      gender,
      city,
      occupation,
      intention,
      childrenPreference,
      bio,
      interests,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await loadMyProfile();

    closeModal("profileModal");
    toast("Profile updated.");

    await loadDiscover();

  } catch (error) {
    console.error(error);
    toast("Could not save your profile.");
  }
});


// ============================================================
// PHOTO UPLOAD
// ============================================================

$("profilePhotos")?.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);

  if (!files.length || !currentUser) return;

  if (files.length > 6) {
    toast("You can upload up to 6 photos at a time.");
    return;
  }

  const uploadedUrls = [];

  try {
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast("Only image files are allowed.");
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast(`${file.name} is larger than 5 MB.`);
        continue;
      }

      const safeName =
        Date.now() +
        "_" +
        Math.random().toString(36).slice(2) +
        "_" +
        file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      const path =
        `users/${currentUser.uid}/photos/${safeName}`;

      const storageRef = storage.ref(path);

      const uploadTask = await storageRef.put(file, {
        contentType: file.type
      });

      const url = await uploadTask.ref.getDownloadURL();

      uploadedUrls.push(url);
    }

    if (!uploadedUrls.length) return;

    const existing =
      Array.isArray(currentProfile.photos)
        ? currentProfile.photos
        : [];

    const photos = [...existing, ...uploadedUrls].slice(0, 9);

    await db.collection("users").doc(currentUser.uid).update({
      photos,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await loadMyProfile();

    toast("Photos uploaded.");

  } catch (error) {
    console.error("Photo upload error:", error);
    toast("Photo upload failed.");
  }
});


// ============================================================
// DISCOVER
// ============================================================

let discoveryFilters = {
  minAge: 18,
  maxAge: 80,
  gender: "",
  intention: ""
};


async function loadDiscover() {
  if (!currentUser) return;

  const container = $("discoverList");

  if (container) {
    container.innerHTML = `
      <div class="card p-6 text-center">
        <div class="animate-pulse">
          Finding people for you...
        </div>
      </div>
    `;
  }

  try {
    const blockedSnapshot = await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("blocks")
      .get();

    const blockedIds = new Set(
      blockedSnapshot.docs.map(doc => doc.id)
    );

    const likedSnapshot = await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("likes")
      .get();

    const likedIds = new Set(
      likedSnapshot.docs.map(doc => doc.id)
    );

    const usersSnapshot = await db
      .collection("users")
      .where("isActive", "==", true)
      .limit(100)
      .get();

    const candidates = [];

    usersSnapshot.forEach(doc => {
      if (doc.id === currentUser.uid) return;
      if (blockedIds.has(doc.id)) return;
      if (likedIds.has(doc.id)) return;

      const data = doc.data();

      const age = ageFromDob(data.dob);

      if (!age || age < 18) return;

      if (
        age < Number(discoveryFilters.minAge) ||
        age > Number(discoveryFilters.maxAge)
      ) {
        return;
      }

      if (
        discoveryFilters.gender &&
        data.gender !== discoveryFilters.gender
      ) {
        return;
      }

      if (
        discoveryFilters.intention &&
        data.intention !== discoveryFilters.intention
      ) {
        return;
      }

      candidates.push({
        uid: doc.id,
        ...data
      });
    });

    renderDiscover(candidates);

  } catch (error) {
    console.error("Discover error:", error);

    if (container) {
      container.innerHTML = `
        <div class="card p-6 text-center">
          <p class="text-red-500 mb-3">
            Could not load profiles.
          </p>
          <button
            onclick="loadDiscover()"
            class="bgpink text-white px-5 py-3 rounded-xl"
          >
            Try Again
          </button>
        </div>
      `;
    }
  }
}


function renderDiscover(candidates) {
  const container = $("discoverList");

  if (!container) return;

  if (!candidates.length) {
    currentCandidate = null;

    container.innerHTML = `
      <div class="card p-8 text-center">
        <div class="text-5xl mb-4">💗</div>
        <h3 class="font-bold text-xl mb-2">
          No more profiles right now
        </h3>
        <p class="text-gray-500">
          Try changing your filters or check again later.
        </p>
      </div>
    `;

    return;
  }

  currentCandidate = candidates[0];

  const profile = candidates[0];

  const age = ageFromDob(profile.dob);

  const photos =
    Array.isArray(profile.photos) && profile.photos.length
      ? profile.photos
      : [];

  const photo =
    photos[0] ||
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80";

  const interests =
    Array.isArray(profile.interests)
      ? profile.interests
      : [];

  container.innerHTML = `
    <div class="card overflow-hidden">

      <div class="relative">

        <img
          src="${esc(photo)}"
          class="photo w-full h-[430px] object-cover"
          alt="${esc(profile.name || "Profile photo")}"
        >

        <div
          class="absolute inset-x-0 bottom-0 p-5 text-white"
          style="background:linear-gradient(transparent,rgba(0,0,0,.85));"
        >

          <h2 class="text-2xl font-bold">
            ${esc(profile.name || "Someone")}
            ${age ? `, ${age}` : ""}
          </h2>

          ${
            profile.city
              ? `<p class="text-sm mt-1">📍 ${esc(profile.city)}</p>`
              : ""
          }

          ${
            profile.occupation
              ? `<p class="text-sm mt-1">💼 ${esc(profile.occupation)}</p>`
              : ""
          }

        </div>
      </div>

      <div class="p-5">

        ${
          profile.intention
            ? `
              <div class="soft inline-block px-3 py-2 rounded-full text-sm mb-3">
                💍 ${esc(profile.intention)}
              </div>
            `
            : ""
        }

        ${
          profile.bio
            ? `
              <p class="text-gray-700 mb-4">
                ${esc(profile.bio)}
              </p>
            `
            : `
              <p class="text-gray-500 mb-4">
                This person hasn't added a bio yet.
              </p>
            `
        }

        ${
          interests.length
            ? `
              <div class="flex flex-wrap gap-2 mb-5">
                ${interests
                  .map(
                    item =>
                      `<span class="soft px-3 py-1 rounded-full text-sm">
                        ${esc(item)}
                      </span>`
                  )
                  .join("")}
              </div>
            `
            : ""
        }

        <div class="grid grid-cols-3 gap-3">

          <button
            onclick="passCurrent()"
            class="py-3 rounded-xl border border-gray-200 font-bold"
          >
            ✕
          </button>

          <button
            onclick="likeCurrent()"
            class="py-3 rounded-xl bgpink text-white font-bold"
          >
            ❤️ Like
          </button>

          <button
            onclick="viewCurrentProfile()"
            class="py-3 rounded-xl border border-gray-200 font-bold"
          >
            👤
          </button>

        </div>

      </div>
    </div>
  `;
}


// ============================================================
// LIKE / PASS
// ============================================================

window.likeCurrent = async function () {
  if (!currentUser || !currentCandidate) return;

  const candidate = currentCandidate;

  try {
    await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("likes")
      .doc(candidate.uid)
      .set({
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    toast("Like sent ❤️");

    currentCandidate = null;

    await loadDiscover();

  } catch (error) {
    console.error(error);
    toast("Could not send your like.");
  }
};


window.passCurrent = async function () {
  if (!currentCandidate) return;

  currentCandidate = null;

  await loadDiscover();
};


window.viewCurrentProfile = function () {
  if (!currentCandidate) return;

  const profile = currentCandidate;

  const age = ageFromDob(profile.dob);

  const photos =
    Array.isArray(profile.photos)
      ? profile.photos
      : [];

  const photo =
    photos[0] ||
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80";

  $("viewProfileContent").innerHTML = `
    <img
      src="${esc(photo)}"
      class="w-full h-80 object-cover rounded-2xl"
      alt=""
    >

    <h2 class="text-2xl font-bold mt-4">
      ${esc(profile.name || "Someone")}
      ${age ? `, ${age}` : ""}
    </h2>

    ${
      profile.city
        ? `<p class="text-gray-500 mt-1">📍 ${esc(profile.city)}</p>`
        : ""
    }

    ${
      profile.occupation
        ? `<p class="text-gray-500 mt-1">💼 ${esc(profile.occupation)}</p>`
        : ""
    }

    ${
      profile.intention
        ? `<p class="soft rounded-xl p-3 mt-4">
            💍 Looking for: ${esc(profile.intention)}
          </p>`
        : ""
    }

    <p class="mt-5 text-gray-700">
      ${esc(profile.bio || "No bio added yet.")}
    </p>

    ${
      Array.isArray(profile.interests) && profile.interests.length
        ? `
          <div class="flex flex-wrap gap-2 mt-5">
            ${profile.interests
              .map(
                item =>
                  `<span class="soft px-3 py-2 rounded-full text-sm">
                    ${esc(item)}
                  </span>`
              )
              .join("")}
          </div>
        `
        : ""
    }
  `;

  openModal("viewProfileModal");
};


// ============================================================
// FILTERS
// ============================================================

window.openFilters = function () {
  $("minAge").value = discoveryFilters.minAge;
  $("maxAge").value = discoveryFilters.maxAge;
  $("filterGender").value = discoveryFilters.gender;
  $("filterIntention").value = discoveryFilters.intention;

  openModal("filterModal");
};


$("filterForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  discoveryFilters.minAge =
    Number($("minAge").value) || 18;

  discoveryFilters.maxAge =
    Number($("maxAge").value) || 80;

  discoveryFilters.gender =
    $("filterGender").value;

  discoveryFilters.intention =
    $("filterIntention").value;

  if (discoveryFilters.minAge < 18) {
    discoveryFilters.minAge = 18;
  }

  if (discoveryFilters.maxAge < discoveryFilters.minAge) {
    toast("Maximum age must be greater than minimum age.");
    return;
  }

  closeModal("filterModal");

  await loadDiscover();
});


// ============================================================
// MATCHES
// ============================================================

function listenForMatches() {
  if (!currentUser) return;

  if (unsubscribeMatches) {
    unsubscribeMatches();
  }

  unsubscribeMatches = db
    .collection("matches")
    .where(
      "userIds",
      "array-contains",
      currentUser.uid
    )
    .orderBy("lastMessageAt", "desc")
    .onSnapshot(
      snapshot => {
        renderMatches(snapshot.docs);
        renderChatList(snapshot.docs);
      },
      error => {
        console.error("Match listener:", error);

        // If index isn't ready yet, load without ordering.
        db.collection("matches")
          .where(
            "userIds",
            "array-contains",
            currentUser.uid
          )
          .onSnapshot(
            fallbackSnapshot => {
              renderMatches(fallbackSnapshot.docs);
              renderChatList(fallbackSnapshot.docs);
            },
            fallbackError => {
              console.error(fallbackError);
            }
          );
      }
    );
}


async function getOtherUser(matchData) {
  const otherId = matchData.userIds.find(
    uid => uid !== currentUser.uid
  );

  if (!otherId) return null;

  try {
    const snap = await db
      .collection("users")
      .doc(otherId)
      .get();

    if (!snap.exists) return null;

    return {
      uid: otherId,
      ...snap.data()
    };

  } catch (error) {
    console.error(error);
    return null;
  }
}


async function renderMatches(matchDocs) {
  const container = $("matchesList");

  if (!container) return;

  if (!matchDocs.length) {
    container.innerHTML = `
      <div class="card p-8 text-center">
        <div class="text-5xl mb-4">💞</div>
        <h3 class="font-bold text-xl">
          No matches yet
        </h3>
        <p class="text-gray-500 mt-2">
          Like someone and wait for them to like you back.
        </p>
      </div>
    `;

    return;
  }

  const profiles = [];

  for (const doc of matchDocs) {
    const data = doc.data();

    if (data.active === false) continue;

    const other = await getOtherUser(data);

    if (other) {
      profiles.push({
        matchId: doc.id,
        ...other
      });
    }
  }

  if (!profiles.length) {
    container.innerHTML = `
      <div class="card p-8 text-center">
        No active matches yet.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="grid grid-cols-2 gap-4">
      ${profiles
        .map(profile => {
          const age = ageFromDob(profile.dob);

          const photo =
            Array.isArray(profile.photos) &&
            profile.photos.length
              ? profile.photos[0]
              : "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80";

          return `
            <button
              onclick="openChat('${esc(profile.matchId)}','${esc(profile.uid)}')"
              class="card overflow-hidden text-left"
            >
              <img
                src="${esc(photo)}"
                class="w-full h-44 object-cover"
                alt=""
              >

              <div class="p-3">
                <div class="font-bold">
                  ${esc(profile.name || "Match")}
                  ${age ? `, ${age}` : ""}
                </div>

                ${
                  profile.city
                    ? `<div class="text-xs text-gray-500 mt-1">
                        ${esc(profile.city)}
                      </div>`
                    : ""
                }
              </div>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}


async function renderChatList(matchDocs) {
  const container = $("chatList");

  if (!container) return;

  if (!matchDocs.length) {
    container.innerHTML = `
      <div class="card p-6 text-center text-gray-500">
        Your conversations will appear here.
      </div>
    `;
    return;
  }

  const rows = [];

  for (const doc of matchDocs) {
    const data = doc.data();

    if (data.active === false) continue;

    const other = await getOtherUser(data);

    if (!other) continue;

    const photo =
      Array.isArray(other.photos) && other.photos.length
        ? other.photos[0]
        : "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80";

    rows.push(`
      <button
        onclick="openChat('${esc(doc.id)}','${esc(other.uid)}')"
        class="w-full flex items-center gap-3 p-3 border-b border-gray-100 text-left"
      >

        <img
          src="${esc(photo)}"
          class="w-14 h-14 rounded-full object-cover"
          alt=""
        >

        <div class="flex-1 min-w-0">
          <div class="font-bold truncate">
            ${esc(other.name || "Match")}
          </div>

          <div class="text-sm text-gray-500 truncate">
            Tap to continue your conversation
          </div>
        </div>

        <span class="text-pink-500">›</span>

      </button>
    `);
  }

  container.innerHTML = rows.join("");
}


// ============================================================
// CHAT
// ============================================================

window.openChat = async function (matchId, otherUid) {
  if (!currentUser) return;

  currentChatMatch = {
    matchId,
    otherUid
  };

  if (unsubscribeChat) {
    unsubscribeChat();
    unsubscribeChat = null;
  }

  const otherSnap = await db
    .collection("users")
    .doc(otherUid)
    .get();

  if (otherSnap.exists) {
    const other = otherSnap.data();

    const title = $("chatTitle");

    if (title) {
      title.textContent = other.name || "Chat";
    }
  }

  const messages = $("chatMessages");

  if (messages) {
    messages.innerHTML = `
      <div class="text-center text-gray-400 p-6">
        Loading messages...
      </div>
    `;
  }

  openModal("chatModal");

  unsubscribeChat = db
    .collection("matches")
    .doc(matchId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .onSnapshot(
      snapshot => {
        renderMessages(snapshot.docs);
      },
      error => {
        console.error("Chat listener:", error);

        if (messages) {
          messages.innerHTML = `
            <div class="text-center text-red-500 p-6">
              Could not load messages.
            </div>
          `;
        }
      }
    );
};


function renderMessages(docs) {
  const container = $("chatMessages");

  if (!container) return;

  if (!docs.length) {
    container.innerHTML = `
      <div class="text-center text-gray-400 p-8">
        <div class="text-4xl mb-3">💬</div>
        Start the conversation.
      </div>
    `;
    return;
  }

  container.innerHTML = docs
    .map(doc => {
      const data = doc.data();

      const mine =
        data.senderId === currentUser.uid;

      return `
        <div class="flex ${mine ? "justify-end" : "justify-start"} mb-3">

          <div
            class="max-w-[78%] px-4 py-3 rounded-2xl ${
              mine
                ? "bgpink text-white rounded-br-md"
                : "bg-gray-100 text-gray-800 rounded-bl-md"
            }"
          >

            <div class="whitespace-pre-wrap break-words">
              ${esc(data.text)}
            </div>

            ${
              data.createdAt
                ? `
                  <div
                    class="text-[10px] mt-1 ${
                      mine
                        ? "text-white/70"
                        : "text-gray-400"
                    }"
                  >
                    ${fmtTime(data.createdAt)}
                  </div>
                `
                : ""
            }

          </div>

        </div>
      `;
    })
    .join("");

  container.scrollTop = container.scrollHeight;
}


$("chatForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser || !currentChatMatch) return;

  const input = $("chatInput");

  const text = input?.value.trim();

  if (!text) return;

  if (text.length > 1000) {
    toast("Message is too long.");
    return;
  }

  try {
    await db
      .collection("matches")
      .doc(currentChatMatch.matchId)
      .collection("messages")
      .add({
        senderId: currentUser.uid,
        text,
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });

    await db
      .collection("matches")
      .doc(currentChatMatch.matchId)
      .update({
        lastMessageAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });

    input.value = "";

  } catch (error) {
    console.error("Send message error:", error);
    toast("Message could not be sent.");
  }
});


// ============================================================
// BLOCK USER
// ============================================================

window.blockCurrentChatUser = async function () {
  if (!currentUser || !currentChatMatch) return;

  const confirmed = confirm(
    "Block this person? You will no longer see them in Discover."
  );

  if (!confirmed) return;

  try {
    await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("blocks")
      .doc(currentChatMatch.otherUid)
      .set({
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });

    await db
      .collection("matches")
      .doc(currentChatMatch.matchId)
      .update({
        active: false
      });

    closeModal("chatModal");

    toast("User blocked.");

    await loadDiscover();

  } catch (error) {
    console.error(error);
    toast("Could not block this user.");
  }
};


// ============================================================
// UNMATCH
// ============================================================

window.unmatchCurrentChat = async function () {
  if (!currentUser || !currentChatMatch) return;

  const confirmed = confirm(
    "Unmatch this person?"
  );

  if (!confirmed) return;

  try {
    await db
      .collection("matches")
      .doc(currentChatMatch.matchId)
      .update({
        active: false
      });

    closeModal("chatModal");

    toast("You have been unmatched.");

  } catch (error) {
    console.error(error);
    toast("Could not unmatch.");
  }
};


// ============================================================
// REPORT
// ============================================================

window.reportCurrentChatUser = async function () {
  if (!currentUser || !currentChatMatch) return;

  const reason =
    prompt(
      "Why are you reporting this person?\n\n" +
      "Examples: scam, harassment, fake profile, inappropriate content"
    );

  if (!reason || !reason.trim()) return;

  try {
    await db.collection("reports").add({
      reporterId: currentUser.uid,
      targetId: currentChatMatch.otherUid,
      reason: reason.trim().slice(0, 500),
      status: "pending",
      createdAt:
        firebase.firestore.FieldValue.serverTimestamp()
    });

    toast("Report submitted. Thank you.");

  } catch (error) {
    console.error(error);
    toast("Could not submit the report.");
  }
};


// ============================================================
// NAVIGATION
// ============================================================

function showTab(tab) {
  document
    .querySelectorAll("[data-tab]")
    .forEach(element => {
      element.classList.toggle(
        "hide",
        element.dataset.tab !== tab
      );
    });

  document
    .querySelectorAll(".tab")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.target === tab
      );
    });

  if (tab === "discover") {
    loadDiscover();
  }

  if (tab === "matches") {
    // Match listener already keeps this updated.
  }

  if (tab === "messages") {
    // Chat list is updated by the match listener.
  }

  if (tab === "profile") {
    renderMyProfile();
  }
}


document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.target;

    if (target) {
      showTab(target);
    }
  });
});


// ============================================================
// MODAL CLOSE BUTTONS
// ============================================================

document.querySelectorAll("[data-close-modal]")
  .forEach(button => {
    button.addEventListener("click", () => {
      const modalId = button.dataset.closeModal;

      closeModal(modalId);
    });
  });


// Close modal when clicking outside the sheet
document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.classList.add("hide");
    }
  });
});


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.loadDiscover = loadDiscover;
window.showTab = showTab;


// ============================================================
// STARTUP
// ============================================================

console.log("MarryMe application loaded.");
