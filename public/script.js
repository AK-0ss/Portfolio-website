// Frontend interactions
(function(){
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Typed effect
  try {
    new Typed('#typed', {
      strings: ['Teacher', 'Mentor', 'Guide', 'Electronics Enthusiast', 'Programmer'],
      typeSpeed: 60,
      backSpeed: 30,
      backDelay: 1200,
      loop: true
    });
  } catch(e) {}

  // AOS
  try { AOS.init({ once: true, duration: 600, offset: 60 }); } catch(e) {}

  // Dark mode toggle
  const toggle = document.getElementById('darkModeToggle');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem('theme');
  const body = document.body;
  const setTheme = (mode) => {
    body.classList.toggle('dark', mode === 'dark');
    localStorage.setItem('theme', mode);
    if (toggle) toggle.checked = mode === 'dark';
  };
  setTheme(storedTheme || (prefersDark ? 'dark' : 'light'));
  if (toggle) toggle.addEventListener('change', () => setTheme(toggle.checked ? 'dark' : 'light'));

  // Visitor counter
  fetch('/api/visitors').then(r => r.json()).then(d => {
    const vc = document.getElementById('visitor-count');
    if (vc && d && typeof d.count === 'number') vc.textContent = d.count.toString();
  }).catch(()=>{});

  // WhatsApp link setup (change number below)
  const WHATSAPP_NUMBER = '+919168642089';
  const waLink = document.getElementById('whatsapp-link');
  if (waLink) waLink.href = `https://wa.me/${WHATSAPP_NUMBER.replace(/[^\d]/g,'')}?text=${encodeURIComponent('Hello Prashant Sir! I would like to connect.')}`;

  // Contact form
  const form = document.getElementById('contact-form');
  const statusEl = document.getElementById('form-status');
  function setStatus(msg, ok){ if(statusEl){ statusEl.textContent = msg; statusEl.className = 'mt-3 small ' + (ok ? 'text-success' : 'text-danger'); } }

  function validate(){
    if (!form) return false;
    let valid = true;
    ['name','email','phone','message'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!el.value || (id==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value))) {
        el.classList.add('is-invalid');
        valid = false;
      } else {
        el.classList.remove('is-invalid');
      }
    });
    return valid;
  }

  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) { setStatus('Please correct the highlighted fields.', false); return; }

    const payload = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      message: document.getElementById('message').value.trim(),
    };

    setStatus('Sending...', true);
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');
      setStatus('Thank you! Your message has been sent.', true);
      // Open WhatsApp chat with prefilled message
      const text = `Hello Prashant Sir, this is ${payload.name} (${payload.phone}). ${payload.message}`;
      window.open(`https://wa.me/${WHATSAPP_NUMBER.replace(/[^\d]/g,'')}?text=${encodeURIComponent(text)}`, '_blank');
      form.reset();
    } catch (err) {
      setStatus('Could not send message. Please try again later.', false);
    }
  });
})();
