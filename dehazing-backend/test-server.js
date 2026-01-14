const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ 
    message: 'TEST SERVER ON PORT 3000',
    timestamp: new Date().toISOString(),
    envPort: process.env.PORT,
    hardcodedPort: 3000
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\🎯 TEST SERVER RUNNING ON PORT \\);
  console.log(\📱 Test: http://localhost:\\);
});
