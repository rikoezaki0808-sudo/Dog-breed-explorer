// Shared message function for both pages.
// message: text for the user; icon: popup type (error or success).

function showMessage(message, icon) {
  // Use SweetAlert2 when available, or a standard browser alert.
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      text: message,
      icon: icon,
      // Match the confirmation button to the website's brown buttons.
      confirmButtonColor: '#925139'
    });
  } else {
    alert(message);
  }
}


// Let users hide or show decorative motion on both pages.
// Keep their choice when navigating between pages.
// Find the animation button and set the default state.
const animationToggle = document.getElementById('animationToggle');
let animationsHidden = false;

// Restore the saved animation preference, if available.
try {
  animationsHidden = localStorage.getItem('animationsHidden') === 'true';
} catch (error) {
  // The button still works when storage is unavailable.
}

// Apply the current animation setting and update the button label.
function updateAnimations() {
  document.body.classList.toggle('animations-hidden', animationsHidden);
  animationToggle.textContent = animationsHidden ? 'Show animations' : 'Hide animations';
}

if (animationToggle) {
  updateAnimations();
  animationToggle.hidden = false;

  // Reverse the setting when the button is clicked.
  animationToggle.addEventListener('click', function () {
    animationsHidden = !animationsHidden;
    updateAnimations();

    try {
      // Save the preference for both pages.
      localStorage.setItem('animationsHidden', String(animationsHidden));
    } catch (error) {
      // No storage is needed to change the current page.
    }
  });
}
