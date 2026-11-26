// Validate the demo contact form without sending or storing personal data.

// Find the form and its status message.
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');

// Validate input when the user submits the form.
contactForm.addEventListener('submit', (event) => {
  // Prevent the browser from sending the form.
  event.preventDefault();

  // Get the three required input fields.
  const name = document.getElementById('name');
  const email = document.getElementById('email');
  const message = document.getElementById('message');

  // Clear previous validation errors.
  const fields = [name, email, message];
  for (const field of fields) field.removeAttribute('aria-invalid');

  // Check that every required field has a value.
  if (!name.value.trim() || !email.value.trim() || !message.value.trim()) {
    for (const field of fields) {
      if (!field.value.trim()) field.setAttribute('aria-invalid', 'true');
    }

    formStatus.textContent = 'Please complete all fields.';
    // Move keyboard focus to the first invalid field.
    fields.find(field => field.getAttribute('aria-invalid') === 'true').focus();
    showMessage(formStatus.textContent, 'error');
    return;
  }

  // Check the email format and length.
  if (!email.validity.valid || email.value.trim().length > 120) {
    email.setAttribute('aria-invalid', 'true');
    email.focus();

    formStatus.textContent = 'Please enter a valid email address.';
    showMessage(formStatus.textContent, 'error');
    return;
  }

  // Confirm valid input and clear the demo form.
  formStatus.textContent = 'Thank you! Your form is valid.';
  showMessage(formStatus.textContent, 'success');
  contactForm.reset();
});
