#!/usr/bin/env node
;(async ()=>{
  try{
    const ts = Date.now();
    const username = `smoke_${ts}`;
    const email = `smoke_${ts}@example.com`;
    const password = 'Pass1234!';

    console.log(`Registering ${username} <${email}>`);
    let res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    let j = await res.json();
    console.log('Register response:', j);

    res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    j = await res.json();
    console.log('Login response:', j);

    const token = j.token;
    if(!token){ console.error('No token returned'); process.exit(1); }
    console.log('Token received:', token.substring(0,10)+'...');

    res = await fetch('http://localhost:3000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+token },
      body: JSON.stringify({ name: 'Smoke Room', roomType: 'group' })
    });
    j = await res.json();
    console.log('Create room response:', j);

  }catch(e){ console.error('Error:', e); process.exit(1); }
})();
