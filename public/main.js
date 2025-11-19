// Handle Create Link Form
async function createLink(event) {
  event.preventDefault();
  const form = event.target;
  const url = form.elements['url'].value.trim();
  const code = form.elements['code'].value.trim();
  const msg = document.getElementById('form-message');
  const btn = form.querySelector('button[type="submit"]');
  const btnLabel = document.getElementById('create-btn-label');

  msg.textContent = '';
  btn.disabled = true;
  btnLabel.textContent = 'Creating...';

  try {
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, code: code || undefined }),
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.error || 'Failed to create link';
      msg.className = 'text-sm text-rose-400';
    } else {
      msg.textContent = 'Link created!';
      msg.className = 'text-sm text-emerald-400';
      window.location.reload();
    }
  } catch (e) {
    msg.textContent = 'Unexpected error';
    msg.className = 'text-sm text-rose-400';
  } finally {
    btn.disabled = false;
    btnLabel.textContent = 'Shorten';
  }
}

// Copy short URL
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("copy-btn")) {
    e.preventDefault();
    e.stopPropagation();

    const url = e.target.getAttribute("data-url");

    try {
      await navigator.clipboard.writeText(url);

      e.target.textContent = "Copied!";
      setTimeout(() => {
        e.target.textContent = "Copy";
      }, 1000);
    } catch (err) {
      console.error("Copy failed:", err);
      alert("Unable to copy");
    }
  }
});


// Delete link
function setupDeleteButtons() {
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.code;
      if (!confirm(`Delete ${code}?`)) return;

      const res = await fetch(`/api/links/${code}`, {
        method: 'DELETE',
      });

      if (res.status === 204) {
        window.location.reload();
      } else {
        alert('Failed to delete');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-form');
  if (form) form.addEventListener('submit', createLink);
  setupDeleteButtons();
});
