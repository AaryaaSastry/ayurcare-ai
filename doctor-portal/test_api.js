const id = "69ca19dc97eed95c49fdbf52";
fetch(`http://localhost:5000/api/appointments/${id}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWNhMGJlOGRlNTRkNmY4MGEyMDJiMDUiLCJpYXQiOjE3NzQ4NTE5NjUsImV4cCI6MTc3NTQ1Njc2NX0.IVW3KTLSUgOYjwDODSl-8VyVn0WMJ-a6D0Jb9iSd3-0'
  },
  body: JSON.stringify({
    status: 'confirmed',
    type: 'online',
    startTime: '2026-03-30T12:30:00.000Z',
    endTime: '2026-03-30T13:00:00.000Z',
    duration: 30,
    notes: '',
    fee: 600,
    meetingLink: 'https://meet.google.com/6np-ivmr-i0o'
  })
})
.then(async r => {
  console.log('STATUS:', r.status);
  console.log('BODY:', await r.text());
})
.catch(console.error);
